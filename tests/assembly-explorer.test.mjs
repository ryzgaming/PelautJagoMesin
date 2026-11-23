import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {injectAssemblyExplorer,assemblyExplorerRuntime,assemblyExplorerStyles} from '../server/assembly-explorer.mjs';
import {handleApi} from '../server/api.mjs';
import {MAN_V4_REVIEW_ORIGIN} from '../server/man-v4-internal.mjs';

const publicJs=await readFile('dist/assets/assembly-explorer.js','utf8');
const publicCss=await readFile('dist/assets/assembly-explorer.css','utf8');
const shinko=await readFile('dist/shinko-gj-sim.html','utf8');
const example='<html lang="id"><head><title>PRIVATE VIEWER</title></head><body><div id="simroot"></div><script>window.__pp={parts:[]}</script></body></html>';

test('shared assembly assets stay identical between private and public simulators',()=>{
 assert.equal(publicJs,assemblyExplorerRuntime);
 assert.equal(publicCss,assemblyExplorerStyles);
 assert.doesNotThrow(()=>new Function(assemblyExplorerRuntime));
 assert.match(shinko,/assets\/assembly-explorer\.css/);
 assert.match(shinko,/assets\/assembly-explorer\.js/);
 assert.doesNotMatch(publicJs,/SUPABASE_SERVICE_ROLE_KEY|premium-source\//);
});
test('assembly explorer uses existing machine geometries and controls, not fabricated models',()=>{
 for(const needle of ['window.__pp','api.parts','setExLvl','api.setOne','bPins','bMat','bIso',"getElementById('stage')",'Pasang kembali','Tampilkan nomor','Sembunyikan nomor'])
   assert(assemblyExplorerRuntime.includes(needle),needle);
 assert.match(assemblyExplorerRuntime,/om-assembly-numbers-hidden/);
 assert.match(assemblyExplorerStyles,/#leaders\{display:none!important\}/);
 assert.match(assemblyExplorerRuntime,/colorMode==='engine'/);
 assert.match(assemblyExplorerRuntime,/api.setExLvl\(level===0\?2:\(level===1\?3:4\)\)/);
 assert.match(assemblyExplorerRuntime,/next.disabled=level===2/);
 assert.doesNotMatch(assemblyExplorerRuntime,/BoxGeometry|CylinderGeometry|new THREE\./);
});
test('injection is idempotent and preserves original protected simulator',()=>{
 const first=injectAssemblyExplorer(example);
 assert.match(first,/om-assembly-css/);
 assert.match(first,/om-assembly-js/);
 assert.match(first,/window.__pp=\{parts:\[\]\}/);
 assert.equal(injectAssemblyExplorer(first),first);
 assert.throws(()=>injectAssemblyExplorer('<body>oops</body>'),/ASSEMBLY_HTML_INVALID/);
});
const products=['man-l2330h','tanabe-h74','alfa-laval-mab206s'];
const prodOrigin='https://pelautjagomesin.pages.dev';
function mock(product,{admin=false,entitled=false,blocked=false}={}){
 const calls=[];
 const fetcher=async url=>{
   const u=new URL(url),p=u.pathname;calls.push(p);
   if(p==='/auth/v1/user')return Response.json({id:'uid',email:'user@example.invalid'});
   if(p==='/rest/v1/profiles')return Response.json([{blocked}]);
   if(p==='/rest/v1/products')return Response.json([{id:product,is_free:false,storage_path:product+'.html',active:true}]);
   if(p==='/rest/v1/admins')return Response.json(admin?[{user_id:'uid'}]:[]);
   if(p==='/rest/v1/entitlements')return Response.json(entitled?[{product_id:product}]:[]);
   if(p==='/storage/v1/object/authenticated/premium/'+product+'.html')return new Response(example);
   throw Error('Unexpected URL '+p);
 };
 return {fetcher,calls};
}
function request(product,origin){
 return new Request('https://api.invalid/api/access',{
   method:'POST',headers:{origin,authorization:'Bearer valid-test-token','content-type':'application/json'},
   body:JSON.stringify({productId:product})
 });
}
function env(origin){
 return {APP_ORIGIN:origin,SUPABASE_URL:'https://supabase.invalid',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'service-test'};
}
for(const product of products){
 test('preview admin can explore '+product+' without purchasing',async()=>{
   const s=mock(product,{admin:true});
   const r=await handleApi(request(product,MAN_V4_REVIEW_ORIGIN),env(MAN_V4_REVIEW_ORIGIN),s.fetcher);
   assert.equal(r.status,200);
   const result=await r.text();
   assert.match(result,/om-assembly-css/);
   assert.match(result,/om-assembly-js/);
   assert.match(result,/PRIVATE VIEWER/);
 });
 test('preview customer keeps existing UI for '+product,async()=>{
   const s=mock(product,{entitled:true});
   const r=await handleApi(request(product,MAN_V4_REVIEW_ORIGIN),env(MAN_V4_REVIEW_ORIGIN),s.fetcher);
   assert.equal(r.status,200);
   const result=await r.text();
   assert.doesNotMatch(result,/om-assembly-css/);
 });
 test('production admin keeps existing assembly UI for '+product+' until approval',async()=>{
   const s=mock(product,{admin:true});
   const r=await handleApi(request(product,prodOrigin),env(prodOrigin),s.fetcher);
   assert.equal(r.status,200);
   const result=await r.text();
   assert.doesNotMatch(result,/om-assembly-css/);
 });
 test('unentitled visitor cannot fetch premium source for '+product,async()=>{
   const s=mock(product);
   const r=await handleApi(request(product,MAN_V4_REVIEW_ORIGIN),env(MAN_V4_REVIEW_ORIGIN),s.fetcher);
   assert.equal(r.status,403);
   assert(!s.calls.some(x=>x.includes('/storage/v1/object/')));
 });
}
