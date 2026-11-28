import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {CfWorkerJsonSchemaValidator} from "@modelcontextprotocol/sdk/validation/cfworker-provider.js";
import type {OAuthClientProvider} from "@modelcontextprotocol/sdk/client/auth.js";
import type {OAuthClientInformationMixed,OAuthTokens} from "@modelcontextprotocol/sdk/shared/auth.js";
import {validServer} from "./features/workflow/directory";

let client:Client, transport:StreamableHTTPClientTransport, waitingForLogin=false;
let endpoint:URL, token:string, provider:OAuthClientProvider|undefined;
function sessionProvider(redirectUrl:string,state:string,clientId:string):OAuthClientProvider {
  let registration:OAuthClientInformationMixed|undefined=clientId?{client_id:clientId}:undefined;
  let tokens:OAuthTokens|undefined,verifier="";
  return {
    redirectUrl,clientMetadata:{client_name:"Alur",redirect_uris:[redirectUrl],grant_types:["authorization_code"],response_types:["code"],token_endpoint_auth_method:"none"},
    state:()=>state,clientInformation:()=>registration,saveClientInformation:value=>{registration=value},
    tokens:()=>tokens,saveTokens:value=>{tokens=value},
    saveCodeVerifier:value=>{verifier=value},codeVerifier:()=>verifier,
    redirectToAuthorization:url=>{
      if(url.protocol!=="https:")throw Error("URL otorisasi harus HTTPS.");
      waitingForLogin=true;self.postMessage({authorize:url.href});
    }
  };
}
async function listTools(){
  transport=new StreamableHTTPClientTransport(endpoint,{
    authProvider:provider,
    fetch:(url,init)=>{
      const headers=new Headers(init?.headers);
      if(token&&new URL(String(url)).origin===endpoint.origin)headers.set("Authorization","Bearer "+token);
      return fetch(url,{...init,headers,credentials:"omit",redirect:"error",referrerPolicy:"no-referrer"});
    }
  });
  client=new Client({name:"Alur",version:"1.0"},{jsonSchemaValidator:new CfWorkerJsonSchemaValidator()});
  await client.connect(transport);
  const tools=[];
  let cursor:string|undefined;
  const seen=new Set<string>();
  do{
    const page=await client.listTools({cursor});
    tools.push(...page.tools.map(t=>({name:t.name,description:t.description,schema:t.inputSchema})));
    cursor=page.nextCursor;
    if(cursor&&seen.has(cursor)) throw Error("Server mengulangi halaman daftar alat.");
    if(cursor)seen.add(cursor);
  }while(cursor && tools.length<1000);
  self.postMessage({tools});
}
self.onmessage=async({data})=>{
  try{
    if(data.action==="connect"){
      if(!validServer(data.server)||new URL(data.server).origin===self.location.origin) throw Error("Gunakan endpoint HTTPS penyedia MCP.");
      endpoint=new URL(data.server);token=data.token;
      provider=token?undefined:sessionProvider(data.redirectUrl,data.state,data.clientId);
      await listTools();
    }else if(data.action==="authorized"&&waitingForLogin){
      waitingForLogin=false;
      await transport.finishAuth(data.code);
      await listTools();
    }else if(data.action==="call"&&client){
      const result=await client.callTool({name:data.tool,arguments:data.args});
      const content=Array.isArray(result.content)?result.content:[];
      const text=content.filter(p=>p.type==="text").map(p=>p.text).join("\n");
      if(result.isError)throw Error(text.slice(0,500)||"Alat mengembalikan kesalahan.");
      self.postMessage({output:text||JSON.stringify(result.structuredContent??content,null,2)||"Alat selesai."});
    }
  }catch(error){if(!waitingForLogin)self.postMessage({error:error instanceof Error?error.message:"Permintaan MCP gagal."})}
};
