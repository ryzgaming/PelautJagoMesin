import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleEdge, SITE_ORIGIN, PAGES_ORIGIN } from '../../server/edge.mjs';

const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'public-test',SUPABASE_SERVICE_ROLE_KEY:'private-test',CHECKOUT_ENABLED:'false'};
const bomb=async()=>{throw Error('Unexpected network request');};
const request=(path,options={})=>new Request('https://project.supabase.co/functions/v1/commerce/'+path,options);
test('Only the exact site origin gets CORS; preflight needs no authentication',async()=>{
  const ok=await handleEdge(request('me',{method:'OPTIONS',headers:{Origin:SITE_ORIGIN}}),env,bomb);
  assert.equal(ok.status,204);assert.equal(ok.headers.get('access-control-allow-origin'),SITE_ORIGIN);
  for(const origin of ['https://evil.example',SITE_ORIGIN+'.evil.example','null']){
    const r=await handleEdge(request('config',{headers:{Origin:origin}}),env,bomb);
    assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);
  }
});
test('Public config is accessible without exposing secrets or opening checkout',async()=>{
  const r=await handleEdge(request('config',{headers:{Origin:SITE_ORIGIN}}),env,bomb);
  const data=await r.json();assert.equal(data.authReady,true);assert.equal(data.checkoutEnabled,false);
  assert(!JSON.stringify(data).includes('private-test'));assert.equal(r.headers.get('cache-control'),'no-store');
});
test('Anonymous callers cannot read accounts, administer or download premium',async()=>{
  for(const [path,method,body] of [['me','GET'],['admin','GET'],['access','POST','{"productId":"tanabe-h74"}']]){
    const r=await handleEdge(request(path,{method,headers:{Origin:SITE_ORIGIN},...(body?{body}:{})}),env,bomb);
    assert.equal(r.status,401);assert.equal(r.headers.get('access-control-allow-origin'),SITE_ORIGIN);
  }
});
test('Invalid session is verified by Supabase Auth before any data is returned',async()=>{
  let calls=0;
  const r=await handleEdge(request('me',{headers:{Origin:SITE_ORIGIN,Authorization:'Bearer forged'}}),env,async url=>{
    calls++;assert.equal(url,env.SUPABASE_URL+'/auth/v1/user');return new Response('',{status:401});
  });
  assert.equal(r.status,401);assert.equal(calls,1);
});
test('Route rewriting preserves body and origin checks for both gateway path forms',async()=>{
  for(const prefix of ['/functions/v1/commerce/','/commerce/']){
    const r=await handleEdge(new Request('https://project.supabase.co'+prefix+'checkout',{method:'POST',headers:{Origin:SITE_ORIGIN},body:'{}'}),env,bomb);
    assert.equal(r.status,503);assert.equal((await r.json()).error,'CHECKOUT_CLOSED');
  }
  assert.equal((await handleEdge(request('access',{method:'POST',body:'{}'}),env,bomb)).status,403);
  assert.equal((await handleEdge(request('me',{method:'DELETE'}),env,bomb)).status,405);
});
test('Cloudflare and original storefront both receive exact CORS and authenticated POST checks',async()=>{
  for(const origin of [SITE_ORIGIN,PAGES_ORIGIN]){
    const preflight=await handleEdge(request('access',{method:'OPTIONS',headers:{Origin:origin}}),env,bomb);
    assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
    const access=await handleEdge(request('access',{method:'POST',headers:{Origin:origin},body:'{}'}),env,bomb);
    assert.equal(access.status,401);assert.equal(access.headers.get('access-control-allow-origin'),origin);
  }
  for(const origin of [PAGES_ORIGIN+'.evil.example','https://preview.pelautjagomesin.pages.dev','null']){
    const r=await handleEdge(request('config',{headers:{Origin:origin}}),env,bomb);
    assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);
  }
});
