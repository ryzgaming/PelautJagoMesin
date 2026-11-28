import {createRoot} from "react-dom/client";
import App from "./App";
import Form from "./features/workflow/Form";
import {alurForm} from "./paths";
import "./style.css";
const params=new URLSearchParams(location.search);
if(params.get("mcp_callback")==="1"){
  const state=params.get("state"),code=params.get("code"),error=params.get("error");
  history.replaceState({}, "", location.pathname);
  if(state&&/^[a-f0-9-]{36}$/i.test(state)&&(code||error)){
    const channel=new BroadcastChannel("alur-oauth-"+state);
    channel.postMessage({state,code,error});channel.close();
    document.getElementById("root")!.textContent="Kembali ke tab Alur untuk melanjutkan.";
  }else document.getElementById("root")!.textContent="Respons otorisasi tidak lengkap. Kembali ke tab Alur.";
}else createRoot(document.getElementById("root")!).render(location.pathname.replace(/\/$/, "")===alurForm?<Form/>:<App/>);
