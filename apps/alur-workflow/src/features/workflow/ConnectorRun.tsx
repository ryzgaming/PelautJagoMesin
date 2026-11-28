import {useEffect,useRef,useState} from "react";
import {alurBase} from "../../paths";
import type {ConnectorRequest} from "./flow";

type Tool={name:string,description?:string,schema:unknown};
export default function ConnectorRun({request,accept,busy}:{request:ConnectorRequest,accept:(answer:string)=>void,busy:boolean}) {
  const redirectUrl=new URL(alurBase+"?mcp_callback=1",location.origin).href;
  const [authorize,setAuthorize]=useState(""),[clientId,setClientId]=useState("");
  const channel=useRef<BroadcastChannel|null>(null);
  const worker=useRef<Worker|null>(null);
  const [token,setToken]=useState(""),[tools,setTools]=useState<Tool[]>([]),[tool,setTool]=useState("");
  const [args,setArgs]=useState("{}"),[result,setResult]=useState(""),[error,setError]=useState("");
  const [working,setWorking]=useState(false),[listed,setListed]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>{channel.current?.close();worker.current?.terminate();clearTimeout(timer.current)},[]);
  function reset(){channel.current?.close();setAuthorize("");worker.current?.terminate();worker.current=null;clearTimeout(timer.current);setWorking(false);setTools([]);setListed(false);setTool("")}
  function send(data:object){
    setWorking(true);setError("");
    timer.current=setTimeout(()=>{reset();setError("Waktu tunggu habis. Periksa hasil di penyedia sebelum mengulangi tindakan.")},60000);
    worker.current!.postMessage(data);
  }
  function connect(){
    reset();setError("");
    const w=new Worker(new URL("../../mcp.worker.ts",import.meta.url),{type:"module"});
    worker.current=w;
    w.onerror=()=>{reset();setError("Klien MCP gagal dimuat.")};
    w.onmessage=({data})=>{
      clearTimeout(timer.current);setWorking(false);
      if(data.authorize){setAuthorize(data.authorize);return}
      if(data.error){setError(String(data.error));return}
      if(data.tools){setTools(data.tools);setListed(true);setTool(data.tools[0]?.name??"");return}
      setResult(data.output);
    };
    const state=crypto.randomUUID();
    channel.current=new BroadcastChannel("alur-oauth-"+state);
    channel.current.onmessage=({data})=>{
      if(data.state!==state||(!data.code&&!data.error))return;
      channel.current?.close();setAuthorize("");
      if(data.error){reset();setError("Otorisasi dibatalkan atau ditolak.");return}
      send({action:"authorized",code:data.code});
    };
    send({action:"connect",server:request.server,token:token.trim(),clientId:clientId.trim(),redirectUrl,state});setToken("");
  }
  function call(){
    try{
      const values=JSON.parse(args);
      if(!values || typeof values!=="object" || Array.isArray(values))throw Error();
      send({action:"call",tool,args:values});
    }catch{setError("Argumen harus berupa objek JSON yang valid.")}
  }
  const selected=tools.find(t=>t.name===tool);
  return <section className="connector-run"><h3>{request.name}</h3>
    {request.task&&<pre>{request.task}</pre>}
    {request.server&&<details open><summary>Jalankan alat MCP di Alur</summary>
      <p>Server tujuan <code>{request.server}</code></p>
      {authorize?<><a href={authorize} rel="noreferrer" target="_blank">Masuk dan beri izin di {new URL(authorize).hostname}</a><button type="button" onClick={reset}>Batalkan koneksi</button></>:!listed?<><details><summary>Pengaturan akses</summary><label>ID klien OAuth (opsional)<input value={clientId} onChange={e=>setClientId(e.target.value)}/></label><p>URI pengalihan untuk klien terdaftar <code>{redirectUrl}</code></p><label>Token akses penyedia (opsional)<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)}/></label></details>
      <button className="secondary" type="button" onClick={connect} disabled={working||busy}>Hubungkan dan lihat alat</button></>:<>
      {tools.length?<><label>Alat<select value={tool} onChange={e=>{setTool(e.target.value);setArgs("{}")}}>{tools.map(t=><option key={t.name}>{t.name}</option>)}</select></label>
      <p>{selected?.description}</p><details><summary>Format argumen</summary><pre>{JSON.stringify(selected?.schema,null,2)}</pre></details>
      <label>Argumen JSON<textarea value={args} onChange={e=>setArgs(e.target.value)}/></label>
      <button className="secondary" type="button" disabled={working||busy} onClick={call}>Jalankan {tool}</button></>:<p>Server tidak menyediakan alat.</p>}
      <button type="button" onClick={reset} disabled={working}>Putuskan koneksi</button></>}
      {working&&<p role="status">Menunggu respons server…</p>}
      {error&&<p className="error" role="alert">{error}. Periksa token dan dukungan akses browser (CORS) pada server.</p>}
    </details>}
    <div><a href={request.openUrl} target="_blank" rel="noreferrer">{request.server?"Atur konektor di Claude":"Buka petunjuk plugin Claude Code"}</a></div>
    <label>Hasil langkah<textarea maxLength={8000} value={result} onChange={e=>setResult(e.target.value)} placeholder="Hasil alat MCP atau hasil yang Anda salin dari Claude"/></label>
    {result.length>8000&&<p>Ringkas hasil hingga 8.000 karakter untuk melanjutkan.</p>}
    <button type="button" className="primary" disabled={busy||working||!result.trim()||result.length>8000} onClick={()=>accept(result)}>Teruskan hasil ke alur</button>
  </section>
}
