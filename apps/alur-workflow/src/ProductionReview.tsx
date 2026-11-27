import {ClipboardCheck} from "lucide-react";
import type {Review} from "./gather";

const id=(n:number)=>n.toLocaleString("id-ID");

/** Hasil Agen Produksi pada Uji alur: daftar periksa tiap agent beserta hasil yang dihimpun. */
export default function ProductionReview({production}:{production:{name:string,reviews:Review[]}}) {
  const {name,reviews}=production;
  return <section className="test-report production-review" aria-label={name}>
    <div className="test-report-head"><h3><ClipboardCheck size={16}/>{name}: siap ditinjau</h3></div>
    <p>{reviews.length?`${id(reviews.length)} agent diperiksa dengan daftar periksa masing-masing. Saat bagan dikirim ke produksi, hasil pemeriksaan ini muncul di Beranda sebagai "Siap ditinjau".`
      :"Belum ada agent yang mengirim hasil. Hubungkan agent ke Penghimpun atau langsung ke Agen Produksi."}</p>
    {reviews.map(r=><details key={r.id}><summary><strong>{r.name}</strong><span>{id(r.checks.length)} pemeriksaan</span></summary>
      <ol>{r.checks.map(c=><li key={c}>{c}</li>)}</ol>
      {r.hasil.trim()&&<pre className="robot-output">{r.hasil.length>1200?r.hasil.slice(0,1200)+"…":r.hasil}</pre>}</details>)}
  </section>;
}
