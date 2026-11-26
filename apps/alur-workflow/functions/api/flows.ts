import {url,apiKey} from "../config";
import {cookie} from "./session";
import {execute,validate,type Graph} from "../../src/flow";
const json=(j:unknown,status=200)=>Response.json(j,{status,headers:{"Cache-Control":"no-store"}});
export const onRequest:PagesFunction=async ({request:req})=>{
 const token=cookie(req,"alur_access");if(!token)return json({error:"Masuk untuk menggunakan penyimpanan cloud."},401);
 async function request(table:string,query:Record<string,string>,method="GET",body?:unknown){
  const r=await fetch(url+"/rest/v1/"+table+"?"+new URLSearchParams(query),{method,headers:{apikey:apiKey,Authorization:"Bearer "+token,"Content-Type":"application/json",Prefer:"return=representation"},body:body===undefined?undefined:JSON.stringify(body)});
  if(!r.ok)throw new Response(JSON.stringify({error:r.status===409?"Workflow sudah tersimpan. Buka versi terbaru.":r.status===401?"Sesi berakhir.":"Gagal mengakses penyimpanan workflow."}),{status:r.status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});return await r.json() as any[];
 }
 async function get(id:string){const [row]=await request("alur_flows",{id:"eq."+id,select:"graph"});if(!row)throw json({error:"Workflow belum tersimpan."},404);return row.graph as Graph}
 try{
 const u=new URL(req.url),id=u.searchParams.get("id");
 if(req.method==="GET"){
  if(!id)return json(await request("alur_flows",{select:"id,name,updated",order:"updated.desc"}));
  if(u.searchParams.has("history"))return json(await request("alur_runs",{flow_id:"eq."+id,select:"id,mode,created,trace,result",order:"created.desc",limit:"50"}));
  return json(await get(id));
 }
 if(req.method!=="POST"||req.headers.get("origin")!==u.origin)return json({error:"Permintaan tidak valid."},403);
 const raw=await req.text();if(raw.length>900000)return json({error:"Workflow terlalu besar."},413);const b=JSON.parse(raw);
 if(b.action==="save"){if(raw.length>150000)return json({error:"Workflow terlalu besar."},413);const g=b.graph as Graph;validate(g);const rev=g.revision;g.revision++;const row={id:g.id,name:g.name,graph:g,revision:g.revision,updated:new Date().toISOString()};
 const rows=rev===0?await request("alur_flows",{},"POST",row):await request("alur_flows",{id:"eq."+g.id,revision:"eq."+rev},"PATCH",row);
 if(!rows.length)return json({error:"Versi cloud telah berubah. Buka kembali workflow terbaru."},409);return json(g)}
 if(!["test","submit"].includes(b.action))return json({error:"Aksi tidak tersedia."},400);
 const graph=b.action==="test"?b.graph:await get(String(b.id));
 if(b.action==="submit"&&b.revision!==undefined&&b.revision!==graph.revision)return json({error:"Workflow telah berubah. Muat ulang formulir."},409);
 const data={catatan:String(b.data?.catatan??"").slice(0,4000),email:String(b.data?.email??"").slice(0,400),nama:String(b.data?.nama??"").slice(0,400)};
 const answers=b.answers??{};
 if(typeof answers!=="object" || Array.isArray(answers))return json({error:"Hasil konektor tidak valid."},400);
 const result=execute(graph,data,answers);
 if(result.pending)return json(result);
 await request("alur_runs",{},"POST",{flow_id:graph.id,mode:b.action==="test"?"test":"live",trace:result.trace,result:{...data,hasil:result.hasil,confirmation:result.confirmation,review:result.review,warnings:result.warnings,recruit:result.recruit.map(v=>v.title),assignments:result.assignments,rules:result.rules}});
 return json(result);
 }catch(e){return e instanceof Response?e:json({error:e instanceof Error?e.message:"Permintaan gagal."},400)}
};
