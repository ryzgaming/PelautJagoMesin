import {useMemo,useState} from "react";
import {Download,ListChecks} from "lucide-react";
import type {Assignment} from "./flow";
import {reportMarkdown,type Vacancy} from "./report";

const id=(n:number)=>n.toLocaleString("id-ID");

/** Laporan pembagian tugas hasil Uji alur: daftar lengkap tugas setiap agent, bisa dicari dan diunduh. */
export default function TestReport({flow,assignments,warnings,recruit,rules=[]}:{flow:string,assignments:Assignment[],warnings:string[],recruit:Vacancy[],rules?:string[]}) {
  const [query,setQuery]=useState("");
  const sorted=useMemo(()=>[...assignments].sort((x,y)=>y.tasks.length-x.tasks.length),[assignments]);
  const total=useMemo(()=>new Set(assignments.flatMap(a=>a.tasks)).size,[assignments]);
  if(!assignments.length) return null;
  const q=query.trim().toLocaleLowerCase("id");
  const shown=q?sorted.map(a=>a.name.toLocaleLowerCase("id").includes(q)?a:{...a,tasks:a.tasks.filter(t=>t.toLocaleLowerCase("id").includes(q))}).filter(a=>a.tasks.length):sorted;
  function download(){
    const text=reportMarkdown(flow,new Date(),assignments,warnings,recruit,rules);
    const url=URL.createObjectURL(new Blob([text],{type:"text/markdown;charset=utf-8"}));
    const a=document.createElement("a");
    a.href=url;a.download="laporan-uji-"+(flow.toLocaleLowerCase("id").replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-|-$/g,"")||"alur")+".md";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="test-report" aria-label="Laporan pembagian tugas">
    <div className="test-report-head"><h3><ListChecks size={16}/>Laporan pembagian tugas</h3>
      <button className="secondary" onClick={download}><Download size={15}/>Unduh laporan</button></div>
    <p>{id(total)} tugas dibagikan ke {id(assignments.length)} agent. Ketuk nama agent untuk melihat semua tugasnya.</p>
    {rules.length>0&&<details className="test-rules"><summary><strong>Aturan umum untuk semua agent</strong><span>{id(rules.length)} aturan</span></summary>
      <ul>{rules.map(t=><li key={t}>{t}</li>)}</ul></details>}
    {assignments.length>3&&<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari agent atau tugas" aria-label="Cari agent atau tugas"/>}
    {shown.length===0&&<p>Tidak ada agent atau tugas yang cocok dengan pencarian.</p>}
    {shown.map(a=><details key={a.id} open={!!q}><summary><strong>{a.name}</strong><span>{id(a.tasks.length)} tugas</span></summary>
      <ol>{a.tasks.map(t=><li key={t}>{t}</li>)}</ol></details>)}
  </section>;
}
