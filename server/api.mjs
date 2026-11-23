import {injectManV4,MAN_V4_REVIEW_ORIGIN,MAN_V4_PRODUCTION_ORIGIN} from './man-v4-internal.mjs';
import {injectAssemblyExplorer} from './assembly-explorer.mjs';
const PUBLIC_FIELDS='id,title,category,description,price_idr,is_free,active';
export class ApiError extends Error { constructor(status,code){ super(code);this.status=status; } }
const fail=(status,code)=>{throw new ApiError(status,code)};
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const required=(env,keys)=>{if(keys.some(k=>!env[k])) fail(503,'SERVICE_NOT_CONFIGURED');};
function basic(key){return 'Basic '+btoa(key+':');}
export function amountInRupiah(value){
  if(!/^\d+(?:\.00)?$/.test(String(value))) fail(400,'INVALID_AMOUNT');
  const n=Number(value);if(!Number.isSafeInteger(n)||n<0) fail(400,'INVALID_AMOUNT');return n;
}
export async function signature(payload,key){
  return [...new Uint8Array(await crypto.subtle.digest('SHA-512',new TextEncoder().encode(payload.order_id+payload.status_code+payload.gross_amount+key)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function verifySignature(payload,key){
  if(!['order_id','status_code','gross_amount','signature_key'].every(k=>typeof payload[k]==='string'))return false;
  if(!/^[a-f0-9]{128}$/i.test(payload.signature_key))return false;
  const expected=await signature(payload,key);let diff=0;
  for(let i=0;i<128;i++)diff|=expected.charCodeAt(i)^payload.signature_key.toLowerCase().charCodeAt(i);
  return diff===0;
}
export function verifiedStatus(data,order){
  if(data.order_id!==order.id||amountInRupiah(data.gross_amount)!==Number(order.amount_idr)||data.currency!=='IDR'||!data.transaction_id)fail(409,'PAYMENT_MISMATCH');
  if(!['qris','bank_transfer','echannel'].includes(data.payment_type))fail(409,'UNSUPPORTED_PAYMENT_METHOD');
  const s=data.transaction_status;
  if(s==='settlement'&&(!data.fraud_status||data.fraud_status==='accept')) return 'paid';
  if(['refund','partial_refund','chargeback','partial_chargeback'].includes(s))return 'refunded';
  if(['deny','cancel','expire','failure'].includes(s))return 'failed';
  return 'pending';
}
export async function handleApi(request,env,fetcher=fetch){
  try {
    const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
    if(path==='/api/config'&&request.method==='GET')return response({authReady:!!(env.SUPABASE_URL&&env.SUPABASE_ANON_KEY),supabaseUrl:env.SUPABASE_URL||null,anonKey:env.SUPABASE_ANON_KEY||null,checkoutEnabled:env.CHECKOUT_ENABLED==='true'&&!!(env.MIDTRANS_SERVER_KEY&&env.MIDTRANS_SIGNATURE_KEY&&env.MIDTRANS_CLIENT_KEY&&env.SUPABASE_SERVICE_ROLE_KEY),paymentEnvironment:env.MIDTRANS_ENV==='production'?'production':'sandbox',clientKey:env.MIDTRANS_CLIENT_KEY||null});
    if(request.method==='POST'&&path!=='/api/webhook'){
      const origin=request.headers.get('origin');
      if(!origin||origin!==(env.APP_ORIGIN||url.origin))fail(403,'INVALID_ORIGIN');
    }
    required(env,['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']);
    async function db(route,options={}){
      const r=await fetcher(env.SUPABASE_URL+'/rest/v1/'+route,{...options,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:'return=representation',...options.headers}});
      if(!r.ok){const e=await r.json().catch(()=>({}));if(e.message==='ACCOUNT_BLOCKED')fail(403,'ACCOUNT_BLOCKED');if(e.message==='ALREADY_OWNED')fail(409,'ALREADY_OWNED');if(e.message==='CHECKOUT_RATE_LIMIT')fail(429,'CHECKOUT_RATE_LIMIT');fail(502,'DATABASE_ERROR');}
      return r.status===204?null:r.json();
    }
    const rpc=(name,body)=>db('rpc/'+name,{method:'POST',body:JSON.stringify(body)});
    async function user(){
      const auth=request.headers.get('authorization');if(!auth?.startsWith('Bearer '))fail(401,'SIGN_IN_REQUIRED');
      const r=await fetcher(env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:env.SUPABASE_ANON_KEY||env.SUPABASE_SERVICE_ROLE_KEY,Authorization:auth}});
      if(!r.ok)fail(401,'SESSION_EXPIRED');const u=await r.json();if(!u.id)fail(401,'SESSION_EXPIRED');
      const profiles=await db('profiles?id=eq.'+encodeURIComponent(u.id)+'&select=blocked');
      if(profiles[0]?.blocked)fail(403,'ACCOUNT_BLOCKED');return u;
    }
    async function admin(){const u=await user();const rows=await db('admins?user_id=eq.'+encodeURIComponent(u.id)+'&select=user_id');if(!rows.length)fail(403,'ADMIN_REQUIRED');return u;}
    async function body(){if(Number(request.headers.get('content-length'))>16384)fail(413,'PAYLOAD_TOO_LARGE');const raw=await request.text();if(raw.length>16384)fail(413,'PAYLOAD_TOO_LARGE');try{return JSON.parse(raw);}catch{fail(400,'INVALID_JSON');}}
    async function reconcile(id){
      required(env,['MIDTRANS_SERVER_KEY']);
      const orders=await db('orders?id=eq.'+encodeURIComponent(id)+'&select=id,amount_idr');if(!orders.length)fail(404,'ORDER_NOT_FOUND');
      const base=env.MIDTRANS_ENV==='production'?'https://api.midtrans.com':'https://api.sandbox.midtrans.com';
      const r=await fetcher(base+'/v2/'+encodeURIComponent(id)+'/status',{headers:{Authorization:basic(env.MIDTRANS_SERVER_KEY),Accept:'application/json'}});
      if(!r.ok)fail(502,'PAYMENT_STATUS_UNAVAILABLE');const d=await r.json();
      if(d.status_code==='404')fail(502,'PAYMENT_STATUS_UNAVAILABLE');
      const state=verifiedStatus(d,orders[0]);
      return rpc('apply_payment',{p_order_id:id,p_amount:amountInRupiah(d.gross_amount),p_status:state,p_transaction_id:d.transaction_id});
    }
    if(path==='/api/products'&&request.method==='GET')return response(await db('products?active=eq.true&select='+PUBLIC_FIELDS+'&order=price_idr.asc'));
    if(path==='/api/me'&&request.method==='GET'){
      const u=await user();const uid=encodeURIComponent(u.id);
      const [orders,access,admins]=await Promise.all([db('orders?user_id=eq.'+uid+'&select=id,product_id,amount_idr,status,created_at&order=created_at.desc&limit=100'),db('entitlements?user_id=eq.'+uid+'&select=product_id'),db('admins?user_id=eq.'+uid+'&select=user_id')]);
      return response({email:u.email,orders,access,admin:!!admins.length});
    }
    if(path==='/api/checkout'&&request.method==='POST'){
      if(env.CHECKOUT_ENABLED!=='true')fail(503,'CHECKOUT_CLOSED');required(env,['MIDTRANS_SERVER_KEY','MIDTRANS_SIGNATURE_KEY','MIDTRANS_CLIENT_KEY']);
      const u=await user(),b=await body();if(typeof b.productId!=='string')fail(400,'INVALID_PRODUCT');
      const result=await rpc('prepare_order',{p_user_id:u.id,p_product_id:b.productId,p_email:u.email});
      const order=Array.isArray(result)?result[0]:result;if(!order?.id)fail(502,'DATABASE_ERROR');
      if(order.snap_token)return response({token:order.snap_token,orderId:order.id});
      const base=env.MIDTRANS_ENV==='production'?'https://app.midtrans.com':'https://app.sandbox.midtrans.com';
      const r=await fetcher(base+'/snap/v1/transactions',{method:'POST',headers:{Authorization:basic(env.MIDTRANS_SERVER_KEY),'Content-Type':'application/json'},body:JSON.stringify({transaction_details:{order_id:order.id,gross_amount:order.amount_idr},item_details:[{id:order.product_id,price:order.amount_idr,quantity:1,name:order.product_title.slice(0,50)}],customer_details:{email:u.email},enabled_payments:['qris','bca_va','bni_va','bri_va','permata_va','echannel','other_va'],expiry:{unit:'hours',duration:24}})});
      if(!r.ok)fail(502,'PAYMENT_PROVIDER_UNAVAILABLE');const snap=await r.json();if(!snap.token)fail(502,'PAYMENT_PROVIDER_UNAVAILABLE');
      await db('orders?id=eq.'+encodeURIComponent(order.id),{method:'PATCH',body:JSON.stringify({snap_token:snap.token})});
      return response({token:snap.token,orderId:order.id});
    }
    if(path==='/api/webhook'&&request.method==='POST'){
      required(env,['MIDTRANS_SERVER_KEY','MIDTRANS_SIGNATURE_KEY']);const b=await body();
      if(!(await verifySignature(b,env.MIDTRANS_SIGNATURE_KEY)))fail(401,'INVALID_SIGNATURE');
      // Notification status is NOT signed. Always query Midtrans before granting access.
      return response({ok:true,result:await reconcile(b.order_id)});
    }
    if(path==='/api/order-sync'&&request.method==='POST'){
      const u=await user(),b=await body();if(typeof b.orderId!=='string')fail(400,'INVALID_ORDER');
      const own=await db('orders?id=eq.'+encodeURIComponent(b.orderId)+'&user_id=eq.'+encodeURIComponent(u.id)+'&select=id');if(!own.length)fail(404,'ORDER_NOT_FOUND');return response(await reconcile(b.orderId));
    }
    if(path==='/api/access'&&request.method==='POST'){
      const u=await user(),b=await body();if(typeof b.productId!=='string')fail(400,'INVALID_PRODUCT');
      const p=(await db('products?id=eq.'+encodeURIComponent(b.productId)+'&active=eq.true&select=id,is_free,storage_path'))[0];if(!p)fail(404,'PRODUCT_NOT_FOUND');
      if(p.is_free)return response({url:'/shinko-gj-sim.html'});
      const access=await db('entitlements?user_id=eq.'+encodeURIComponent(u.id)+'&product_id=eq.'+encodeURIComponent(p.id)+'&select=product_id');
      // Apply MAN V4 internally to server-verified administrators only on exact
      // approved Orang Mesin domains. Paid customers still receive the original UI.
      const manV4Review=p.id==='man-l2330h'&&[MAN_V4_REVIEW_ORIGIN,MAN_V4_PRODUCTION_ORIGIN].includes(env.APP_ORIGIN);
      // Assembly explorer is a preview-only admin capability for existing premium machines.
      const assemblyReview=env.APP_ORIGIN===MAN_V4_REVIEW_ORIGIN&&['man-l2330h','tanabe-h74','alfa-laval-mab206s'].includes(p.id);
      let admins=[];
      if(!access.length||manV4Review||assemblyReview){
        // Grant paid workspaces to verified admins without creating purchases.
        // Never trust a role, email, or flag supplied by the browser.
        admins=await db('admins?user_id=eq.'+encodeURIComponent(u.id)+'&select=user_id');
      }
      if(!access.length&&!admins.length)fail(403,'PURCHASE_REQUIRED');
      if(!p.storage_path)fail(503,'PRODUCT_FILE_NOT_READY');
      const r=await fetcher(env.SUPABASE_URL+'/storage/v1/object/authenticated/premium/'+p.storage_path.split('/').map(encodeURIComponent).join('/'),{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}});
      if(!r.ok)fail(503,'PRODUCT_FILE_NOT_READY');
      // Return only after server-side entitlement check. Caller uses an opaque sandbox iframe.
      const original=await r.text();
      const manHtml=manV4Review&&admins.length?injectManV4(original):original;
      const secured=assemblyReview&&admins.length?injectAssemblyExplorer(manHtml):manHtml;
      return new Response(secured,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: https:; connect-src 'none'"}});
    }
    if(path==='/api/admin'&&request.method==='GET'){
      await admin();return response({products:await db('products?select=*&order=price_idr.asc'),customers:await db('profiles?select=id,email,display_name,blocked,created_at&order=created_at.desc&limit=200'),orders:await db('orders?select=id,user_id,product_id,amount_idr,status,created_at&order=created_at.desc&limit=200')});
    }
    if(path==='/api/admin'&&request.method==='POST'){
      await admin();const b=await body();
      if(b.action==='product'){
        if(!/^[a-z0-9-]{1,80}$/.test(b.id)||typeof b.title!=='string'||b.title.length<1||b.title.length>120||!Number.isSafeInteger(b.price_idr)||b.price_idr<0||b.price_idr>100000000||typeof b.active!=='boolean')fail(400,'INVALID_PRODUCT');
        const category=String(b.category||'').slice(0,80),description=String(b.description||'').slice(0,2000),storage_path=String(b.storage_path||'');
        if(storage_path&&!/^[a-z0-9-]+\.html$/.test(storage_path))fail(400,'INVALID_FILE_PATH');
        if(b.price_idr===0&&b.id!=='shinko-gj-sim')fail(400,'ONLY_SHINKO_IS_FREE');
        return response(await db('products?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({id:b.id,title:b.title,category,description,price_idr:b.price_idr,is_free:b.price_idr===0,active:b.active,storage_path:storage_path||null})}));
      }
      if(b.action==='customer'&&typeof b.blocked==='boolean'&&typeof b.id==='string')return response(await db('profiles?id=eq.'+encodeURIComponent(b.id),{method:'PATCH',body:JSON.stringify({blocked:b.blocked,display_name:String(b.display_name||'').slice(0,120)})}));
      if(b.action==='sync'&&typeof b.orderId==='string')return response(await reconcile(b.orderId));
      fail(400,'INVALID_ACTION');
    }
    fail(404,'NOT_FOUND');
  }catch(e){return response({error:e instanceof ApiError?e.message:'INTERNAL_ERROR'},e instanceof ApiError?e.status:500);}
}
