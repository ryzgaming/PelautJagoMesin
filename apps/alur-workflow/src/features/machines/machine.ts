// Agent Mesin: langkah tempat pemilik menulis merek dan tipe mesin. Nama mesin diteruskan ke
// Agent prompt (prompt bertujuan membuat mesin itu) dan diberitahukan ke setiap agent di bagan.
export const machineKind = "mesin";
export const machineMax = 120;

type Node = {id:string, kind:string, x:number, y:number};
type Edge = {from:string, port:string, to:string};

/** Prompt standar bila Agent prompt dibiarkan kosong: satu baris per tugas produksi desain 3D. */
export function machinePrompt(machine:string) {
  return [
    `Kumpulkan dokumen OEM, manual, foto, dan video resmi ${machine}`,
    `Ukur dimensi utama ${machine} dari gambar dan referensi pabrikan`,
    `Susun daftar komponen bertingkat dengan part number ${machine}`,
    `Petakan sistem bahan bakar, pendinginan, pelumasan, serta udara masuk dan gas buang ${machine}`,
    `Buat model 3D eksterior dan komponen internal ${machine}`,
    `Periksa geometri dan sambungan rakitan model 3D ${machine}`,
    `Tulis penjelasan fungsi tiap komponen ${machine}`,
  ].join("\n");
}

/** Sisipkan {mesin} pada pesan langkah. */
export const withMachine = (text:string, machine:string) => machine ? text.replaceAll("{mesin}", machine) : text;

/**
 * Pasang Agent Mesin baru di antara Formulir masuk dan Agent prompt (bagan: pemicu → Agent Mesin → prompt).
 * Bila belum ada sambungan pemicu → prompt, langkah ditambahkan tanpa sambungan.
 */
export function spliceMachine<G extends {nodes:N[], edges:E[]}, N extends Node, E extends Edge>(g:G, node:N):G {
  const trigger = g.nodes.find(n => n.kind === "trigger");
  const links = trigger ? g.edges.filter(e => e.from === trigger.id && g.nodes.find(n => n.id === e.to)?.kind === "prompt") : [];
  if (!trigger || !links.length) return {...g, nodes:[...g.nodes, node]};
  const first = g.nodes.find(n => n.id === links[0].to)!;
  const placed = {...node, x:Math.round((trigger.x + first.x) / 2), y:Math.round(Math.min(trigger.y, first.y) - 140)};
  return {...g, nodes:[...g.nodes, placed],
    edges:[...g.edges.filter(e => !links.includes(e)), {...links[0], to:placed.id} as E, ...links.map(e => ({...e, from:placed.id, port:"out"}) as E)]};
}
