import {useState} from "react";
import {Plus} from "lucide-react";
import {Mark,typeName} from "./canvas";
import {label,type Kind} from "./flow";
import {customKind,directory,validServer} from "./directory";
import {agentKind,agents,divisionByKey} from "./organization";

const groups=["Agen Orang Mesin","Konektor populer","Plugin Claude Code","Google Workspace","Langkah dasar"];
const items=[
  {kind:"prompt" as Kind,name:"Agent prompt",group:"Langkah dasar",help:"Penerima prompt · Menerima perintah tertulis; satu tugas per baris",publisher:undefined},
  {kind:"router" as Kind,name:"Pembagi tugas",group:"Langkah dasar",help:"Pembagi tugas · Memilah prompt dan menyerahkan tiap tugas ke agent yang cocok",publisher:undefined},
  {kind:"custom-agent" as Kind,name:"Agent baru",group:"Langkah dasar",help:"Agent kustom · Buat agent sendiri bila tidak ada di 57 agent Orang Mesin",publisher:undefined},
  {kind:"hrd" as Kind,name:"Agent HRD",group:"Langkah dasar",help:"Rekrutmen · Menambahkan agent yang dibutuhkan prompt dan membuka lowongan bila belum ada",publisher:undefined},
  {kind:"penghimpun" as Kind,name:"Agent Penghimpun",group:"Langkah dasar",help:"Penghimpun · Mengumpulkan hasil kerja semua agent menjadi satu prompt tertata dan profesional, siap disalin ke Claude atau Codex",publisher:undefined},
  {kind:"word" as Kind,name:"Agent Word",group:"Langkah dasar",help:"Dokumen Word · Menyusun hasil alur menjadi berkas Word (.docx) profesional: judul, ringkasan, tabel, daftar bernomor, nomor halaman",publisher:undefined},
  {kind:"struktur" as Kind,name:"Agent Struktur",group:"Langkah dasar",help:"Struktur · Menyusun agent di bawah Pembagi tugas menjadi cabang divisi (kepala → staf) secara otomatis",publisher:undefined},
  ...agents.map(a=>({kind:agentKind(a) as Kind,name:a.name,group:"Agen Orang Mesin",help:divisionByKey.get(a.division)!.short+" · "+a.mission,publisher:undefined})),
  ...directory.map(p=>({kind:`claude-${p.slug}` as Kind,name:p.name,group:p.group,help:p.help,publisher:p.publisher})),
  ...(["condition","confirm","review"] as const).map(kind=>({kind,name:label(kind),group:"Langkah dasar",help:typeName(kind),publisher:undefined}))
];
export default function StepCatalog({add}:{add:(kind:Kind,custom?:{name:string,value:string})=>void}) {
  const [query,setQuery]=useState(""),[group,setGroup]=useState(""),[custom,showCustom]=useState(false);
  const [name,setName]=useState(""),[server,setServer]=useState("");
  const terms=query.trim().toLocaleLowerCase("id").split(/\s+/).filter(Boolean);
  const matches=items.filter(p=>(!group||p.group===group)&&terms.every(term=>[p.name,p.group,p.help].join(" ").toLocaleLowerCase("id").includes(term)));
  if(custom) return <form onSubmit={e=>{e.preventDefault();if(name.trim()&&validServer(server.trim()))add(customKind,{name:name.trim(),value:server.trim()})}}>
    <h3>Tambah konektor kustom</h3>
    <label>Nama<input required autoFocus maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>URL server MCP<input required type="url" placeholder="https://contoh.com/mcp" maxLength={400} value={server} onChange={e=>setServer(e.target.value)}/></label>
    <p>Gunakan endpoint HTTPS tanpa kredensial. Token akses dapat diisi saat menjalankan langkah.</p>
    <button type="button" onClick={()=>showCustom(false)}>Kembali</button>
    <button className="primary" disabled={!name.trim()||!validServer(server.trim())}>Tambahkan ke alur</button>
  </form>;
  return <div className="catalog"><div className="catalog-tools">
    <label>Cari agent, konektor, atau plugin<input type="search" placeholder="Agent, Google Drive, Gmail…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <label>Kategori<select value={group} onChange={e=>setGroup(e.target.value)}>
    <option value="">Semua kategori</option>{groups.map(g=><option key={g}>{g}</option>)}</select></label></div>
    <div className="directory-bar"><a href="https://claude.com/marketplace/connectors-plugins" rel="noreferrer" target="_blank">Direktori resmi Claude</a>
    <button className="secondary" onClick={()=>showCustom(true)}><Plus size={16}/>Konektor kustom</button></div>
    <div className="catalog-results">{groups.map(g=>{
      const rows=matches.filter(p=>p.group===g);
      return rows.length>0&&<section key={g}><h3>{g}</h3><div className="catalog-grid">{rows.map(p=><button key={p.kind} className="listitem" onClick={()=>add(p.kind)}>
        <Mark kind={p.kind}/><span>{p.name}<small>{p.help}</small>{p.publisher&&<small>Oleh {p.publisher}</small>}</span><Plus size={16}/></button>)}</div></section>
    })}{!matches.length&&<p role="status">Tidak ada langkah yang cocok.</p>}</div>
  </div>
}
