import {Factory} from "lucide-react";
import {type Step} from "./flow";
import {aiModels,budgetLimits,aiModelById} from "../../ai-models";

/** Panel Agen Produksi: pilihan model AI dan batas biaya yang ikut terkirim bersama order produksi mesin. */
export default function ProducerPanel({node,edit}:{node:Step,edit:(change:Partial<Step>)=>void}) {
  const model=aiModelById.get(node.value);
  return <>
    <p className="plugin-help">Agen Produksi memeriksa hasil setiap agent dengan daftar periksanya, lalu mengirim paketnya untuk ditinjau. Saat bagan dikirim ke produksi, model AI dan batas biaya di bawah ikut tersimpan di order dan dibaca pekerja.</p>
    <label>Model AI<select id="producer-model" value={node.value} onChange={e=>edit({value:e.target.value,message:e.target.value?(node.message||String(budgetLimits.initial)):""})}>
      <option value="">Ikuti bawaan pekerja</option>
      {aiModels.map(m=><option key={m.id} value={m.id}>{m.name} · {m.price} per 1 juta token</option>)}
    </select>{model&&<small>{model.note}</small>}</label>
    {node.value&&<label>Batas biaya per order (dolar AS)<input id="producer-budget" type="number" inputMode="numeric" min={budgetLimits.min} max={budgetLimits.max} step={1}
      value={node.message} onChange={e=>edit({message:e.target.value.replace(/\D/g,"").slice(0,3)})}/>
      <small>{budgetLimits.min}–{budgetLimits.max} dolar. Pekerja berhenti dan menulis checkpoint jujur bila perkiraan pemakaian mendekati batas ini.</small></label>}
    <div className="branch-info"><Factory size={16}/><div><strong>Estimasi biaya token API</strong>
      <p>Harga input / output per 1 juta token. GPT memakai tarif Standard untuk konteks pendek; biaya dapat berbeda menurut mode, panjang konteks, cache, dan alat. Langganan ChatGPT atau Claude mengikuti ketentuan layanan masing-masing.</p>
      <p>Pilihan model berlaku bila tersedia pada pekerja. Model yang tidak tersedia harus dilaporkan, bukan diganti diam-diam.</p>
      <p><a href="https://developers.openai.com/api/docs/pricing" target="_blank" rel="noreferrer">Harga OpenAI</a> · <a href="https://platform.claude.com/docs/en/about-claude/pricing" target="_blank" rel="noreferrer">Harga Anthropic</a></p></div></div>
  </>;
}
