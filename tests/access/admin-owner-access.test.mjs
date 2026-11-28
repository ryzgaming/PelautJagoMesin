import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../../server/api.mjs';

const env={
  APP_ORIGIN:'https://orangmesin.example',
  SUPABASE_URL:'https://supabase.example',
  SUPABASE_ANON_KEY:'anon-for-test',
  SUPABASE_SERVICE_ROLE_KEY:'service-for-test'
};

function mockServices({admin=false,entitled=false,blocked=false}={}){
  const calls=[];
  const fetcher=async(raw)=>{
    const url=new URL(raw);
    calls.push(url.pathname);
    const route=url.pathname;
    if(route==='/auth/v1/user')return Response.json({id:'user-123',email:'owner@example.test'});
    if(route==='/rest/v1/profiles')return Response.json([{blocked}]);
    if(route==='/rest/v1/products')return Response.json([{
      id:'man-l2330h',is_free:false,storage_path:'man-l2330h.html'
    }]);
    if(route==='/rest/v1/entitlements')return Response.json(entitled?[{product_id:'man-l2330h'}]:[]);
    if(route==='/rest/v1/admins')return Response.json(admin?[{user_id:'user-123'}]:[]);
    if(route==='/storage/v1/object/authenticated/premium/man-l2330h.html'){
      return new Response('<!doctype html><html><body>Protected MAN Workspace</body></html>');
    }
    throw new Error('Unexpected external route: '+url.pathname);
  };
  return {calls,fetcher};
}
function request({signedIn=true,spoofedAdmin=false}={}){
  return new Request('https://api.example/api/access',{
    method:'POST',
    headers:{
      Origin:env.APP_ORIGIN,
      'Content-Type':'application/json',
      ...(signedIn?{Authorization:'Bearer valid-auth-token'}:{}),
      ...(spoofedAdmin?{'X-Admin':'true'}:{})
    },
    body:JSON.stringify({productId:'man-l2330h'})
  });
}
test('Verified admin gets full MAN workspace without purchasing',async()=>{
  const s=mockServices({admin:true});
  const r=await handleApi(request(),env,s.fetcher);
  assert.equal(r.status,200);
  assert.match(await r.text(),/Protected MAN Workspace/);
  assert.match(r.headers.get('Content-Security-Policy'),/sandbox allow-scripts/);
  assert(s.calls.includes('/rest/v1/admins'));
  assert(s.calls.includes('/storage/v1/object/authenticated/premium/man-l2330h.html'));
});
test('Customer without entitlement remains blocked, even when spoofing admin header',async()=>{
  const s=mockServices();
  const r=await handleApi(request({spoofedAdmin:true}),env,s.fetcher);
  assert.equal(r.status,403);
  assert.equal((await r.json()).error,'PURCHASE_REQUIRED');
  assert(!s.calls.some(x=>x.includes('/storage/v1/object/')));
});
test('Customer who purchased MAN remains authorized',async()=>{
  const s=mockServices({entitled:true});
  const r=await handleApi(request(),env,s.fetcher);
  assert.equal(r.status,200);
  assert.match(await r.text(),/Protected MAN Workspace/);
});
test('Admin account that was blocked cannot open premium workspace',async()=>{
  const s=mockServices({admin:true,blocked:true});
  const r=await handleApi(request(),env,s.fetcher);
  assert.equal(r.status,403);
  assert.equal((await r.json()).error,'ACCOUNT_BLOCKED');
  assert(!s.calls.some(x=>x.includes('/storage/v1/object/')));
});
test('Unauthenticated visitor cannot receive protected premium source',async()=>{
  const s=mockServices({admin:true});
  const r=await handleApi(request({signedIn:false}),env,s.fetcher);
  assert.equal(r.status,401);
  assert.equal((await r.json()).error,'SIGN_IN_REQUIRED');
  assert(!s.calls.some(x=>x.includes('/storage/v1/object/')));
});
