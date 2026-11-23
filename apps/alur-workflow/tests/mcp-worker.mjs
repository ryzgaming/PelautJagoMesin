import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const bundle=await build({entryPoints:[new URL('../src/mcp.worker.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'browser'});
const server='https://mcp.example.test/mcp',origin='https://alur.example.test';
const redirectUrl=origin+'/alur/?mcp_callback=1';
test('klien MCP bernegosiasi, menelusuri alat, dan menerima hasil dengan token atau OAuth PKCE',async t=>{
  const events=[],requests=[];
  t.mock.method(globalThis,'fetch',async(url,options={})=>{
    const uri=new URL(String(url));
    assert.equal(options.credentials,'omit');
    assert.equal(options.redirect,'error');
    const headers=new Headers(options.headers);
    if(uri.pathname==='/.well-known/oauth-protected-resource/mcp')return Response.json({resource:server,authorization_servers:['https://auth.example.test']});
    if(uri.hostname==='auth.example.test'){
      assert.notEqual(headers.get('authorization'),'Bearer manual');
      if(uri.pathname.includes('/.well-known/'))return Response.json({issuer:uri.origin,authorization_endpoint:uri.origin+'/authorize',token_endpoint:uri.origin+'/token',registration_endpoint:uri.origin+'/register',response_types_supported:['code'],code_challenge_methods_supported:['S256']});
      if(uri.pathname==='/register')return Response.json({...JSON.parse(options.body),client_id:'alur-public'});
      if(uri.pathname==='/token'){
        const body=new URLSearchParams(options.body);
        assert.equal(body.get('code'),'sample-code');assert.ok(body.get('code_verifier'));
        return Response.json({access_token:'oauth-test',token_type:'Bearer'});
      }
    }
    assert.equal(uri.href,server);
    if(!headers.has('authorization'))return new Response(null,{status:401,headers:{'WWW-Authenticate':'Bearer resource_metadata="https://mcp.example.test/.well-known/oauth-protected-resource/mcp"'}});
    if(options.method==='GET')return new Response(null,{status:405});
    const msg=JSON.parse(options.body);
    requests.push(msg.method);
    const reply=result=>Response.json({jsonrpc:'2.0',id:msg.id,result});
    if(msg.method==='initialize')return reply({protocolVersion:msg.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'demo',version:'1'}});
    if(msg.method==='notifications/initialized')return new Response(null,{status:202});
    if(msg.method==='tools/list')return reply({tools:[{name:'read',inputSchema:{type:'object'},outputSchema:{type:'object'}}]});
    if(msg.method==='tools/call')return reply({content:[{type:'text',text:'hasil uji'}],structuredContent:{ok:true}});
    throw Error('Unexpected '+msg.method);
  });
  globalThis.self={location:new URL(origin),postMessage:m=>events.push(m)};
  globalThis.location=self.location;
  try {
    await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
    const run=async data=>{await self.onmessage({data});return events.at(-1)};
    const connect=token=>run({action:'connect',server,token,clientId:'',state:'example-state',redirectUrl});
    assert.deepEqual((await connect('manual')).tools.map(t=>t.name),['read']);
    assert.equal((await run({action:'call',tool:'read',args:{}})).output,'hasil uji');
    const start=await connect('');
    assert.ok(start.authorize,JSON.stringify(start));
    const auth=new URL(start.authorize);
    assert.equal(auth.searchParams.get('state'),'example-state');
    assert.equal(auth.searchParams.get('code_challenge_method'),'S256');
    assert.equal(auth.searchParams.get('redirect_uri'),redirectUrl);
    assert.equal((await run({action:'authorized',code:'sample-code'})).tools[0].name,'read');
    assert.equal(requests.filter(m=>m==='tools/call').length,1);
  } finally {delete globalThis.self;delete globalThis.location}
});
