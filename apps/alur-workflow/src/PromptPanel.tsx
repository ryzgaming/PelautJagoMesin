import {TriangleAlert} from "lucide-react";
import {type Graph,type Step} from "./flow";
import {promptWarnings} from "./prompt-router";

/** Panel Agent prompt dan Pembagi tugas: pratinjau pembagian tugas serta peringatan merah. */
export default function PromptPanel({g,node,edit}:{g:Graph,node:Step,edit:(change:Partial<Step>)=>void}) {
  const info=promptWarnings(g)[node.id];
  const name=(id:string)=>g.nodes.find(n=>n.id===id)?.name??id;
  return <>
    {node.kind==="prompt"?<label>Prompt<textarea rows={6} value={node.message} maxLength={1000} onChange={e=>edit({message:e.target.value})}
      placeholder={"Satu tugas per baris, misalnya:\nKumpulkan parts catalog dan manual OEM\nSusun daftar komponen bertingkat\nBuat simulasi sistem bahan bakar"}/>
      <small>Kosongkan untuk memakai Catatan dari formulir. Tulis nama agent (misalnya "Simulator") untuk menunjuk langsung.</small></label>
    :<p className="plugin-help">Pembagi tugas memecah prompt dari langkah sebelumnya per baris atau kalimat, lalu menyerahkan setiap tugas hanya ke agent tersambung yang paling cocok. Agent yang tidak mendapat tugas dilewati.</p>}
    {info?.note&&<p className={node.kind==="router"?"prompt-warning":"prompt-note"} role={node.kind==="router"?"alert":undefined}>{info.note}</p>}
    {info&&info.unmatched.length>0&&<div className="prompt-warning" role="alert"><h3><TriangleAlert size={15}/>Tidak cocok dengan agent mana pun</h3>
      <ul>{info.unmatched.map(t=><li key={t}>{t}</li>)}</ul>
      <p>Tambahkan agent yang sesuai ke bagan dan sambungkan ke Pembagi tugas, atau tulis ulang tugasnya.</p></div>}
    {info?.routing&&info.routing.tasks.length>0&&<div className="route-plan"><h3>Pembagian tugas</h3><ul aria-label="Pembagian tugas">
      {info.routing.tasks.map(t=><li key={t.task}>{t.task}<small>→ {t.targets.map(name).join(", ")}</small></li>)}</ul></div>}
  </>;
}
