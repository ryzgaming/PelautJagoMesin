import {useState} from "react";
import {TriangleAlert,X} from "lucide-react";
import {type Graph,type Step} from "./flow";
import {promptMax,promptWarnings,splitPrompt,taskMax} from "./prompt-router";

const id=(n:number)=>n.toLocaleString("id-ID");
/** Panel Agent prompt dan Pembagi tugas: pratinjau pembagian tugas serta peringatan merah. */
export default function PromptPanel({g,node,edit}:{g:Graph,node:Step,edit:(change:Partial<Step>)=>void}) {
  const info=promptWarnings(g)[node.id];
  const name=(id:string)=>g.nodes.find(n=>n.id===id)?.name??id;
  // Teks yang melewati batas tidak dibuang diam-diam: jumlah dan awal bagian yang terpotong ditampilkan.
  const [cut,setCut]=useState<{chars:number,from:string}|null>(null);
  function write(value:string){
    if(value.length>promptMax){setCut({chars:value.length-promptMax,from:value.slice(promptMax,promptMax+160).trim()});edit({message:value.slice(0,promptMax)});}
    else{if(!value)setCut(null);edit({message:value});}
  }
  const tasks=node.kind==="prompt"?splitPrompt(node.message).length:0;
  return <>
    {node.kind==="prompt"?<label>Prompt<textarea className="prompt-input" rows={10} value={node.message} onChange={e=>write(e.target.value)}
      placeholder={"Satu tugas per baris, misalnya:\nKumpulkan parts catalog dan manual OEM\nSusun daftar komponen bertingkat\nBuat simulasi sistem bahan bakar"}/>
      <small className={"prompt-count"+(node.message.length>=promptMax?" full":"")}>{id(node.message.length)} / {id(promptMax)} karakter · {info?.dropped.length?id(tasks)+" dari "+id(tasks+info.dropped.length):id(tasks)} tugas</small>
      <small>Prompt besar boleh ditempel langsung; judul (#) dan label bagian yang diakhiri titik dua tidak dihitung sebagai tugas. Kosongkan untuk memakai Catatan dari formulir. Tulis nama agent (misalnya "Simulator") untuk menunjuk langsung.</small></label>
    :<p className="plugin-help">Pembagi tugas memecah prompt dari langkah sebelumnya per baris atau kalimat, lalu menyerahkan setiap tugas hanya ke agent tersambung yang paling cocok. Agent yang tidak mendapat tugas dilewati.</p>}
    {cut&&<div className="prompt-warning" role="alert"><h3><TriangleAlert size={15}/>Sebagian prompt tidak tertulis<button className="warning-close" aria-label="Tutup peringatan" onClick={e=>{e.preventDefault();setCut(null)}}><X size={14}/></button></h3>
      <p>{id(cut.chars)} karakter terakhir terpotong karena melewati batas {id(promptMax)} karakter. Bagian yang hilang dimulai dari:</p>
      <blockquote>“{cut.from}{cut.chars>160?"…":""}”</blockquote>
      <p>Pecah prompt ke Agent prompt kedua yang juga disambungkan ke Pembagi tugas, atau ringkas bagian awalnya.</p></div>}
    {info&&info.dropped.length>0&&<div className="prompt-warning" role="alert"><h3><TriangleAlert size={15}/>{id(info.dropped.length)} tugas tidak terbaca</h3>
      <p>Hanya {id(taskMax)} tugas pertama yang dibagikan. Tugas berikutnya tidak diserahkan ke agent mana pun, mulai dari:</p>
      <ul>{info.dropped.slice(0,5).map(t=><li key={t}>{t}</li>)}{info.dropped.length>5&&<li>…dan {id(info.dropped.length-5)} tugas lainnya</li>}</ul>
      <p>Pindahkan sebagian tugas ke Agent prompt lain atau gabungkan tugas yang mirip.</p></div>}
    {info?.note&&<p className={node.kind==="router"?"prompt-warning":"prompt-note"} role={node.kind==="router"?"alert":undefined}>{info.note}</p>}
    {info&&info.unmatched.length>0&&<div className="prompt-warning" role="alert"><h3><TriangleAlert size={15}/>Tidak cocok dengan agent mana pun</h3>
      <ul>{info.unmatched.map(t=><li key={t}>{t}</li>)}</ul>
      <p>Tambahkan agent yang sesuai ke bagan dan sambungkan ke Pembagi tugas, atau tulis ulang tugasnya.</p></div>}
    {info?.routing&&info.routing.tasks.length>0&&<div className="route-plan"><h3>Pembagian tugas</h3><ul aria-label="Pembagian tugas">
      {info.routing.tasks.map(t=><li key={t.task}>{t.task}<small>→ {t.targets.map(name).join(", ")}</small></li>)}</ul></div>}
  </>;
}
