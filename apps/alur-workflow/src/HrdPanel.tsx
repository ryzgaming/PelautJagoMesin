import {UserSearch,UserPlus} from "lucide-react";
import {type Graph,type Step} from "./flow";
import {hrdPlan} from "./hrd";

/** Panel Agent HRD: agent yang direkrut dari organisasi dan lowongan untuk tugas yang belum ada agentnya. */
export default function HrdPanel({g,node,edit,hire}:{g:Graph,node:Step,edit:(change:Partial<Step>)=>void,hire:()=>void}) {
  const plan=hrdPlan(g,node.id);
  return <>
    <p className="plugin-help">Agent HRD membaca Agent prompt, menambahkan agent Orang Mesin yang dibutuhkan ke bawah Pembagi tugas, dan membuka lowongan bila tidak ada agent yang sanggup.</p>
    <label className="hrd-toggle"><input type="checkbox" checked={plan.auto} onChange={e=>edit({value:e.target.checked?"":"manual"})}/>Rekrut otomatis</label>
    {plan.note&&<p className="prompt-note">{plan.note}</p>}
    {plan.hires.length>0&&<><div className="route-plan"><h3>Agent yang dibutuhkan</h3><ul className="hire-list">{plan.hires.map(h=><li key={h.agent.id}>{h.agent.name}<small>{h.existing?"Sudah ada di bagan, akan disambungkan":"Akan ditambahkan"} · untuk: {h.tasks.join("; ")}</small></li>)}</ul></div>
      {!plan.auto&&<button className="secondary" onClick={hire}><UserPlus size={16}/>Rekrut sekarang</button>}</>}
    {plan.vacancies.length>0&&<div role="alert"><h3 className="vacancy-head">Sedang mencari agent untuk direkrut</h3>{plan.vacancies.map(v=><div className="vacancy" key={v.task}>
      <h4><UserSearch size={15}/>Dicari: {v.title}</h4>
      <p>{v.summary}</p>
      <strong>Divisi</strong>: {v.division} · <strong>Melapor ke</strong>: {v.reportsTo}
      {v.skills.length>0&&<><br/><strong>Kemampuan</strong>: {v.skills.join(", ")}</>}
      <ul>{v.duties.map(d=><li key={d}>{d}</li>)}</ul>
      <small>{v.rules.join(" · ")}</small>
    </div>)}</div>}
    {!plan.note&&!plan.hires.length&&!plan.vacancies.length&&<p className="prompt-note">Semua tugas di prompt sudah punya agent pelaksana.</p>}
  </>;
}
