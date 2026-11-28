import {useEffect,useState} from "react";
import {optionsLabel,type ProductionOptions} from "../../ai-models";
import {Activity,ArrowRight} from "lucide-react";
import {api} from "../../api";
import {detailRecord,sessionRecord,statusLabels,type MachineSession} from "./MachineStudio";
import {productionBadges,splitMachine,type Badge} from "./production-status";

/** Ditampilkan setelah Uji alur bagan produksi: meneruskan merk dan tipe ke pipeline Agen mesin. */
export function ProduceForm({text,onSend,production=null}:{text:string,onSend:(m:{brand:string,model:string,production:ProductionOptions|null})=>void,production?:ProductionOptions|null}) {
  const first=splitMachine(text);
  const [brand,setBrand]=useState(first.brand),[model,setModel]=useState(first.model);
  const valid=!!brand.trim()&&!!model.trim()&&brand.trim().length<=80&&model.trim().length<=120;
  return <form className="produce" onSubmit={e=>{e.preventDefault();if(valid)onSend({brand:brand.trim(),model:model.trim(),production})}}>
    <h3>Kirim ke produksi</h3>
    <p>Uji alur hanya simulasi pembagian tugas. Untuk membuat model 3D sungguhan, kirim mesin ini ke pipeline Agen mesin. Periksa pemisahan merk dan tipe di bawah.</p>
    <div className="pair">
      <label>Merk<input required maxLength={80} value={brand} onChange={e=>setBrand(e.target.value)}/></label>
      <label>Tipe<input required maxLength={120} value={model} onChange={e=>setModel(e.target.value)}/></label>
    </div>
    {production&&<p className="prompt-note">Model AI: {optionsLabel(production)} (dari Agen Produksi).</p>}
    <button className="primary" disabled={!valid}>Lanjut ke Agen mesin<ArrowRight size={16}/></button>
  </form>;
}

/** Memuat sesi produksi pemilik dan mengubah memori tiap peran menjadi status kotak di bagan. */
export function useProductionMonitor(enabled:boolean) {
  const [sessions,setSessions]=useState<MachineSession[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [badges,setBadges]=useState<Record<string,Badge>|undefined>();
  const [error,setError]=useState("");
  useEffect(()=>{
    if(!enabled){setBadges(undefined);return}
    let alive=true;
    const controller=new AbortController();
    async function load() {
      try {
        const list=await api("machines",undefined,true,controller.signal);
        const rows=(Array.isArray(list.sessions)?list.sessions:[]).map(sessionRecord)
          .filter((s:MachineSession)=>!s.source_product)
          .sort((a:MachineSession,b:MachineSession)=>b.created_at.localeCompare(a.created_at));
        if(!alive) return;
        setSessions(rows);
        const id=selected&&rows.some((r:MachineSession)=>r.id===selected)?selected:rows[0]?.id??null;
        if(!id){setBadges(undefined);setError("");return}
        const detail=detailRecord(await api("machines?id="+encodeURIComponent(id),undefined,true,controller.signal));
        if(!alive) return;
        setBadges(productionBadges(detail.session,detail.memory));
        setError("");
      } catch(e) {
        if(alive&&!controller.signal.aborted){setBadges(undefined);setError((e as Error).message)}
      }
    }
    void load();
    const timer=setInterval(()=>{if(!document.hidden) void load()},60000);
    return ()=>{alive=false;controller.abort();clearInterval(timer)};
  },[enabled,selected]);
  return {sessions,selected,setSelected,badges,error,enabled};
}

export function Monitor({sessions,selected,setSelected,error,enabled}:ReturnType<typeof useProductionMonitor>) {
  if(!enabled) return null;
  if(error) return <span className="secondary monitor" title={error}><Activity size={16}/>Status produksi belum tersedia</span>;
  if(!sessions.length) return null;
  return <label className="secondary monitor"><Activity size={16} aria-hidden="true"/><span className="sr-only">Pantau produksi</span>
    <select aria-label="Pantau produksi" value={selected??sessions[0].id} onChange={e=>setSelected(e.target.value)}>
      {sessions.map(s=><option key={s.id} value={s.id}>{s.brand} {s.model} · {statusLabels[s.status]}{s.status === "running" && s.worker ? " · " + (s.worker === "claude" ? "Claude" : "Codex") : ""}</option>)}
    </select></label>;
}
