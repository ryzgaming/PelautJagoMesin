import {fieldLabels, pluginById, renderMessage, type Field, type RunFields} from "./plugins.ts";

import {customKind,directoryByKind,validServer,type DirectoryKind} from "./directory.ts";
export type Kind = DirectoryKind | `robot-${string}` | "trigger" | "condition" | "confirm" | "review";
export type Step = {id:string, kind:Kind, name:string, x:number, y:number, field:Field, operator:"filled"|"empty"|"equals", value:string, message:string};
export type Port = "out" | "yes" | "no";
export type Edge = {from:string, port:Port, to:string};
export type Graph = {id:string, name:string, revision:number, nodes:Step[], edges:Edge[]};
export const baseLabels = {trigger:"Formulir masuk",condition:"Kondisi",confirm:"Kirim konfirmasi",review:"Tandai untuk review"};
export function label(kind:Kind) { return directoryByKind.get(kind)?.name ?? pluginById.get(kind)?.name ?? baseLabels[kind as keyof typeof baseLabels]; }
export function branches(kind:Kind) { return kind==="condition" || !!pluginById.get(kind)?.check; }
export function usesNotes(g:Graph) {
  return g.nodes.some(n => n.field==="catatan" || n.message.includes("{catatan}"));
}
export function step(kind:Kind,id:string,x:number,y:number):Step {
  const plugin=pluginById.get(kind);
  return {kind,id,x,y,name:label(kind),field:plugin?.field ?? "email",operator:"filled",value:plugin?.parameter?.initial ?? "",
    message:plugin?.template ?? (kind==="confirm"?"Terima kasih, formulir kamu sudah diterima.":kind==="review"?"Perlu ditinjau":"")};
}
export function initial():Graph {
  const condition=step("condition","check",346,190); condition.name="Email terisi?";
  return {id:"formulir-masuk",name:"Formulir masuk",revision:0,nodes:[step("trigger","start",38,190),condition,step("confirm","ok",666,92),step("review","review",666,293)],edges:[{from:"start",port:"out",to:"check"},{from:"check",port:"yes",to:"ok"},{from:"check",port:"no",to:"review"}]};
}
export function validate(g:Graph,run=false) {
  const id=(s:unknown)=>typeof s==="string" && /^[a-zA-Z0-9_-]{1,80}$/.test(s);
  if(!g||!id(g.id)||typeof g.name!=="string"||!g.name.trim()||g.name.length>80||!Number.isInteger(g.revision)||g.revision<0||!Array.isArray(g.nodes)||!Array.isArray(g.edges)||g.nodes.length>80||g.edges.length>160) throw Error("Data workflow tidak valid.");
  const ids=new Set<string>();
  for(const n of g.nodes){
    if(!id(n.id)||ids.has(n.id)||(!Object.hasOwn(baseLabels,n.kind)&&!pluginById.has(n.kind)&&!directoryByKind.has(n.kind))||!Number.isFinite(n.x)||!Number.isFinite(n.y)||typeof n.name!=="string"||!n.name.trim()||n.name.length>80||!Object.hasOwn(fieldLabels,n.field)||!["filled","empty","equals"].includes(n.operator)||typeof n.value!=="string"||n.value.length>400||typeof n.message!=="string"||n.message.length>1000) throw Error("Periksa konfigurasi langkah.");
    if(n.kind===customKind&&!validServer(n.value)) throw Error("Periksa URL HTTPS server MCP.");
    ids.add(n.id);
  }
  const triggers=g.nodes.filter(n=>n.kind==="trigger");
  if(triggers.length!==1) throw Error("Workflow membutuhkan satu pemicu formulir.");
  const ports=new Set<string>();
  for(const e of g.edges) {
    const n=g.nodes.find(x=>x.id===e.from);
    const key=e.from+"/"+e.port;
    if(!n||!ids.has(e.to)||e.to===triggers[0].id||!(branches(n.kind)?["yes","no"]:["out"]).includes(e.port)||ports.has(key)) throw Error("Sambungan tidak valid.");
    ports.add(key);
  }
  const visiting=new Set<string>(),seen=new Set<string>();
  function walk(id:string) {
    if(visiting.has(id)) throw Error("Langkah tidak boleh membentuk putaran.");
    if(seen.has(id)) return;
    visiting.add(id); for(const e of g.edges.filter(e=>e.from===id)) walk(e.to);
    visiting.delete(id); seen.add(id);
  }
  walk(triggers[0].id);
  if(run && (seen.size!==g.nodes.length||g.nodes.length<2)) throw Error("Hubungkan semua langkah ke pemicu sebelum menjalankan alur.");
  for(const n of g.nodes) {
    walk(n.id);
    if(run && branches(n.kind) && (!ports.has(n.id+"/yes")||!ports.has(n.id+"/no"))) throw Error("Hubungkan kedua cabang kondisi, Ya dan Tidak.");
  }
}
export type ConnectorRequest={id:string,kind:Kind,name:string,server?:string,task:string,openUrl:string,source:string};
export type ConnectorAnswers=Record<string,string>;
export function execute(g:Graph,data:{email:string,nama:string,catatan?:string},answers:ConnectorAnswers={}) {
  validate(g,true);
  const fields: RunFields={nama:data.nama,email:data.email,catatan:data.catatan??"",hasil:""};
  let n:Step|undefined=g.nodes.find(n=>n.kind==="trigger");
  const trace:{id:string,name:string,detail:string}[]=[];
  let confirmation="", review="";
  while(n) {
    let port:Port="out",detail="Formulir diterima";
    const entry=directoryByKind.get(n.kind);
    if(entry) {
      if(!Object.hasOwn(answers,n.id)) {
        const pending:ConnectorRequest={id:n.id,kind:n.kind,name:n.name,server:n.kind===customKind?n.value:entry.server,
          task:renderMessage(n.message,fields),openUrl:entry.openUrl,source:entry.source};
        return {trace,confirmation,review,hasil:fields.hasil,pending};
      }
      const answer=answers[n.id];
      if(typeof answer!=="string"||!answer.trim()||answer.length>8000) throw Error("Hasil konektor harus berisi 1–8.000 karakter.");
      fields.hasil=answer;
      detail="Hasil diteruskan: "+answer.slice(0,180);
    } else if(n.kind==="condition") {
      const v=fields[n.field].trim();
      const ok=n.operator==="filled"?!!v:n.operator==="empty"?!v:v===n.value;
      port=ok?"yes":"no";detail=ok?"Cabang Ya":"Cabang Tidak";
    } else if(n.kind==="confirm"){confirmation=renderMessage(n.message,fields);detail="Konfirmasi pada formulir";}
    else if(n.kind==="review"){review=renderMessage(n.message,fields);detail="Ditandai untuk review";}
    else if(n.kind!=="trigger") {
      const plugin=pluginById.get(n.kind)!;
      try {
        if(plugin.parameter && !n.value.length) throw Error("Isi "+plugin.parameter.label.toLowerCase()+".");
        if(plugin.check) {
          port=plugin.check(fields[n.field],n.value)?"yes":"no";
          detail=port==="yes"?"Cabang Ya":"Cabang Tidak";
        } else {
          const output=plugin.transform?plugin.transform(fields[n.field],n.value):renderMessage(n.message,fields);
          if(output.length>8000) throw Error("Hasil melebihi 8.000 karakter.");
          fields.hasil=output;
          detail=output.length>200?output.slice(0,200)+"…":output||"(hasil kosong)";
        }
      } catch(error) { throw Error(n.name+" — "+(error as Error).message); }
    }
    trace.push({id:n.id,name:n.name,detail});
    const target=g.edges.find(e=>e.from===n!.id&&e.port===port)?.to;
    n=g.nodes.find(s=>s.id===target);
  }
  return {trace,confirmation,review,hasil:fields.hasil,pending:null};
}
