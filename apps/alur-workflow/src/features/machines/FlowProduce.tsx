import {useMemo,useRef,useState} from "react";
import {ArrowRight,Factory} from "lucide-react";
import {api,ApiError} from "../../api";
import {briefBytes,briefLimits,buildBrief,validBrief,type FlowBrief} from "./production-brief";
import {splitMachine} from "./production-status";
import type {Graph} from "../workflow/flow";
import {optionsLabel,type ProductionOptions} from "../../ai-models";

type Result={assignments?:{name:string,tasks:string[]}[],rules?:string[],warnings?:string[],prompts?:string[]};
const id=(n:number)=>n.toLocaleString("id-ID");

/**
 * Kirim mesin ke antrean produksi sungguhan bersama brief dari bagan ini: prompt, pembagian tugas
 * per agent, dan aturan umum. Pekerja Claude/Codex membaca brief itu di setiap peran produksi.
 */
export default function FlowProduce({graph,result,machine,notes,signed,onLogin,onSent,production=null}:{graph:Graph,result:Result,machine:string,notes:string,signed:boolean,onLogin:()=>void,onSent:(sessionId:string)=>void,production?:ProductionOptions|null}) {
  const first=splitMachine(machine);
  const [brand,setBrand]=useState(first.brand),[model,setModel]=useState(first.model);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const brief:FlowBrief=useMemo(()=>buildBrief(graph,result,notes),[graph,result,notes]);
  const request=useRef<{key:string,id:string}|null>(null);
  const size=useMemo(()=>briefBytes(brief),[brief]),tooBig=size>briefLimits.bytes,ok=useMemo(()=>validBrief(brief),[brief]);
  const valid=!!brand.trim()&&!!model.trim()&&brand.trim().length<=80&&model.trim().length<=120&&brief.tasks.length>0&&ok;
  async function send(e:React.FormEvent){
    e.preventDefault();
    if(!valid||busy)return;
    // Kirim ulang yang sama memakai request_id yang sama, jadi tidak ada sesi ganda.
    const key=[brand.trim().toLowerCase(),model.trim().toLowerCase(),JSON.stringify(brief),JSON.stringify(production)].join("\u0000");
    if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
    setBusy(true);setError("");
    try{
      const r=await api("machines",{brand:brand.trim(),model:model.trim(),request_id:request.current.id,flow_brief:brief,...(production?{production}:{})});
      onSent(String(r.session.id));
    }catch(err){
      setError(err instanceof ApiError&&err.status===409?"Mesin ini masih ada di antrean atau sedang dikerjakan. Buka tab Mesin untuk melihatnya."
        :err instanceof ApiError&&err.status===403?"Hanya akun pemilik yang dapat mengirim mesin ke produksi."
        :err instanceof ApiError&&err.status===401?"Sesi berakhir. Masuk kembali lalu kirim ulang."
        :(err as Error).message||"Gagal mengirim ke produksi.");
    }finally{setBusy(false)}
  }
  if(!brief.tasks.length)return null;
  return <form className="produce flow-produce" onSubmit={send}>
    <h3><Factory size={16}/>Kerjakan sungguhan</h3>
    <p>Kirim mesin ke antrean produksi. Pekerja Claude/Codex mengerjakan riset dan model 3D-nya mengikuti brief dari bagan ini: {id(brief.tasks.length)} tugas{brief.rules.length?", "+id(brief.rules.length)+" aturan umum":""}{brief.unmatched.length?", "+id(brief.unmatched.length)+" tugas tanpa agent":""}, beserta prompt lengkapnya.</p>
    <p className="prompt-note">{production?"Model AI: "+optionsLabel(production)+" (dari Agen Produksi).":"Model AI mengikuti bawaan pekerja. Pilih model dan batas biaya di langkah Agen Produksi bila perlu."}</p>
    <div className="pair">
      <label>Merk<input required maxLength={80} value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Caterpillar"/></label>
      <label>Tipe<input required maxLength={120} value={model} onChange={e=>setModel(e.target.value)} placeholder="3512C"/></label>
    </div>
    {tooBig?<p className="prompt-warning" role="alert">Brief terlalu besar ({id(Math.ceil(size/1024))} KB, maksimal {id(briefLimits.bytes/1000)} KB). Persingkat prompt di bagan, lalu jalankan Uji alur lagi.</p>
      :!ok&&<p className="prompt-warning" role="alert">Brief bagan ini tidak dapat dikirim (ada tugas atau aturan yang terlalu panjang). Persingkat prompt, lalu jalankan Uji alur lagi.</p>}
    {error&&<p className="prompt-warning" role="alert">{error}</p>}
    {signed?<button className="primary" disabled={!valid||busy}>{busy?"Mengirim…":"Kirim ke produksi"}<ArrowRight size={16}/></button>
      :<button type="button" className="primary" onClick={onLogin}>Masuk untuk mengirim ke produksi</button>}
  </form>;
}
