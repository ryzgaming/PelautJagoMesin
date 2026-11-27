import {fieldLabels, pluginById, renderMessage, type Field, type RunFields} from "./plugins.ts";

import {customKind,directoryByKind,validServer,type DirectoryKind} from "./directory.ts";
import {agentByKind,divisionByKey,type AgentKind} from "./organization.ts";
import {customAgentKind,delegates,droppedTasks,promptRules,hrdKind,promptKind,promptMax,routerKind,routePrompt,routerTargets,hrdRouters,structureKind,taskMax,maxSteps,maxEdges} from "./prompt-router.ts";
export {maxSteps,maxEdges};
import {review as hrdReview,type Vacancy} from "./hrd.ts";
import {checklist,gathers,packageResults,producerKind,reviewMessage,type Input,type Review} from "./gather.ts";
export type {Review} from "./gather.ts";
import {machineKind,machineMax,machinePrompt,withMachine} from "./machine.ts";
export type Kind = DirectoryKind | AgentKind | `robot-${string}` | "trigger" | "condition" | "confirm" | "review" | "prompt" | "router" | "hrd" | "struktur" | "custom-agent" | "himpun" | "produksi" | "mesin";
export type Step = {id:string, kind:Kind, name:string, x:number, y:number, field:Field, operator:"filled"|"empty"|"equals", value:string, message:string};
export type Port = "out" | "yes" | "no";
export type Edge = {from:string, port:Port, to:string};
export type Graph = {id:string, name:string, revision:number, nodes:Step[], edges:Edge[]};
export const baseLabels = {trigger:"Formulir masuk",condition:"Kondisi",confirm:"Kirim konfirmasi",review:"Tandai untuk review",prompt:"Agent prompt",router:"Pembagi tugas",hrd:"Agent HRD",struktur:"Agent Struktur","custom-agent":"Agent baru",himpun:"Penghimpun",produksi:"Agen Produksi",mesin:"Agent Mesin"};
export function label(kind:Kind) { return directoryByKind.get(kind)?.name ?? pluginById.get(kind)?.name ?? agentByKind.get(kind)?.short ?? baseLabels[kind as keyof typeof baseLabels]; }
export function branches(kind:Kind) { return kind==="condition" || !!pluginById.get(kind)?.check; }
/** Label kolom catatan bila pemicu meminta formulir satu kolom (misalnya "Merk dan tipe mesin"). */
export function singleField(g:Graph) { const t=g.nodes.find(n=>n.kind==="trigger"); return t?.field==="catatan"&&t.value.trim()?t.value.trim():""; }
export function usesNotes(g:Graph) {
  return g.nodes.some(n => (n.kind!=="trigger"&&n.field==="catatan") || n.message.includes("{catatan}") || (n.kind===promptKind&&!n.message.trim())) || !!singleField(g);
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
  if(!g||!id(g.id)||typeof g.name!=="string"||!g.name.trim()||g.name.length>80||!Number.isInteger(g.revision)||g.revision<0||!Array.isArray(g.nodes)||!Array.isArray(g.edges)||g.nodes.length>maxSteps||g.edges.length>maxEdges) throw Error("Data workflow tidak valid.");
  const ids=new Set<string>();
  for(const n of g.nodes){
    if(!id(n.id)||ids.has(n.id)||(!Object.hasOwn(baseLabels,n.kind)&&!pluginById.has(n.kind)&&!directoryByKind.has(n.kind)&&!agentByKind.has(n.kind))||!Number.isFinite(n.x)||!Number.isFinite(n.y)||typeof n.name!=="string"||!n.name.trim()||n.name.length>80||!Object.hasOwn(fieldLabels,n.field)||!["filled","empty","equals"].includes(n.operator)||typeof n.value!=="string"||n.value.length>400||typeof n.message!=="string"||n.message.length>(n.kind===promptKind?promptMax:n.kind===customAgentKind?promptMax:1000)) throw Error("Periksa konfigurasi langkah.");
    if(n.kind===customKind&&!validServer(n.value)) throw Error("Periksa URL HTTPS server MCP.");
    if(n.kind===customAgentKind&&n.value&&!divisionByKey.has(n.value)) throw Error("Periksa divisi Agent baru.");
    ids.add(n.id);
  }
  const triggers=g.nodes.filter(n=>n.kind==="trigger");
  if(triggers.length!==1) throw Error("Workflow membutuhkan satu pemicu formulir.");
  const ports=new Set<string>();
  for(const e of g.edges) {
    const n=g.nodes.find(x=>x.id===e.from);
    const key=e.from+"/"+e.port+"/"+e.to;
    if(!n||!ids.has(e.to)||e.to===triggers[0].id||!(branches(n.kind)?["yes","no"]:["out"]).includes(e.port)||ports.has(key)) throw Error("Sambungan tidak valid.");
    ports.add(key);
  }
  const producers=g.nodes.filter(n=>n.kind===producerKind);
  if(producers.length>1) throw Error("Bagan hanya boleh memiliki satu Agen Produksi.");
  if(g.nodes.filter(n=>n.kind===machineKind).length>1) throw Error("Bagan hanya boleh memiliki satu Agent Mesin.");
  if(g.nodes.some(n=>n.kind===machineKind&&n.value.length>machineMax)) throw Error("Nama mesin maksimal "+machineMax+" karakter.");
  if(producers.some(p=>g.edges.some(e=>e.from===p.id))) throw Error("Agen Produksi harus menjadi langkah terakhir; lepas sambungan keluarnya.");
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
    if(run && branches(n.kind) && (!g.edges.some(e=>e.from===n.id&&e.port==="yes")||!g.edges.some(e=>e.from===n.id&&e.port==="no"))) throw Error("Hubungkan kedua cabang kondisi, Ya dan Tidak.");
  }
}
export type ConnectorRequest={id:string,kind:Kind,name:string,server?:string,task:string,openUrl:string,source:string};
export type ConnectorAnswers=Record<string,string>;
export type Assignment={id:string,name:string,tasks:string[]};
export function execute(g:Graph,data:{email:string,nama:string,catatan?:string},answers:ConnectorAnswers={}) {
  validate(g,true);
  const fields: RunFields={nama:data.nama,email:data.email,catatan:data.catatan??"",hasil:""};
  // Tiap langkah menerima hasil langkah sebelumnya; cabang bersaudara masing-masing mendapat hasil yang sama.
  // Langkah dengan beberapa sambungan masuk menunggu semua langkah asalnya selesai (atau dilewati),
  // lalu menerima hasil semuanya sekaligus. Penghimpun dan Agen Produksi bergantung pada aturan ini.
  const stack:Step[]=[g.nodes.find(n=>n.kind==="trigger")!], done=new Set<string>();
  const incoming=new Map<string,Edge[]>(), inputs=new Map<string,Input[]>(), fired=new Map<string,boolean>();
  for(const e of g.edges) incoming.set(e.to,[...(incoming.get(e.to)??[]),e]);
  const edgeKey=(e:Edge)=>e.from+"/"+e.port+"/"+e.to;
  const nodeOf=(id:string)=>g.nodes.find(x=>x.id===id)!;
  // Putuskan satu sambungan (mengalir atau tidak). Langkah tujuan siap setelah semua sambungan masuknya diputuskan;
  // bila tidak ada yang mengalir, langkah itu dilewati dan sambungan keluarnya ikut tidak mengalir.
  const decide=(e:Edge,on:boolean,from:Step,hasil:string,ready:Step[])=>{
    fired.set(edgeKey(e),on);
    if(on) inputs.set(e.to,[...(inputs.get(e.to)??[]),{id:from.id,name:from.name,hasil}]);
    const list=incoming.get(e.to)??[];
    if(!list.every(x=>fired.has(edgeKey(x)))) return;
    const to=nodeOf(e.to);
    if(list.some(x=>fired.get(edgeKey(x)))) ready.push(to);
    else for(const out of g.edges.filter(x=>x.from===to.id)) decide(out,false,to,"",ready);
  };
  const ran:{id:string,kind:string,name:string,message:string,hasil:string}[]=[];
  let production:{name:string,reviews:Review[]}|null=null;
  // Mesin yang ditulis di Agent Mesin: tujuan prompt dan konteks setiap agent sesudahnya.
  let machine="";
  const forMachine=()=>machine?" untuk "+machine:"";
  const trace:{id:string,name:string,detail:string}[]=[], warnings:string[]=[], rules:string[]=[], recruit:Vacancy[]=[], hires:string[]=[], prompts:string[]=[];
  const assigned=new Map<string,string[]>();
  // Struktur bercabang: anggota tim Pembagi tugas, dan yang aktif (punya tugas sendiri atau di cabangnya).
  const team=new Set<string>(), active=new Set<string>();
  const nameOf=(id:string)=>g.nodes.find(x=>x.id===id)?.name??id;
  const branch=(n:Step,own:string)=>{
    const down=g.edges.filter(e=>e.from===n.id&&team.has(e.to)&&active.has(e.to)).map(e=>nameOf(e.to));
    return down.length?"Kepala cabang: meneruskan tugas ke "+down.join(", ")+(assigned.has(n.id)?" · tugas sendiri: "+own.slice(0,120):""):"";
  };
  let confirmation="", review="";
  while(stack.length) {
    const n=stack.pop()!;
    if(done.has(n.id)) continue;
    done.add(n.id);
    const received=inputs.get(n.id)??[];
    fields.hasil=received.length?packageResults(received):"";
    let port:Port="out",detail="Formulir diterima",only:Set<string>|null=null;
    const given=assigned.get(n.id);
    if(given) fields.hasil=given.join("\n");
    const entry=directoryByKind.get(n.kind);
    if(entry) {
      if(!Object.hasOwn(answers,n.id)) {
        const pending:ConnectorRequest={id:n.id,kind:n.kind,name:n.name,server:n.kind===customKind?n.value:entry.server,
          task:renderMessage(n.message,fields)||(given?given.join("\n"):""),openUrl:entry.openUrl,source:entry.source};
        return {trace,confirmation,review,hasil:fields.hasil,warnings,recruit,hires,assignments:[] as Assignment[],rules,prompts,production,machine,pending};
      }
      const answer=answers[n.id];
      if(typeof answer!=="string"||!answer.trim()||answer.length>8000) throw Error("Hasil konektor harus berisi 1–8.000 karakter.");
      fields.hasil=answer;
      detail="Hasil diteruskan: "+answer.slice(0,180);
    } else if(gathers(n)) {
      const missing=(incoming.get(n.id)??[]).filter(e=>!fired.get(edgeKey(e))).map(e=>nameOf(e.from));
      detail=received.length>1?"Menghimpun hasil dari "+received.length+" langkah: "+received.map(i=>i.name).join(", "):"Menghimpun hasil dari "+(received[0]?.name??"langkah sebelumnya");
      if(missing.length) detail+=" · "+missing.length+" tidak mengirim hasil (tidak mendapat tugas): "+missing.join(", ");
    } else if(n.kind===producerKind) {
      const reviews=ran.map(r=>({id:r.id,name:r.name,checks:checklist(r),hasil:r.hasil}));
      production={name:n.name,reviews};
      const message=reviewMessage(n.name,reviews);
      review=review?review+"\n"+message:message;
      detail=reviews.length?"Memeriksa "+reviews.length+" agent dengan daftar periksa masing-masing · dikirim ke dashboard untuk ditinjau":"Belum ada hasil agent untuk diperiksa";
    } else if(n.kind===machineKind) {
      machine=n.value.trim();
      if(!machine) throw Error(n.name+" — tulis merek dan tipe mesin terlebih dahulu.");
      fields.hasil=machine;
      const told=g.nodes.filter(x=>delegates(x)).length;
      detail="Target mesin: "+machine+" · diberitahukan ke prompt"+(told?" dan "+told+" agent":"");
    } else if(agentByKind.has(n.kind)) {
      const agent=agentByKind.get(n.kind)!;
      const own=renderMessage(withMachine(n.message,machine),fields).trim();
      const task=given?[given.join("; "),own].filter(Boolean).join(" — "):own;
      if(task) fields.hasil=task;
      detail=(team.has(n.id)&&branch(n,task))||"Diserahkan ke "+agent.name+forMachine()+": "+(task||agent.mission).slice(0,180);
    } else if(n.kind===customAgentKind) {
      const task=given?given.join("; "):(n.message.match(/^- (.+)$/m)?.[1]??n.name);
      fields.hasil=task;
      detail=(team.has(n.id)&&branch(n,task))||"Diserahkan ke "+n.name+" (agent baru)"+forMachine()+": "+task.slice(0,180);
    } else if(n.kind===structureKind) {
      const heads=hrdRouters(g,n.id).flatMap(r=>routerTargets(g,r.id)).filter(t=>delegates(t)&&g.edges.some(e=>e.from===t.id&&delegates(g.nodes.find(x=>x.id===e.to)??{kind:""})));
      detail=heads.length?"Struktur "+heads.length+" cabang: "+heads.map(h=>h.name).join(", "):"Belum ada cabang; tugas dibagikan langsung ke agent";
    } else if(n.kind===promptKind) {
      // Prompt kosong setelah Agent Mesin memakai tugas produksi standar untuk mesin itu.
      const prompt=renderMessage(withMachine(n.message,machine),fields).trim()||(machine?machinePrompt(machine):"")||fields.catatan.trim();
      if(!prompt) throw Error(n.name+" — tulis prompt terlebih dahulu.");
      if(prompt.length>promptMax) throw Error(n.name+" — prompt melebihi "+promptMax.toLocaleString("id-ID")+" karakter.");
      fields.hasil=prompt;prompts.push(prompt);
      detail=(machine?"Prompt untuk membuat "+machine+": ":"Prompt diterima: ")+prompt.slice(0,180);
    } else if(n.kind===hrdKind) {
      const routers=hrdRouters(g,n.id);
      const targets=routers.flatMap(r=>routerTargets(g,r.id));
      const r=hrdReview(fields.hasil||fields.catatan,targets,g.nodes.filter(x=>!targets.some(t=>t.id===x.id)));
      for(const h of r.hires) if(!hires.includes(h.agent.short)) hires.push(h.agent.short);
      for(const v of r.vacancies) if(!recruit.some(x=>x.task===v.task)) recruit.push(v);
      detail=!routers.length?"Belum tersambung ke Pembagi tugas":!r.hires.length&&!r.vacancies.length?"Semua tugas sudah punya agent":
        [r.hires.length?"Perlu ditambahkan ke bagan: "+r.hires.map(h=>h.agent.short).join(", "):"",r.vacancies.length?"Mencari "+r.vacancies.length+" agent baru: "+r.vacancies.map(v=>v.title).join(", "):""].filter(Boolean).join(" · ");
    } else if(n.kind===routerKind) {
      const targets=routerTargets(g,n.id);
      if(!targets.length) throw Error(n.name+" — hubungkan ke setidaknya satu agent pelaksana.");
      const routing=routePrompt(fields.hasil||fields.catatan,targets);
      for(const a of routing.tasks) for(const id of a.targets) assigned.set(id,[...(assigned.get(id)??[]),a.task]);
      // Aktifkan agent yang mendapat tugas beserta atasannya di cabang, sampai ke Pembagi tugas.
      const members=new Set(targets.map(t=>t.id));
      for(const id of members) team.add(id);
      const up=(id:string)=>{if(active.has(id))return;active.add(id);for(const e of g.edges)if(e.to===id&&members.has(e.from))up(e.from);};
      for(const a of routing.tasks) for(const id of a.targets) up(id);
      for(const t of routing.unmatched) warnings.push("Tidak ada agent yang cocok untuk: "+t);
      for(const r of promptRules(fields.hasil||fields.catatan)) if(!rules.includes(r)) rules.push(r);
      const dropped=droppedTasks(fields.hasil||fields.catatan);
      if(dropped.length) warnings.push("Tidak terbaca: "+dropped.length+" tugas setelah tugas ke-"+taskMax+" tidak dibagikan, mulai dari \""+dropped[0].slice(0,120)+"\"");
      only=new Set(g.edges.filter(e=>e.from===n.id&&active.has(e.to)).map(e=>e.to));
      detail=routing.tasks.length+" tugas dibagikan ke "+new Set(routing.tasks.flatMap(a=>a.targets)).size+" agent"+(routing.unmatched.length?" · "+routing.unmatched.length+" tidak cocok":"");
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
    if((agentByKind.has(n.kind)||n.kind===customAgentKind)&&!gathers(n)) ran.push({id:n.id,kind:n.kind,name:n.name,message:n.message,hasil:fields.hasil});
    const flows=(e:Edge)=>e.port===port&&(!only||only.has(e.to))&&!(team.has(n.id)&&team.has(e.to)&&!active.has(e.to));
    const ready:Step[]=[];
    for(const e of g.edges.filter(e=>e.from===n.id)) decide(e,flows(e),n,fields.hasil,ready);
    for(const s of ready.reverse()) stack.push(s);
  }
  // Daftar lengkap tugas per agent untuk laporan uji (detail di jejak eksekusi dipotong).
  const assignments:Assignment[]=trace.filter(t=>assigned.has(t.id)).map(t=>({id:t.id,name:t.name,tasks:assigned.get(t.id)!}));
  return {trace,confirmation,review,hasil:fields.hasil,warnings,recruit,hires,assignments,rules,prompts,production,machine,pending:null as ConnectorRequest|null};
}
