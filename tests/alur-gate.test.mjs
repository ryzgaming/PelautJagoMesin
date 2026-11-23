import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['functions/alur/_middleware.ts'],bundle:true,write:false,format:'esm',platform:'browser'});
const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('Alur protects documents, deep links, downloads and APIs; login cookies only for a verified admin',async t=>{
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  if(url.includes('/auth/v1/token'))return Response.json({access_token:JSON.parse(init.body).email==='admin@test'?'admin':'user',refresh_token:'r',expires_in:1000});
  assert.ok(url.endsWith('/rpc/alur_is_admin'));
  if(init.headers.Authorization==='Bearer expired')return new Response(null,{status:401});
  return Response.json(init.headers.Authorization==='Bearer admin');
 });
 const visit=(path,options={})=>onRequest({request:new Request('https://unit.test'+path,options),next:async()=>new Response('workspace-or-private-data')});
 for(const path of ['/alur','/alur/?mode=editor','/alur/form','/alur/assets/x.js','/alur/runner.py','/alur/api/flows','/alur/api/machines','/alur/api/agent-jobs']){
  for(const [cookie,status] of [['',401],['alur_access=user',403],['alur_access=expired',401],['alur_access=admin',200]]){
   const response=await visit(path,{headers:{cookie,'X-Admin':'true'}});
   assert.equal(response.status,status,path);assert.equal((await response.text()).includes('workspace-or-private-data'),status===200);
   assert.match(response.headers.get('Cache-Control'),/no-store/);
  }
 }
 const login=email=>visit('/alur/?mode=agen',{method:'POST',headers:{origin:'https://unit.test'},body:new URLSearchParams({email,password:'example'})});
 const denied=await login('user@test');assert.equal(denied.status,403);assert.equal(denied.headers.has('Set-Cookie'),false);
 const ok=await login('admin@test');assert.equal(ok.status,303);assert.equal(ok.headers.get('Location'),'/alur/?mode=agen');
 assert.match(ok.headers.get('Set-Cookie'),/Path=\/alur; Max-Age=1000; HttpOnly; Secure/);
});
