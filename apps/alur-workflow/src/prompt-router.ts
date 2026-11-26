// Agent prompt dan Pembagi tugas: prompt dipecah jadi tugas, lalu setiap tugas diserahkan
// ke langkah tersambung yang paling cocok. Tugas yang tidak cocok dilaporkan sebagai peringatan.
import {agentByKind,agents,type Agent} from "./organization.ts";
import {directoryByKind} from "./directory.ts";
import {pluginById} from "./plugins.ts";

export const promptKind = "prompt";
export const routerKind = "router";
export const hrdKind = "hrd";
/** Agent baru buatan Agent HRD (atau pengguna); kartu perannya tersimpan di pesan langkah. */
export const customAgentKind = "custom-agent";
/** Bagian kartu Agent baru yang dipakai untuk mencocokkan tugas (tanpa atasan dan aturan umum). */
export function customAgentProfile(message:string) { return message.split(/\n\s*(?:Melapor ke|Aturan)\s*:/)[0]; }
/** Batas panjang prompt di Agent prompt (karakter). Cukup untuk menempelkan prompt besar. */
export const promptMax = 50000;
/** Batas jumlah tugas yang dibagikan dari satu prompt. */
export const taskMax = 300;
export type Node = {id:string, kind:string, name:string, message:string};
export type Link = {from:string, to:string};
type G = {nodes:Node[], edges:Link[]};
export type Assignment = {task:string, targets:string[]};
export type Routing = {tasks:Assignment[], unmatched:string[]};

const stop = new Set(("yang dan di ke dari untuk dengan atau ini itu pada dalam oleh agar supaya tolong buat buatkan bikin lakukan kerjakan "+
  "saya kami kita kamu anda mohon juga lalu kemudian setelah sebelum semua setiap per secara serta harus bisa akan sudah belum "+
  "tidak ada jadi para tiap sesuai antara hingga sampai bila jika kalau maka the and of to for with from into a an on in is are be "+
  "minta silakan tugas langkah agent agen").split(" "));
/** Kata kerja perintah umum: tetap dihitung, tetapi bobotnya kecil dan tidak cukup sendirian. */
export const verbs = new Set(("buat bikin buatkan hitung hitungkan cari carikan tulis tuliskan susun periksa atur kirim siapkan rancang desain kelola pasang "+
  "terjemahkan analisis analisa rekam edit ambil kumpulkan urus hubungi jual beli bayar cek uji rekrut tambah tambahkan perbaiki selesaikan "+
  "pelajari bandingkan pesan masak catat jadwalkan").split(" "));
// Padanan istilah umum agar prompt sehari-hari cocok dengan kartu peran.
const synonyms:Record<string,string[]> = {facebook:["meta"],instagram:["meta"],fb:["meta"],ig:["meta"],pajak:["ppn","pph"],terjemahkan:["terjemahan"],
  promosi:["iklan"],marketing:["pemasaran"],jepang:["bahasa"],inggris:["bahasa"],website:["situs","web"],database:["basis"]};
const prefixes = ["meng","meny","mem","men","me","peng","peny","pem","pen","pe","ber","ter","di","ke","se"];
const suffixes = ["nya","kan","an","i"];

/** Bentuk dasar kasar sebuah kata, cukup untuk mencocokkan "simulasi" dengan "simulasikan". */
function variants(word:string) {
  const out = new Set([word]);
  let base = word;
  for (const s of suffixes) if (base.length - s.length >= 4 && base.endsWith(s)) { base = base.slice(0, -s.length); break; }
  out.add(base);
  for (const p of prefixes) if (base.length - p.length >= 4 && base.startsWith(p)) { out.add(base.slice(p.length)); break; }
  return [...out];
}
export function variantsOf(word:string) { return variants(word); }
export function words(text:string) {
  return [...new Set(text.toLocaleLowerCase("id").replace(/\{[a-z]+\}/g, " ").split(/[^\p{L}\p{N}]+/u)
    .filter(w => (w.length >= 3 || /\d/.test(w)) && !stop.has(w) && !/^\d+$/.test(w)))];
}

