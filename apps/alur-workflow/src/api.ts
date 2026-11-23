let refreshing:Promise<boolean>|null=null;
export async function api(path:string,body?:unknown,again=true):Promise<any>{
 const r=await fetch("/api/"+path,body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{cache:"no-store"});
 if(r.status===401&&again&&path.startsWith("flows")){
 refreshing??=api("session",{action:"refresh"},false).then(()=>true,()=>false).finally(()=>{refreshing=null});if(await refreshing)return api(path,body,false);
 }
 if(!r.headers.get("content-type")?.includes("application/json"))throw Error("Layanan cloud belum terhubung.");const j=await r.json() as Record<string,any>;if(!r.ok)throw Error(j.error||"Permintaan gagal.");return j;
}
