import {useState} from "react";
import ConnectorRun from "./ConnectorRun";
import {execute,singleField,usesNotes,type ConnectorAnswers,type ConnectorRequest,type Graph} from "./flow";
import {api} from "../../api";

type Input={nama:string,email:string,catatan:string};
type Result=ReturnType<typeof execute>;
export default function RunForm({graph,mode,cloud,onComplete,onStart}:{graph:Graph,mode:"test"|"submit",cloud:boolean,onComplete:(r:Result,d:Input)=>void,onStart?:()=>void}) {
  const [data,setData]=useState<Input>({nama:"",email:"",catatan:""});
  const [pending,setPending]=useState<ConnectorRequest|null>(null),[answers,setAnswers]=useState<ConnectorAnswers>({});
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[cut,setCut]=useState(0);
  async function run(next:ConnectorAnswers) {
    setBusy(true);setError("");
    try{
      const r:Result=cloud?await api("flows",{action:mode,...(mode==="test"?{graph}:{id:graph.id,revision:graph.revision}),data,answers:next}):execute(graph,data,next);
      setPending(r.pending??null);
      if(r.pending)setAnswers(next);
      else{setAnswers({});onComplete(r,data)}
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  return <>{error&&<p role="alert" className="error">{error}</p>}
    {pending?<><ConnectorRun key={pending.id} request={pending} busy={busy} accept={v=>run({...answers,[pending.id]:v})}/>
    <button type="button" disabled={busy} onClick={()=>{setPending(null);setAnswers({});setError("")}}>Kembali ke formulir</button></>:<form onSubmit={e=>{e.preventDefault();onStart?.();run({})}}>
      {singleField(graph)?<label>{singleField(graph)}<input required value={data.catatan} maxLength={400} placeholder="Misalnya, Caterpillar 3512C" onChange={e=>setData({...data,catatan:e.target.value})}/></label>:<>
      <label>Nama<input value={data.nama} maxLength={400} autoComplete="name" onChange={e=>setData({...data,nama:e.target.value})}/></label>
      <label>Email<input type={mode==="test"?"text":"email"} value={data.email} maxLength={400} autoComplete="email" onChange={e=>setData({...data,email:e.target.value})}/></label>
      {usesNotes(graph)&&<label>Catatan<textarea value={data.catatan} onChange={e=>{const v=e.target.value;setCut(Math.max(0,v.length-4000));setData({...data,catatan:v.slice(0,4000)})}}/>{cut>0&&<span className="prompt-warning" role="alert">Sebagian teks tidak tertulis: {cut.toLocaleString("id-ID")} karakter terakhir terpotong karena Catatan dibatasi 4.000 karakter. Untuk prompt besar, tempelkan di langkah Agent prompt (hingga 50.000 karakter).</span>}</label>}</>}
      <button className="primary" disabled={busy}>{busy?"Memproses…":mode==="test"?"Jalankan uji":"Kirim formulir"}</button>
    </form>}
  </>
}
