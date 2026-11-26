import {useEffect,useRef,useState} from "react";
import AgentStudio from "./AgentStudio";
import MachineStudio from "./MachineStudio";
import SettingsStudio,{readStart} from "./SettingsStudio";
import HomeStudio from "./HomeStudio";
import "./home.css";
function workspaceMode():string{const value=new URLSearchParams(window.location.search).get("mode");if(value==="editor"||value==="lokal"||value==="atur"||value==="beranda"||value==="agen")return value;if(value)return "agen";return readStart()}
import {Play,ChevronRight,ChevronDown,X,Workflow,Save,Clock3,SlidersHorizontal,Plus,ExternalLink,Trash2,Link2,Check,GitBranch,FolderOpen,LogIn,Unplug,Users,Settings2,House,Cpu,Network,TriangleAlert} from "lucide-react";
import PromptPanel from "./PromptPanel";
import HrdPanel from "./HrdPanel";
import CustomAgentPanel from "./CustomAgentPanel";
import {applyHiring} from "./hrd";
import {validate} from "./flow";
import {Canvas,Mark,typeName} from "./canvas";
import {initial,step,usesNotes,singleField,type Graph,type Step,type Kind} from "./flow";
import {alurBase,alurForm} from "./paths";
import {api} from "./api";
import RunForm from "./RunForm";
import TestReport from "./TestReport";
import type {Assignment} from "./flow";
import {directoryByKind,customKind} from "./directory";
import StepCatalog from "./StepCatalog";
import {fieldLabels,pluginById} from "./plugins";
import {agentByKind} from "./organization";
import {organizationGraph,organizationId} from "./organization-graph";
import {productionGraph,productionId} from "./production-machine";
const templates=[
 {id:organizationId,name:"Organisasi 57 agent",help:"Bagan lengkap: Orchestrator → 7 kepala divisi → staf",build:organizationGraph,loaded:"Organisasi 57 agent dimuat. Ketuk kotak agent untuk melihat kartu perannya."},
 {id:productionId,name:"Produksi mesin 3D",help:"Cukup tulis merk dan tipe · Direktur → 4 divisi → staf",build:productionGraph,loaded:"Bagan produksi mesin 3D dimuat. Ketuk Uji alur, lalu tulis merk dan tipe mesin."},
];
const templateIds=new Set(templates.map(t=>t.id));
import AgentCard from "./AgentCard";
import {Monitor,ProduceForm,useProductionMonitor} from "./ProductionLink";
function FieldSelect({node,edit}:{node:Step,edit:(change:Partial<Step>)=>void}) {
 return <label>Kolom masukan<select value={node.field} onChange={e=>edit({field:e.target.value as Step["field"]})}>
   {Object.entries(fieldLabels).map(([value,name])=><option key={value} value={value}>{name}</option>)}
 </select></label>
}
const templateHint="Sisipkan {nama}, {email}, {catatan}, atau {hasil} ke dalam pesan.";
type Trace={id:string,name:string,detail:string}[];
type Run={id:string,created:string,mode:string,trace:Trace,result:{email:string,nama:string,confirmation:string,review:string,hasil?:string,warnings?:string[],recruit?:(string|{title:string,summary?:string})[],assignments?:Assignment[],rules?:string[]}};
type Sheet="add"|"test"|"library"|"login"|"history"|null;
const localKey="alur.workflow.drafts.v1";
function drafts():Graph[]{try{return JSON.parse(localStorage.getItem(localKey)||"[]")}catch{return []}}
function keep(g:Graph){localStorage.setItem(localKey,JSON.stringify([g,...drafts().filter(x=>x.id!==g.id)]))}
export default function App(){
 const [mode,setMode]=useState(workspaceMode),[authReady,authReadySet]=useState(false);
 const [order,setOrder]=useState(""),[prefill,setPrefill]=useState<{brand:string,model:string,key:number}|null>(null),[focus,setFocus]=useState<{id:string,key:number}|null>(null);
 const dialogRef=useRef<HTMLElement|null>(null);
 function switchMode(next:string){setMode(next);const url=new URL(window.location.href);url.searchParams.set("mode",next);window.history.pushState({},"",url)}
 useEffect(()=>{const changed=()=>setMode(workspaceMode());window.addEventListener("popstate",changed);return()=>window.removeEventListener("popstate",changed)},[]);
 const [g,G]=useState<Graph>(initial),[ready,R]=useState(false),[selected,S]=useState<string|null>("check"),[sheet,M]=useState<Sheet>(null),[toast,T]=useState(""),[signed,A]=useState(false),[busy,B]=useState(false),[dirty,D]=useState(false),[trace,Tr]=useState<Trace>([]),[rows,L]=useState<{id:string,name:string}[]>([]),[hist,J]=useState<Run[]>([]),[message,E]=useState(""),[mobilePanel,MP]=useState(false),[newName,N]=useState(""),[tab,Tab]=useState("Pengaturan"),[warn,Wn]=useState<string[]>([]),[recruit,Rc]=useState<{title:string,summary:string}[]>([]),[assign,As]=useState<Assignment[]>([]),[rules,Ru]=useState<string[]>([]);
 const n=g.nodes.find(s=>s.id===selected);
 const entry=n&&directoryByKind.get(n.kind);
 const plugin=n&&pluginById.get(n.kind);
 const agent=n&&agentByKind.get(n.kind);
 useEffect(()=>{const all=drafts();if(all[0]){G(all[0]);S(all[0].nodes.find(x=>x.kind==="condition")?.id??all[0].nodes[0].id)}R(true);api("session").then(v=>A(v.signedIn)).catch(()=>{}).finally(()=>authReadySet(true))},[]);
 useEffect(()=>{if(ready){const t=setTimeout(()=>{try{keep(g)}catch{T("Penyimpanan perangkat penuh.")}},300);return()=>clearTimeout(t)}},[g,ready]);
 useEffect(()=>{if(toast){const t=setTimeout(()=>T(""),3500);return()=>clearTimeout(t)}},[toast]);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==="Escape"){M(null);MP(false)}};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k)},[]);
 useEffect(()=>{
  if(!sheet)return;
  const prior=document.activeElement as HTMLElement|null;
  const modal=dialogRef.current;if(!modal)return;
  const elements=()=>Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
  const frame=requestAnimationFrame(()=>{(modal.querySelector<HTMLElement>("input")||elements()[0])?.focus()});
  const trap=(event:KeyboardEvent)=>{if(event.key!=="Tab")return;const nodes=elements(),first=nodes[0],last=nodes[nodes.length-1];if(!first){event.preventDefault();modal.focus();return}if(event.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){event.preventDefault();last.focus()}else if(!event.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){event.preventDefault();first.focus()}};
  modal.addEventListener("keydown",trap);
  return()=>{cancelAnimationFrame(frame);modal.removeEventListener("keydown",trap);if(prior?.isConnected)prior.focus()};
 },[sheet]);
 function update(next:Graph){G(next);D(true);Tr([])}
 function edit(v:Partial<Step>){if(n)update({...g,nodes:g.nodes.map(x=>x.id===n.id?{...x,...v}:x)})}
 // Agent HRD dengan rekrut otomatis memasang agent yang dibutuhkan prompt setelah pengguna berhenti mengetik.
 function hire(only?:string){const r=applyHiring(g,only);if(!r.added.length&&!r.created.length)return;try{validate(r.graph);update(r.graph);T(["Agent HRD",r.added.length?"menambahkan: "+r.added.join(", "):"",r.created.length?"membuat agent baru: "+r.created.join(", "):""].filter(Boolean).join(" · ").replace("HRD · ","HRD "))}catch(e){T("Agent HRD tidak bisa menambahkan agent: "+(e as Error).message)}}
 useEffect(()=>{if(!ready||mode!=="editor"||!g.nodes.some(x=>x.kind==="hrd"))return;const t=setTimeout(()=>hire(),900);return()=>clearTimeout(t)},[g,ready,mode]);
 function select(id:string){S(id);MP(true);Tab("Pengaturan")}
 function open(s:Sheet){M(s);E("");if(s==="library"){keep(g);L(drafts());if(signed)api("flows").then((cloud:{id:string,name:string}[])=>L([...cloud,...drafts().filter(x=>!cloud.some(c=>c.id===x.id))])).catch(e=>E(e.message))}
 if(s==="history"){J([]);if(signed)api("flows?id="+g.id+"&history=1").then(J).catch(e=>E(e.message));else {try{J(JSON.parse(localStorage.getItem("alur.runs."+g.id)||"[]"))}catch{}}}}
 async function save(){if(!signed){keep(g);open("login");return}B(true);try{const saved=await api("flows",{action:"save",graph:g});G(saved);D(false);T("Workflow tersimpan di Supabase.")}catch(e){T((e as Error).message)}finally{B(false)}}
 function add(kind:Kind,custom?:{name:string,value:string}){if(g.nodes.length>=80){T("Maksimum 80 langkah per workflow.");return}const p=step(kind,crypto.randomUUID(),345+(g.nodes.length%3)*42,45+(g.nodes.length%4)*24);if(custom)Object.assign(p,custom);update({...g,nodes:[...g.nodes,p]});S(p.id);MP(true);M(null);Tab("Pengaturan")}
 function openTemplate(t:typeof templates[number]){if(drafts().some(d=>d.id===t.id)||rows.some(r=>r.id===t.id)){access(t.id);return}keep(g);const v=t.build();update(v);S(null);MP(false);M(null);T(t.loaded)}
 async function access(id:string){B(true);try{let v=drafts().find(d=>d.id===id);if(signed){try{v=await api("flows?id="+id)}catch(e){if(!v)throw e}}if(!v)throw Error("Workflow tidak ditemukan.");G(v);S(v.nodes[0].id);Tr([]);D(false);M(null)}catch(e){E((e as Error).message)}finally{B(false)}}
 const production=useProductionMonitor(mode==="editor"&&signed&&g.id===productionId);
 return <main className="studio"><header><div className="brand"><Link2 strokeWidth={2.8}/>Alur</div><nav className="studio-mode-nav" aria-label="Mode workspace"><button aria-pressed={mode==="beranda"} onClick={()=>switchMode("beranda")}>Beranda</button><button aria-pressed={mode==="agen"} onClick={()=>switchMode("agen")}>Mesin</button><button aria-pressed={mode==="editor"} onClick={()=>switchMode("editor")}>Bagan</button><button className="settings-nav" aria-pressed={mode==="atur"} aria-label="Pengaturan" title="Pengaturan" onClick={()=>switchMode("atur")}><Settings2 size={17}/><span>Pengaturan</span></button>{mode==="lokal"&&<span className="machine-local-nav">Proyek lokal</span>}</nav>{mode==="editor"&&<><span className="divider"/><button className="crumb" onClick={()=>open("library")}>Workflow saya</button><ChevronRight size={15} className="muted crumb-arrow"/><button className="current" onClick={()=>open("library")}>{g.name}</button><span className="badge">{g.revision&&!dirty?"Tersimpan":"Draf"}</span><div className="header-actions"><button className="icon" title="Riwayat eksekusi" aria-label="Riwayat eksekusi" onClick={()=>open("history")}><Clock3 size={18}/></button><button className="icon" aria-label="Simpan workflow" title="Simpan workflow" onClick={save} disabled={busy}><Save size={18}/></button><button className="primary" onClick={()=>open("test")}><Play size={16} fill="currentColor"/>Uji alur</button></div></>}</header>
 <div className="body" hidden={mode!=="editor"} style={mode!=="editor"?{display:"none"}:undefined}><Canvas g={g} selected={selected} select={select} update={update} add={()=>open("add")} notify={T} trace={trace.map(t=>t.id)} organization={()=>open("library")} badges={production.badges} monitor={<Monitor {...production}/>}/>
 {n&&<aside className={mobilePanel?"panel mobile-open":"panel"}><div className="panel-head"><div><SlidersHorizontal size={17}/>Detail langkah</div><button aria-label="Tutup detail" onClick={()=>{S(null);MP(false)}}><X size={17}/></button></div><div className="panel-scroll"><div className="panel-title"><Mark kind={n.kind}/><div><small>{typeName(n.kind)}</small><h1>{agent?agent.name:n.kind==="prompt"?"Agent prompt":n.kind==="router"?"Pembagi tugas":n.kind==="hrd"?"Agent HRD":n.kind==="custom-agent"?n.name:n.kind==="condition"?"Atur kondisi":n.kind==="trigger"?"Atur pemicu":"Atur aksi"}</h1></div></div>
 <div className="tabs">{["Pengaturan","Koneksi"].map(k=><button key={k} className={tab===k?"on":""} onClick={()=>Tab(k)}>{k}</button>)}</div>
 {tab==="Pengaturan"?<><label>Nama langkah<input maxLength={80} value={n.name} onChange={e=>edit({name:e.target.value})}/></label>
 {n.kind==="condition"?<><FieldSelect node={n} edit={edit}/><label>Kondisi<select value={n.operator} onChange={e=>edit({operator:e.target.value as Step["operator"]})}><option value="filled">Terisi</option><option value="empty">Kosong</option><option value="equals">Sama dengan</option></select></label>{n.operator==="equals"&&<label>Nilai<input maxLength={400} value={n.value} onChange={e=>edit({value:e.target.value})}/></label>}
 <div className="branch-info"><GitBranch size={16}/><div><strong>Percabangan</strong><p>Data mengikuti jalur Ya jika kondisi terpenuhi.</p></div></div></>:entry?<><p>{entry.help}</p>
 <a target="_blank" rel="noreferrer" href={entry.source}>{entry.group==="Plugin Claude Code"?"Petunjuk plugin":"Dokumentasi resmi"}</a>
 {n.kind===customKind?<label>URL server MCP<input type="url" maxLength={400} value={n.value} onChange={e=>edit({value:e.target.value})}/></label>:entry.server&&<p className="plugin-help"><code>{entry.server}</code></p>}
 <label>Tugas untuk langkah ini<textarea value={n.message} onChange={e=>edit({message:e.target.value})} maxLength={1000} placeholder="Misalnya, cari dokumen sesuai {catatan}"/><small>{templateHint}</small></label>
 <p className="plugin-help">{entry.group==="Plugin Claude Code"?"Jalankan plugin di Claude Code, lalu masukkan hasil saat alur meminta.":"Saat alur berjalan, pilih alat MCP atau teruskan hasil dari Claude."}</p></>:n.kind==="prompt"||n.kind==="router"?<PromptPanel key={n.id} g={g} node={n} edit={edit}/>:n.kind==="custom-agent"?<CustomAgentPanel node={n} edit={edit}/>:n.kind==="hrd"?<HrdPanel g={g} node={n} edit={edit} hire={()=>hire(n.id)}/>:agent?<><AgentCard agent={agent}/><label>Tugas untuk agent ini<textarea value={n.message} onChange={e=>edit({message:e.target.value})} maxLength={1000} placeholder="Misalnya, kumpulkan parts catalog untuk {catatan}"/><small>{templateHint}</small></label></>:plugin?<><p className="plugin-help">{plugin.help}</p>
 {plugin.template===undefined?<FieldSelect node={n} edit={edit}/>:<label>Format laporan<textarea value={n.message} maxLength={1000} onChange={e=>edit({message:e.target.value})}/></label>}
 {plugin.parameter&&<label>{plugin.parameter.label}<textarea maxLength={400} value={n.value} onChange={e=>edit({value:e.target.value})}/></label>}
 <p className="plugin-help">{plugin.template&&templateHint+" "}{plugin.check?"Hubungkan cabang Ya dan Tidak.":"Langkah berikutnya dapat membaca kolom Hasil robot terakhir."}</p></>:n.kind==="trigger"?<div className="info"><p>{singleField(g)?"Formulir hanya meminta satu kolom: "+singleField(g)+".":"Formulir memuat kolom nama dan email"+(usesNotes(g)?", serta catatan":"")+"."} Simpan workflow untuk membukanya.</p>{g.revision>0&&<a href={alurForm+"?id="+encodeURIComponent(g.id)} target="_blank" rel="noreferrer">Buka formulir <ExternalLink size={14}/></a>}</div>:<label>{n.kind==="confirm"?"Pesan pada halaman konfirmasi":"Catatan review"}<textarea value={n.message} maxLength={1000} onChange={e=>edit({message:e.target.value})}/><small>{templateHint}</small></label>}</>:<div className="connections">{g.edges.filter(e=>e.from===n.id||e.to===n.id).map(e=><div key={e.from+e.port+e.to}><span>{g.nodes.find(x=>x.id===(e.to===n.id?e.from:e.to))?.name}<small>{e.to===n.id?"Masuk":e.port==="out"?"Keluar":e.port==="yes"?"Cabang Ya":"Cabang Tidak"}</small></span><button aria-label="Putus sambungan" onClick={()=>update({...g,edges:g.edges.filter(x=>x!==e)})}><Unplug size={16}/></button></div>)}<p>Hubungkan titik keluar ke titik masuk di kanvas.</p></div>}</div>
 {n.kind!=="trigger"&&<div className="panel-foot"><button onClick={()=>{update({...g,nodes:g.nodes.filter(x=>x.id!==n.id),edges:g.edges.filter(e=>e.from!==n.id&&e.to!==n.id)});S(null);MP(false)}}><Trash2 size={15}/>Hapus langkah</button></div>}</aside>}</div>
 {mode==="beranda"&&<HomeStudio signed={signed} authReady={authReady} onLogin={()=>open("login")} onAuthExpired={()=>A(false)} onOpenSession={id=>{setFocus({id,key:Date.now()});switchMode("agen")}} onOpen={m=>switchMode(m)}/>}
 {mode==="agen"&&<MachineStudio key={focus?.key} focus={focus} prefill={prefill} onPrefillUsed={()=>setPrefill(null)} signed={signed} authReady={authReady} onLogin={()=>open("login")} onAuthExpired={()=>A(false)} onLocal={()=>switchMode("lokal")}/>}
 {mode==="atur"&&<SettingsStudio signed={signed} onLogin={()=>open("login")} onAuthExpired={()=>A(false)} onOpen={m=>switchMode(m)} onLogout={async()=>{try{await api("session",{action:"logout"});A(false);window.location.reload()}catch(e){E((e as Error).message)}}}/>}
 {mode==="lokal"&&<AgentStudio signed={signed} authReady={authReady} onLogin={()=>open("login")} onAuthExpired={()=>A(false)}/>}
 <footer>{alurBase!=="/"&&<a href="/">Pelaut Jago Mesin</a>}<span><i className={'status '+(signed?'online':'')}/>{signed?"Terhubung ke cloud":"Draf perangkat"}</span><button onClick={()=>open(signed?"library":"login")}>{signed?<FolderOpen size={14}/>:<LogIn size={14}/>} {signed?"Workflow saya":"Masuk ke cloud"}</button></footer>
 <nav className="bottom-nav" aria-label="Menu utama">{([["beranda","Beranda",House],["agen","Mesin",Cpu],["editor","Bagan",Network],["atur","Atur",Settings2]] as const).map(([key,label,Icon])=><button key={key} aria-current={mode===key||(key==="agen"&&mode==="lokal")?"page":undefined} onClick={()=>switchMode(key)}><Icon size={21}/><span>{label}</span></button>)}</nav>
 {toast&&<div className="toast" role="status">{toast}</div>}
 {sheet&&<div className="backdrop" onClick={()=>!busy&&M(null)}><section ref={dialogRef} tabIndex={-1} className={sheet==="add"?"modal catalog-modal":"modal"} role="dialog" aria-modal="true" aria-label={{add:"Tambah langkah",test:"Uji alur",history:"Riwayat eksekusi",library:"Workflow saya",login:"Masuk ke cloud"}[sheet]} onClick={e=>e.stopPropagation()}><div className="modal-head"><h2>{{add:"Tambah langkah",test:"Uji alur",history:"Riwayat eksekusi",library:"Workflow saya",login:"Masuk ke cloud"}[sheet]}</h2><button aria-label="Tutup" disabled={busy} onClick={()=>M(null)}><X size={19}/></button></div>{message&&<p className="error" role="alert">{message}</p>}
 {sheet==="add"&&<StepCatalog add={add}/>}
 {sheet==="login"&&<form onSubmit={async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));B(true);try{await api("session",{action:"login",...data});A(true);M(null);T(mode==="agen"||mode==="beranda"?"Berhasil masuk. Anda dapat mengantrekan produksi mesin.":"Berhasil masuk. Klik Simpan untuk menyimpan workflow ini.")}catch(e){E((e as Error).message)}finally{B(false)}}}><p>Gunakan akun email dan kata sandi Pelaut Jago Mesin untuk mengakses workspace dan pekerjaan agen.</p><label>Email<input required type="email" autoComplete="username" name="email"/></label><label>Kata sandi<input required type="password" autoComplete="current-password" name="password"/></label><button className="primary" disabled={busy}>Masuk</button></form>}
 {sheet==="test"&&<><RunForm graph={g} mode="test" cloud={signed} onStart={()=>{Tr([]);Wn([]);Rc([]);As([]);Ru([]);setOrder("")}} onComplete={(result,data)=>{
   Tr(result.trace);Wn(result.warnings??[]);Rc(result.recruit??[]);As(result.assignments??[]);Ru(result.rules??[]);
   setOrder(g.id===productionId&&result.trace.some(t=>t.id==="laporan")?data.catatan.trim():"");
   if(!signed){const key="alur.runs."+g.id;try{const old=JSON.parse(localStorage.getItem(key)||"[]");localStorage.setItem(key,JSON.stringify([{id:crypto.randomUUID(),mode:"test",created:new Date().toISOString(),trace:result.trace,result:{...data,...result}},...old].slice(0,50)))}catch{T("Riwayat perangkat penuh.")}}
 }}/>{recruit.length>0&&<div className="prompt-warning trace-warnings" role="alert"><h3><TriangleAlert size={15}/>Agent HRD sedang mencari {recruit.length} agent untuk direkrut</h3><ul>{recruit.map(v=><li key={v.title+v.summary}><strong>{v.title}</strong> — {v.summary}</li>)}</ul></div>}{warn.length>0&&<div className="prompt-warning trace-warnings" role="alert"><h3><TriangleAlert size={15}/>Peringatan prompt: tidak cocok atau tidak terbaca</h3><ul>{warn.map(w=><li key={w}>{w.replace(/^Tidak ada agent yang cocok untuk: /,"")}</li>)}</ul></div>}<TestReport flow={g.name} assignments={assign} warnings={warn} recruit={recruit} rules={rules}/>{trace.length>0&&<div className="trace"><h3>Hasil eksekusi</h3>{trace.map(t=><div key={t.id}><Check size={14}/><span>{t.name}<small>{t.detail}</small></span></div>)}</div>}{order&&<ProduceForm key={order} text={order} onSend={m=>{setPrefill({...m,key:Date.now()});setOrder("");M(null);switchMode("agen")}}/>}</>}
 {sheet==="history"&&<div>{hist.length===0?<p>Belum ada eksekusi untuk workflow ini.</p>:hist.map(h=><details key={h.id}><summary>{h.mode==="test"?"Uji alur":"Formulir masuk"} · {new Date(h.created).toLocaleString("id-ID")}</summary><p>{h.trace.map(t=>t.name).join(" › ")}</p><p>{h.result.nama} {h.result.email}</p><p>{h.result.review||h.result.confirmation}</p>{h.result.assignments?.length?<TestReport flow={g.name} assignments={h.result.assignments} warnings={h.result.warnings??[]} recruit={(h.result.recruit??[]).map(v=>typeof v==="string"?{title:v}:v)} rules={h.result.rules??[]}/>:h.result.hasil&&<pre className="robot-output">{h.result.hasil}</pre>}</details>)}</div>}
 {sheet==="library"&&<><label>Nama workflow aktif<input value={g.name} maxLength={80} onChange={e=>update({...g,name:e.target.value})}/></label>{templates.map(t=><button className="listitem template-item" key={t.id} onClick={()=>openTemplate(t)} disabled={busy}><Users size={20}/><span>{t.name}<small>{t.help}</small></span><ChevronRight size={16}/></button>)}{rows.filter(x=>!templateIds.has(x.id)).map(x=><button className="listitem" key={x.id} onClick={()=>access(x.id)} disabled={busy}><Workflow size={20}/>{x.id===g.id?g.name:x.name}<ChevronRight size={16}/></button>)}<form className="new" onSubmit={e=>{e.preventDefault();keep(g);const v=initial();v.id=crypto.randomUUID();v.name=newName.trim();v.nodes=[v.nodes[0]];v.edges=[];update(v);S(v.nodes[0].id);N("");M(null)}}><label>Workflow baru<input required maxLength={80} value={newName} onChange={e=>N(e.target.value)} placeholder="Nama workflow"/></label><button className="secondary" disabled={!newName.trim()}><Plus size={16}/>Buat workflow</button></form>{signed&&<button className="logout" onClick={async()=>{try{await api("session",{action:"logout"});A(false);window.location.reload()}catch(e){E((e as Error).message)}}}>Keluar dari akun</button>}</>}
 </section></div>}</main>
}