/** Pecah prompt per baris, titik koma, atau kalimat; tanda butir, nomor urut, judul Markdown, dan label bagian ("Konteks:") dibuang. */
export function splitPrompt(text:string, limit = taskMax) {
  return text.split(/\r?\n|;|(?<=[.!?])\s+(?=[\p{Lu}\d])/u)
    .filter(t => !/^\s*(?:#{1,6}\s|```|---+\s*$|===+\s*$)/.test(t) && !/:\s*$/.test(t))
    .map(t => t.replace(/\*\*|__|`/g, "").replace(/^\s*(?:[-*•–]|\d+[.)]|[a-z][.)])\s*/u, "").replace(/^\s*\[[ xX]\]\s*/, "").replace(/[.!?]+$/, "").trim())
    .filter(t => words(t).length > 0)
    .filter((t, i, all) => all.indexOf(t) === i)
    .slice(0, limit);
}
/** Tugas yang tidak ikut dibagikan karena melewati batas jumlah tugas. */
export function droppedTasks(text:string) { return splitPrompt(text, Infinity).slice(taskMax); }

const profile = (a:Agent) => [a.name, a.short, a.mission, ...a.tasks, ...a.outputs].join(" ");
// Kata yang muncul di banyak kartu peran (misalnya "mesin") bernilai kecil.
const frequency = new Map<string,number>();
for (const a of agents) for (const w of new Set(words(profile(a)).flatMap(variants))) frequency.set(w, (frequency.get(w) ?? 0) + 1);
export const weight = (w:string) => Math.log(1 + agents.length / Math.max(1, ...variants(w).map(v => frequency.get(v) ?? 0)));
const threshold = 1.5;

function describe(n:Node) {
  const agent = agentByKind.get(n.kind);
  const strong = [n.name, agent?.name ?? "", agent?.short ?? ""].join(" ");
  const body = [n.kind === customAgentKind ? customAgentProfile(n.message) : n.message, agent ? profile(agent) : "", directoryByKind.get(n.kind)?.help ?? "", pluginById.get(n.kind)?.help ?? ""].join(" ");
  const key = n.kind + "\u0000" + n.name + "\u0000" + n.message, cached = profiles.get(key);
  if (cached) return {...cached, id:n.id};
  const lines = n.kind === customAgentKind ? new Set(n.message.split("\n").filter(l => l.startsWith("- ")).map(l => l.slice(2).trim())) : new Set<string>();
  const made = {id:n.id, lines, label:[n.name, agent?.name, agent?.short].filter((s):s is string => !!s && s.length >= 4).map(s => s.toLocaleLowerCase("id")), strong:bag(strong), body:bag(body)};
  if (profiles.size > 500) profiles.clear();
  profiles.set(key, made);
  return made;
}
// Profil disimpan sementara agar prompt besar tetap cepat dihitung ulang saat mengetik.
type Bag = {all:Set<string>, pre:Set<string>};
const profiles = new Map<string,{id:string,lines:Set<string>,label:string[],strong:Bag,body:Bag}>();
function bag(s:string):Bag {
  const all = new Set(words(s).flatMap(variants));
  return {all, pre:new Set([...all].filter(w => w.length >= 5).map(w => w.slice(0, 5)))};
}
type Profile = ReturnType<typeof describe>;
function hit(set:Bag, w:string) {
  return variants(w).some(v => set.all.has(v) || (v.length >= 5 && set.pre.has(v.slice(0, 5))));
}
function exact(set:Bag, w:string) {
  return set.all.has(w) || (w.length >= 5 && set.pre.has(w.slice(0, 5)));
}
function score(task:string, p:Profile, strict = false) {
  const lower = task.toLocaleLowerCase("id");
  // Tugas yang tertulis persis di kartu Agent baru selalu diserahkan ke agent itu.
  if (p.lines.has(task)) return 100;
  const named = p.label.some(l => lower.includes(l));
  let total = named ? 10 : 0, hits = 0, strong = false, specific = false;
  const terms = words(task), extra = terms.flatMap(w => synonyms[w] ?? []).filter(w => !terms.includes(w));
  for (const w of [...terms, ...extra]) {
    // Padanan dan bentuk dasar ikut menambah nilai, tetapi tidak cukup sendirian (misalnya "pelayaran" ≠ "layar").
    const verb = verbs.has(w), main = !verb && terms.includes(w), value = weight(w) * (verb ? .5 : 1);
    if (hit(p.strong, w)) { total += 3 * value; hits++; strong ||= main; }
    else if (hit(p.body, w)) { total += value; hits++; specific ||= main && value >= 3 && exact(p.body, w); }
  }
  // Satu kata kebetulan sama (misalnya "pasang" pada "bongkar-pasang") belum cukup sebagai kecocokan.
  return named || strong || (specific && !strict) || hits >= 2 ? total : 0;
}

/** Bagikan setiap tugas ke kandidat dengan nilai tertinggi (atau yang hampir sama tingginya, maks. 3). */
/** `strict`: satu kata khas saja belum cukup (dipakai Agent HRD sebelum menambah agent ke bagan). */
export function routePrompt(text:string, candidates:Node[], most = 3, strict = false):Routing {
  const profiles = candidates.map(describe), tasks:Assignment[] = [], unmatched:string[] = [];
  for (const task of splitPrompt(text)) {
    const ranked = profiles.map(p => ({id:p.id, value:score(task, p, strict)})).filter(r => r.value >= threshold).sort((a, b) => b.value - a.value);
    const best = ranked[0]?.value ?? 0;
    const targets = ranked.filter(r => r.value >= best * .6).slice(0, most).map(r => r.id);
    if (targets.length) tasks.push({task, targets}); else unmatched.push(task);
  }
  return {tasks, unmatched};
}

const executes = (n:Node) => n.kind !== "trigger" && n.kind !== promptKind && n.kind !== routerKind && n.kind !== hrdKind;
/** Langkah yang bisa menerima tugas dari Pembagi tugas: semua langkah yang tersambung langsung darinya. */
export function routerTargets(g:G, id:string) {
  return g.edges.filter(e => e.from === id).map(e => g.nodes.find(n => n.id === e.to)).filter((n):n is Node => !!n && executes(n));
}

const near = (g:G, id:string, up:boolean) => g.edges.filter(e => (up ? e.to : e.from) === id).map(e => g.nodes.find(n => n.id === (up ? e.from : e.to))).filter((n):n is Node => !!n);
/** Agent prompt di hulu sebuah langkah, menembus Agent HRD dan Pembagi tugas. */
export function upstreamPrompts(g:G, id:string) {
  const out:Node[] = [], seen = new Set([id]), queue = [id];
  while (queue.length) for (const n of near(g, queue.shift()!, true)) {
    if (seen.has(n.id)) continue; seen.add(n.id);
    if (n.kind === promptKind) out.push(n); else if (n.kind === hrdKind || n.kind === routerKind) queue.push(n.id);
  }
  return out;
}
/** Pembagi tugas di hilir sebuah langkah, menembus Agent HRD. */
export function downstreamRouters(g:G, id:string) {
  const out:Node[] = [], seen = new Set([id]), queue = [id];
  while (queue.length) for (const n of near(g, queue.shift()!, false)) {
    if (seen.has(n.id)) continue; seen.add(n.id);
    if (n.kind === routerKind) out.push(n); else if (n.kind === hrdKind) queue.push(n.id);
  }
  return out;
}
/** Pembagi tugas yang dilayani Agent HRD: di hilirnya, atau atasannya bila HRD disambung dari Pembagi tugas. */
export function hrdRouters(g:G, id:string) {
  const list = [...downstreamRouters(g, id), ...near(g, id, true).filter(n => n.kind === routerKind)];
  return list.filter((n, i) => list.findIndex(x => x.id === n.id) === i);
}

/** Peringatan merah per langkah untuk editor: tugas di Agent prompt yang tidak cocok dengan agent mana pun. */
export function promptWarnings(g:G) {
  const out:Record<string,{unmatched:string[], note:string, routing:Routing|null, dropped:string[]}> = {};
  const allAgents = g.nodes.filter(n => agentByKind.has(n.kind) || n.kind === customAgentKind);
  for (const n of g.nodes) {
    if (n.kind === routerKind) {
      const targets = routerTargets(g, n.id);
      const sources = upstreamPrompts(g, n.id);
      const routing = routePrompt(sources.map(s => s.message).join("\n"), targets);
      out[n.id] = {unmatched:targets.length ? routing.unmatched : [], routing:targets.length ? routing : null, dropped:droppedTasks(sources.map(s => s.message).join("\n")),
        note:targets.length ? "" : "Belum ada agent tersambung. Hubungkan titik keluar Pembagi tugas ke agent pelaksana."};
    } else if (n.kind === promptKind) {
      const routers = downstreamRouters(g, n.id);
      const targets = routers.length ? routers.flatMap(r => routerTargets(g, r.id)) : allAgents;
      const routing = routePrompt(n.message, targets);
      out[n.id] = {unmatched:targets.length ? routing.unmatched : splitPrompt(n.message), routing, dropped:droppedTasks(n.message),
        note:!n.message.trim() ? "Tulis prompt di sini; satu tugas per baris." : !targets.length ? "Belum ada agent di bagan ini yang bisa menerima tugas." : routers.length ? "" : "Sambungkan ke Pembagi tugas agar tugas dibagikan otomatis."};
    }
  }
  return out;
}
