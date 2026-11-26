import {type Step} from "./flow";
import {divisions} from "./organization";

/** Panel Agent baru: kartu peran yang dibuat Agent HRD dan bisa disunting pemilik. */
export default function CustomAgentPanel({node,edit}:{node:Step,edit:(change:Partial<Step>)=>void}) {
  return <>
    <p className="custom-agent-card">Agent ini tidak ada di 57 agent Orang Mesin. Agent HRD membuatnya untuk tugas di prompt yang tidak sanggup dikerjakan agent lain. Pembagi tugas menyerahkan tugas ke agent ini berdasarkan nama, misi, tugas, dan kemampuan di kartunya.</p>
    <label>Divisi<select value={node.value} onChange={e=>edit({value:e.target.value})}>
      <option value="">Belum ditentukan</option>{divisions.map(d=><option key={d.key} value={d.key}>{d.name}</option>)}</select></label>
    <label>Kartu peran<textarea rows={12} value={node.message} maxLength={2000} onChange={e=>edit({message:e.target.value})}
      placeholder={"Misi: …\nTugas:\n- …\nKemampuan: …\nMelapor ke: …\nAturan: …"}/>
      <small>Tulis misi, tugas (satu per baris diawali "-"), dan kemampuan. Baris "Melapor ke" dan "Aturan" tidak dipakai untuk mencocokkan tugas.</small></label>
  </>;
}
