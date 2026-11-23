import {url,apiKey} from "../config";
const json=(b:unknown,status=200,h=new Headers())=>{h.set("content-type","application/json");h.set("cache-control","no-store");return new Response(JSON.stringify(b),{headers:h,status})};
export function cookie(req:Request,key:string){return (req.headers.get("cookie")||"").split("; ").find(v=>v.startsWith(key+"="))?.slice(key.length+1)||"";}
function set(h:Headers,path:string,key:string,value:string,seconds:number){h.append("Set-Cookie",key+"="+value+"; Path="+path+"; HttpOnly; Secure; SameSite=Strict; Max-Age="+seconds)}
export const onRequest:PagesFunction=async ({request:r})=>{
 try{
 if(r.method==="GET")return json({signedIn:!!cookie(r,"alur_access")||!!cookie(r,"alur_refresh")});
 if(r.method!=="POST"||r.headers.get("origin")!==new URL(r.url).origin)return json({error:"Permintaan tidak valid."},403);
 const b=await r.json() as Record<string,string>,h=new Headers();
 const path=new URL(r.url).pathname.replace(/\/session\/?$/, "");
 if(b.action==="logout"){set(h,path,"alur_access","",0);set(h,path,"alur_refresh","",0);return json({ok:true},200,h)}
 const refresh=b.action==="refresh";
 if(refresh&&!cookie(r,"alur_refresh"))return json({error:"Masuk untuk menyimpan ke cloud."},401);
 const token=await fetch(url+"/auth/v1/token?grant_type="+(refresh?"refresh_token":"password"),{method:"POST",headers:{apikey:apiKey,"Content-Type":"application/json"},body:JSON.stringify(refresh?{refresh_token:cookie(r,"alur_refresh")}:{email:b.email,password:b.password})});
 if(!token.ok)return json({error:refresh?"Sesi berakhir. Silakan masuk.":"Email atau kata sandi tidak cocok."},401);
 const j=await token.json() as {access_token:string,refresh_token:string,expires_in:number};
 set(h,path,"alur_access",j.access_token,j.expires_in);set(h,path,"alur_refresh",j.refresh_token,2592000);return json({ok:true},200,h);
 }catch{return json({error:"Layanan masuk belum tersedia."},503)}
};
