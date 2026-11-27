// Penghimpun dan Agen Produksi: langkah penutup bagan yang menunggu semua agent selesai.
// Penghimpun mengumpulkan hasil semua langkah yang tersambung ke dalamnya menjadi satu paket.
// Agen Produksi berada paling akhir dan memeriksa hasil setiap agent dengan daftar periksa
// (kemampuan dan standar ketelitian) milik agent itu, lalu mengirim paketnya untuk ditinjau pemilik.
import {agentByKind} from "./organization.ts";

export const gatherKind = "himpun";
export const producerKind = "produksi";
export type Input = {id:string, name:string, hasil:string};
export type Review = {id:string, name:string, checks:string[], hasil:string};
type N = {kind:string, name:string, message:string};

/**
 * Langkah penghimpun: jenis Penghimpun, atau agent yang diberi nama "Penghimpun" di bagan
 * (bagan lama membuat penghimpun dari Agent baru). Penghimpun tidak menerima tugas dari Pembagi tugas.
 */
export const gathers = (n:{kind:string, name:string}) =>
  n.kind === gatherKind || ((n.kind === "custom-agent" || agentByKind.has(n.kind)) && /himpun/iu.test(n.name));

/** Satu paket hasil, dikelompokkan per langkah asal sesuai urutan selesai. */
export function packageResults(inputs:Input[]) {
  if (inputs.length === 1) return inputs[0].hasil;
  return inputs.map(i => "## " + i.name + "\n" + (i.hasil.trim() || "(belum ada hasil)")).join("\n\n");
}

const max = 8;
/** Daftar periksa sebuah agent: standar ketelitian dan hasil wajib (agent Orang Mesin) atau kartu peran (Agent baru). */
export function checklist(n:N) {
  const agent = agentByKind.get(n.kind);
  if (agent) return [...agent.accuracy, ...agent.outputs.map(o => "Menyerahkan: " + o)].slice(0, max);
  const lines = n.message.split("\n").map(l => l.trim());
  const out = [
    ...lines.filter(l => l.startsWith("- ")).map(l => "Menyelesaikan: " + l.slice(2).trim()),
    ...lines.filter(l => /^(Kemampuan|Aturan)\s*:/i.test(l)).map(l => l.replace(/^Kemampuan\s*:\s*/i, "Memakai kemampuan: ").replace(/^Aturan\s*:\s*/i, "Mematuhi aturan: ")),
  ].filter(l => !/:\s*(…|\.\.\.)?$/.test(l));
  return (out.length ? out : ["Hasil sesuai tugas yang diberikan"]).slice(0, max);
}

/** Pesan review yang dikirim Agen Produksi ke dashboard. */
export function reviewMessage(name:string, reviews:Review[]) {
  return name + ": " + reviews.length + " agent diperiksa dengan daftar periksa masing-masing. Hasil dikirim ke dashboard untuk ditinjau pemilik.";
}

/** Aturan yang ikut ke brief produksi agar pekerja menjalankan peran QA sebagai Agen Produksi. */
export const producerRule = "Agen Produksi (peran qa, langkah terakhir) memeriksa hasil setiap peran dengan daftar periksa peran itu, " +
  "mengembalikan temuan ke peran terkait maksimal dua putaran, lalu mengirim hasil ke dashboard untuk ditinjau pemilik. Agen Produksi tidak ikut membuat model.";
