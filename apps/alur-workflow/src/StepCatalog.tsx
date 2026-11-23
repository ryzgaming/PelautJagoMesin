import {useState} from "react";
import {Plus} from "lucide-react";
import {Mark, typeName} from "./canvas";
import {label, type Kind} from "./flow";
import {plugins} from "./plugins";

const basic:Kind[]=["condition","confirm","review"];
const items=[...basic.map(kind=>({kind,name:label(kind),group:"Dasar",help:typeName(kind)})),
  ...plugins.map(p=>({kind:p.id,name:p.name,group:p.group,help:p.help}))];
const groups=[...new Set(items.map(p=>p.group))];

export default function StepCatalog({add}:{add:(kind:Kind)=>void}) {
  const [query,setQuery]=useState(""),[group,setGroup]=useState("");
  const terms=query.trim().toLocaleLowerCase("id").split(/\s+/).filter(Boolean);
  const matches=items.filter(item=>{
    if(group && item.group!==group) return false;
    const text=[item.name,item.group,item.help].join(" ").toLocaleLowerCase("id");
    return terms.every(term=>text.includes(term));
  });
  return <div className="catalog">
    <div className="catalog-tools">
      <label>Cari langkah<input type="search" placeholder="Misalnya pompa, bar, serah terima…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <label>Kategori<select value={group} onChange={e=>setGroup(e.target.value)}>
        <option value="">Semua kategori</option>{groups.map(g=><option key={g}>{g}</option>)}
      </select></label>
    </div>
    <p className="catalog-count" role="status">{matches.length} langkah tersedia</p>
    <div className="catalog-results">
      {groups.map(g=>{const rows=matches.filter(p=>p.group===g);return rows.length>0&&<section key={g}>
        <h3>{g}</h3><div className="catalog-grid">{rows.map(p=><button key={p.kind} className="listitem" onClick={()=>add(p.kind)}>
          <Mark kind={p.kind}/><span>{p.name}<small>{p.help}</small></span><Plus size={16} aria-hidden="true"/>
        </button>)}</div>
      </section>})}
      {!matches.length&&<button className="secondary" onClick={()=>{setQuery("");setGroup("")}}>Tampilkan semua langkah</button>}
    </div>
  </div>
}
