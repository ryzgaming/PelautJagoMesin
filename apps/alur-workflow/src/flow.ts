export type Kind = "trigger" | "condition" | "confirm" | "review";
export type Step = {id:string, kind:Kind, name:string, x:number, y:number, field:"email"|"nama", operator:"filled"|"empty"|"equals", value:string, message:string};
export type Port = "out" | "yes" | "no";
export type Edge = {from:string, port:Port, to:string};
export type Graph = {id:string, name:string, revision:number, nodes:Step[], edges:Edge[]};
export const labels = {trigger:"Formulir masuk",condition:"Kondisi",confirm:"Kirim konfirmasi",review:"Tandai untuk review"};
export function step(kind:Kind,id:string,x:number,y:number):Step {
  return {kind,id,x,y,name:labels[kind],field:"email",operator:"filled",value:"",message: kind==="confirm"?"Terima kasih, formulir kamu sudah diterima.":"Perlu ditinjau"};
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
    if(!id(n.id)||ids.has(n.id)||!Object.hasOwn(labels,n.kind)||!Number.isFinite(n.x)||!Number.isFinite(n.y)||typeof n.name!=="string"||!n.name.trim()||n.name.length>80||!["email","nama"].includes(n.field)||!["filled","empty","equals"].includes(n.operator)||typeof n.value!=="string"||n.value.length>400||typeof n.message!=="string"||n.message.length>1000) throw Error("Periksa konfigurasi langkah.");
    ids.add(n.id);
  }
  const triggers=g.nodes.filter(n=>n.kind==="trigger");
  if(triggers.length!==1) throw Error("Workflow membutuhkan satu pemicu formulir.");
  const ports=new Set<string>();
  for(const e of g.edges) {
    const n=g.nodes.find(x=>x.id===e.from);
    const key=e.from+"/"+e.port;
    if(!n||!ids.has(e.to)||e.to===triggers[0].id||!(n.kind==="condition"?["yes","no"]:["out"]).includes(e.port)||ports.has(key)) throw Error("Sambungan tidak valid.");
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
    if(run && n.kind==="condition" && (!ports.has(n.id+"/yes")||!ports.has(n.id+"/no"))) throw Error("Hubungkan kedua cabang kondisi, Ya dan Tidak.");
  }
}
export function execute(g:Graph,data:{email:string,nama:string}) {
  validate(g,true);
  let n:Step|undefined=g.nodes.find(n=>n.kind==="trigger");
  const trace:{id:string,name:string,detail:string}[]=[];
  let confirmation="", review="";
  while(n) {
    let port:Port="out",detail="Formulir diterima";
    if(n.kind==="condition") {
      const v=data[n.field].trim();
      const ok=n.operator==="filled"?!!v:n.operator==="empty"?!v:v===n.value;
      port=ok?"yes":"no";detail=ok?"Cabang Ya":"Cabang Tidak";
    } else if(n.kind==="confirm"){confirmation=n.message;detail="Konfirmasi pada formulir";}
    else if(n.kind==="review"){review=n.message;detail="Ditandai untuk review";}
    trace.push({id:n.id,name:n.name,detail});
    const target=g.edges.find(e=>e.from===n!.id&&e.port===port)?.to;
    n=g.nodes.find(s=>s.id===target);
  }
  return {trace,confirmation,review};
}
