"use client";
import {useEffect,useState} from "react";
import {alurBase} from "./paths";
import type {Graph} from "./flow";
import RunForm from "./RunForm";
import {api} from "./api";
import {Link2,Check} from "lucide-react";
export default function FormPage(){
 const [graph,setGraph]=useState<Graph|null>(null),[error,E]=useState(""),[done,D]=useState("");
 useEffect(()=>{const id=new URLSearchParams(location.search).get("id")||"";api("flows?id="+encodeURIComponent(id)).then(g=>{if(!g.name) throw Error("Formulir tidak ditemukan.");setGraph(g)}).catch(e=>E(e.message))},[]);
 return <main className="form-page"><div className="form-box"><div className="brand"><Link2/>Alur</div><h1>{graph?.name||"Formulir"}</h1>{error&&<p role="alert">{error} <a href={alurBase}>Buka editor Alur</a></p>}{done?<p className="success"><Check/>{done}</p>:graph&&<RunForm graph={graph} mode="submit" cloud onComplete={r=>D(r.confirmation||"Formulir sudah diterima.")}/>}</div></main>
}
