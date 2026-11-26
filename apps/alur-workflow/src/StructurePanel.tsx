import {Network} from "lucide-react";
import {type Graph,type Step} from "./flow";
import {structurePlan} from "./structure";

/** Panel Agent Struktur: pratinjau cabang divisi (kepala → staf) dari agent yang tersambung ke Pembagi tugas. */
export default function StructurePanel({g,node,edit,arrange}:{g:Graph,node:Step,edit:(change:Partial<Step>)=>void,arrange:()=>void}) {
  const plan=structurePlan(g,node.id);
  return <>
    <p className="plugin-help">Agent Struktur menyusun agent yang tersambung ke Pembagi tugas, termasuk agent yang ditambahkan Agent HRD, menjadi cabang per divisi: Pembagi tugas → kepala divisi → staf. Saat Uji alur, tugas mengalir turun lewat kepala divisi ke staf yang cocok.</p>
    <label className="hrd-toggle"><input type="checkbox" checked={plan.auto} onChange={e=>edit({value:e.target.checked?"":"manual"})}/>Susun otomatis</label>
    {plan.note&&<p className="prompt-note">{plan.note}</p>}
    {plan.branches.length>0&&<div className="route-plan"><h3>Cabang divisi</h3><ul className="struct-tree">{plan.branches.map(b=><li key={b.head.id}>
      <strong><Network size={14}/>{b.label} · {b.head.name}<small>{b.head.added?"kepala baru":"kepala"}</small></strong>
      <ul>{b.staff.map(s=><li key={s.id}>{s.name}</li>)}</ul></li>)}</ul></div>}
    {plan.direct.length>0&&<div className="route-plan"><h3>Langsung di bawah Pembagi tugas</h3><ul className="hire-list">{plan.direct.map(d=><li key={d.id}>{d.name}</li>)}</ul></div>}
    {plan.changed&&<>{plan.auto?<p className="prompt-note">Menyusun ulang bagan…</p>:<button className="secondary" onClick={arrange}><Network size={16}/>Susun struktur sekarang</button>}</>}
    {!plan.changed&&!plan.note&&plan.branches.length>0&&<p className="prompt-note">Struktur sudah tersusun.</p>}
    {!plan.note&&!plan.branches.length&&<p className="prompt-note">Belum ada divisi dengan 2 agent atau lebih; agent tetap langsung di bawah Pembagi tugas.</p>}
  </>;
}
