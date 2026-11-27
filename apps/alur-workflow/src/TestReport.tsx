import {useMemo,useState} from "react";
import {Copy,Download,FileText,ListChecks} from "lucide-react";
import type {Assignment} from "./flow";
import {reportMarkdown,type Vacancy} from "./report";
import {blocksMarkdown,compileBlocks,fileStem} from "./compile";
import {buildDocx,docxMime} from "./docx";

const id=(n:number)=>n.toLocaleString("id-ID");

/** Laporan pembagian tugas hasil Uji alur: daftar lengkap tugas setiap agent, bisa dicari dan diunduh. */
export default function TestReport({flow,assignments,warnings,recruit,rules=[],prompts=[],compile=false,word=false}:{flow:string,assignments:Assignment[],warnings:string[],recruit:Vacancy[],rules?:string[],prompts?:string[],compile?:boolean,word?:boolean}) {
  const [copied,setCopied]=useState(false);
  const blocks=useMemo(()=>compile||word?compileBlocks({flow,when:new Date(),prompts,assignments,rules,warnings,recruit}):[],[compile,word,flow,prompts,assignments,rules,warnings,recruit]);
  const compiled=useMemo(()=>blocks.length?blocksMarkdown(blocks):"",[blocks]);
  const [query,setQuery]=useState("");
  const sorted=useMemo(()=>[...assignments].sort((x,y)=>y.tasks.length-x.tasks.length),[assignments]);
  const total=useMemo(()=>new Set(assignments.flatMap(a=>a.tasks)).size,[assignments]);
  if(!assignments.length) return null;
  const q=query.trim().toLocaleLowerCase("id");
  const shown=q?sorted.map(a=>a.name.toLocaleLowerCase("id").includes(q)?a:{...a,tasks:a.tasks.filter(t=>t.toLocaleLowerCase("id").includes(q))}).filter(a=>a.tasks.length):sorted;
  function save(data:BlobPart,type:string,name:string){
    const url=URL.createObjectURL(new Blob([data],{type}));
    const a=document.createElement("a");
    a.href=url;a.download=name;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const download=()=>save(reportMarkdown(flow,new Date(),assignments,warnings,recruit,rules),"text/markdown;charset=utf-8",fileStem("laporan-uji",flow)+".md");
  const downloadWord=()=>save(buildDocx(blocks,{title:"Prompt terhimpun — "+flow,header:"Alur · "+flow,when:new Date()}),docxMime,fileStem("laporan",flow)+".docx");
  async function copy(){try{await navigator.clipboard.writeText(compiled);setCopied(true);setTimeout(()=>setCopied(false),2000)}catch{setCopied(false)}}
  return <section className="test-report" aria-label="Laporan pembagian tugas">
    <div className="test-report-head"><h3><ListChecks size={16}/>Laporan pembagian tugas</h3>
      <span className="compiled-actions">{word&&<button className="secondary" onClick={downloadWord}><FileText size={15}/>Unduh Word</button>}<button className="secondary" onClick={download}><Download size={15}/>Unduh laporan</button></span></div>
    <p>{id(total)} tugas dibagikan ke {id(assignments.length)} agent. Ketuk nama agent untuk melihat semua tugasnya.</p>
    {compile&&<details className="test-rules" open><summary><strong>Prompt terhimpun (Agent Penghimpun)</strong><span>{compiled.length.toLocaleString("id-ID")} karakter</span></summary>
      <div className="compiled-actions"><button className="secondary" onClick={copy}><Copy size={15}/>{copied?"Tersalin":"Salin prompt"}</button>
        <button className="secondary" onClick={()=>save(compiled,"text/markdown;charset=utf-8",fileStem("prompt-terhimpun",flow)+".md")}><Download size={15}/>Unduh .md</button></div>
      <pre className="compiled-prompt">{compiled}</pre></details>}
    {rules.length>0&&<details className="test-rules"><summary><strong>Aturan umum untuk semua agent</strong><span>{id(rules.length)} aturan</span></summary>
      <ul>{rules.map(t=><li key={t}>{t}</li>)}</ul></details>}
    {assignments.length>3&&<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari agent atau tugas" aria-label="Cari agent atau tugas"/>}
    {shown.length===0&&<p>Tidak ada agent atau tugas yang cocok dengan pencarian.</p>}
    {shown.map(a=><details key={a.id} open={!!q}><summary><strong>{a.name}</strong><span>{id(a.tasks.length)} tugas</span></summary>
      <ol>{a.tasks.map(t=><li key={t}>{t}</li>)}</ol></details>)}
  </section>;
}
