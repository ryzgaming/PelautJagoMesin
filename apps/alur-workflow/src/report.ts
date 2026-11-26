import type {Assignment} from "./flow.ts";

export type Vacancy={title:string,summary?:string};
const unmatchedPrefix="Tidak ada agent yang cocok untuk: ";
const id=(n:number)=>n.toLocaleString("id-ID");

/** Laporan uji alur dalam Markdown, untuk dibaca atau dibagikan di luar Alur. */
export function reportMarkdown(flow:string,when:Date,assignments:Assignment[],warnings:string[],recruit:Vacancy[],rules:string[]=[]) {
  const total=new Set(assignments.flatMap(a=>a.tasks)).size;
  const unmatched=warnings.filter(w=>w.startsWith(unmatchedPrefix)).map(w=>w.slice(unmatchedPrefix.length));
  const other=warnings.filter(w=>!w.startsWith(unmatchedPrefix));
  const lines=["# Laporan uji alur — "+flow,"",when.toLocaleString("id-ID"),"",
    "- "+id(total)+" tugas dibagikan ke "+id(assignments.length)+" agent",
    "- "+id(unmatched.length)+" tugas tidak cocok dengan agent mana pun",
    "- "+id(recruit.length)+" agent masih dicari Agent HRD",
    "- "+id(rules.length)+" aturan umum berlaku untuk semua agent",""];
  if(rules.length) lines.push("## Aturan umum (berlaku untuk semua agent)","",...rules.map(t=>"- "+t),"");
  for(const a of [...assignments].sort((x,y)=>y.tasks.length-x.tasks.length)) {
    lines.push("## "+a.name+" ("+id(a.tasks.length)+" tugas)","",...a.tasks.map((t,i)=>(i+1)+". "+t),"");
  }
  if(unmatched.length) lines.push("## Tidak cocok dengan agent mana pun","",...unmatched.map(t=>"- "+t),"");
  if(other.length) lines.push("## Peringatan lain","",...other.map(t=>"- "+t),"");
  if(recruit.length) lines.push("## Agent yang dicari Agent HRD","",...recruit.map(v=>"- "+v.title+(v.summary?" — "+v.summary:"")),"");
  return lines.join("\n");
}

