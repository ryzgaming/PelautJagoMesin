import test from 'node:test';
import assert from 'node:assert/strict';
import {injectManV4,MAN_V4_REVIEW_ORIGIN,MAN_V4_PRODUCTION_ORIGIN} from '../server/man-v4-internal.mjs';
import {handleApi} from '../server/api.mjs';

const ORIGINAL='<!doctype html><html lang="id"><head><meta charset="utf-8"></head><body><div id="app">Original MAN model</div><script>window.__pp={parts:[]};</script></body></html>';
test('injection redesigns original simulator markup in-place without replacing it',()=>{
  const revised=injectManV4(ORIGINAL);
  assert.match(revised,/id="man-v4-native-css"/);
  assert.match(revised,/id="man-v4-native-js"/);
  assert.match(revised,/id="app">Original MAN model/);
  assert.match(revised,/v4-mounted/);
  assert.match(revised,/Component Explorer|component explorer/i);
  assert.match(revised,/Starting Air/);
  assert.match(revised,/Reason \/ Why/);
  assert.equal(injectManV4(revised),revised);
});
test('invalid input does not produce forged simulator HTML',()=>{
  assert.throws(()=>injectManV4('<html></html>'),/MAN_HTML_INVALID/);
  assert.throws(()=>injectManV4(null),TypeError);
});
function stub({admin,entitled=false,blocked=false}){
  const paths=[];
  const fetcher=async raw=>{
    const u=new URL(raw),p=u.pathname;
    paths.push(p);
    if(p==='/auth/v1/user')return Response.json({id:'owner-id',email:'example@invalid.test'});
    if(p==='/rest/v1/profiles')return Response.json([{blocked}]);
    if(p==='/rest/v1/products')return Response.json([{id:'man-l2330h',is_free:false,storage_path:'man-l2330h.html'}]);
    if(p==='/rest/v1/admins')return Response.json(admin?[{user_id:'owner-id'}]:[]);
    if(p==='/rest/v1/entitlements')return Response.json(entitled?[{product_id:'man-l2330h'}]:[]);
    if(p==='/storage/v1/object/authenticated/premium/man-l2330h.html')return new Response(ORIGINAL);
    throw Error('Unexpected external URL '+p);
  };
  return {paths,fetcher};
}
function request(origin){
  return new Request('https://api.example/api/access',{method:'POST',headers:{origin,authorization:'Bearer fake-test-token','content-type':'application/json'},body:JSON.stringify({productId:'man-l2330h'})});
}
function env(origin){return {APP_ORIGIN:origin,SUPABASE_URL:'https://supabase.invalid',SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-service'};}
test('authorized admin receives MAN V4 internal UI at exact preview origin',async()=>{
  const s=stub({admin:true});
  const res=await handleApi(request(MAN_V4_REVIEW_ORIGIN),env(MAN_V4_REVIEW_ORIGIN),s.fetcher);
  assert.equal(res.status,200);
  const html=await res.text();
  assert.match(html,/man-v4-native-css/);
  assert.match(html,/man-v4-native-js/);
  assert.match(html,/Original MAN model/);
  assert.match(res.headers.get('content-security-policy'),/sandbox allow-scripts/);
});
test('production administrator receives MAN V4 from inside the protected simulator',async()=>{
  const origin=MAN_V4_PRODUCTION_ORIGIN;
  const s=stub({admin:true});
  const res=await handleApi(request(origin),env(origin),s.fetcher);
  assert.equal(res.status,200);
  const text=await res.text();
  assert.match(text,/man-v4-native-css/);
  assert.match(text,/man-v4-native-js/);
  assert.match(text,/Original MAN model/);
});
test('ordinary purchaser on production still receives unchanged simulator UI',async()=>{
  const origin=MAN_V4_PRODUCTION_ORIGIN;
  const s=stub({admin:false,entitled:true});
  const res=await handleApi(request(origin),env(origin),s.fetcher);
  assert.equal(res.status,200);
  assert.equal(await res.text(),ORIGINAL);
});
test('paid customer at preview origin keeps original UI; cannot see admin-only V4',async()=>{
  const s=stub({admin:false,entitled:true});
  const res=await handleApi(request(MAN_V4_REVIEW_ORIGIN),env(MAN_V4_REVIEW_ORIGIN),s.fetcher);
  assert.equal(res.status,200);
  assert.equal(await res.text(),ORIGINAL);
});
test('unauthorized user is denied before private simulator content is fetched',async()=>{
  const s=stub({admin:false,entitled:false});
  const res=await handleApi(request(MAN_V4_REVIEW_ORIGIN),env(MAN_V4_REVIEW_ORIGIN),s.fetcher);
  assert.equal(res.status,403);
  assert.equal((await res.json()).error,'PURCHASE_REQUIRED');
  assert(!s.paths.some(p=>p.includes('/storage/v1/object/')));
});
test('blocked account cannot preview protected MAN',async()=>{
  const s=stub({admin:true,blocked:true});
  const res=await handleApi(request(MAN_V4_REVIEW_ORIGIN),env(MAN_V4_REVIEW_ORIGIN),s.fetcher);
  assert.equal(res.status,403);
  assert.equal((await res.json()).error,'ACCOUNT_BLOCKED');
});
