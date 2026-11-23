"use client";
import {useEffect,useState} from "react";
import {alurBase} from "./paths";
import {usesNotes} from "./flow";
import {api} from "./api";
import {Link2,Check} from "lucide-react";
export default function FormPage(){
 const [notes,setNotes]=useState(false),[id,I]=useState(""),[title,T]=useState(""),[error,E]=useState(""),[done,D]=useState(""),[busy,B]=useState(false);
 useEffect(()=>{const i=new URLSearchParams(location.search).get("id")||"";I(i);api("flows?id="+encodeURIComponent(i)).then(j=>{if(!j.name)throw Error("Formulir tidak ditemukan.");setNotes(usesNotes(j));T(j.name)}).catch(e=>E(e.message))},[]);
 return <main className="form-page"><div className="form-box"><div className="brand"><Link2/>Alur</div><h1>{title||"Formulir"}</h1>{error&&<p role="alert">{error} <a href={alurBase}>Buka editor Alur</a></p>}{done?<p className="success"><Check/>{done}</p>:title&&<form onSubmit={async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));B(true);E("");try{const j=await api("flows",{action:"submit",id,data});D(j.confirmation||"Formulir sudah diterima.")}catch(e){E((e as Error).message)}finally{B(false)}}}><label>Nama<input name="nama" autoComplete="name" maxLength={400}/></label><label>Email<input name="email" type="email" autoComplete="email" maxLength={400}/></label>{notes&&<label>Catatan<textarea name="catatan" maxLength={4000}/></label>}<button className="primary" disabled={busy}>{busy?"Mengirim…":"Kirim formulir"}</button></form>}</div></main>
}
