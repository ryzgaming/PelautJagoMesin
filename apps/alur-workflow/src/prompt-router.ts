// Agent prompt dan Pembagi tugas: prompt dipecah jadi tugas, lalu setiap tugas diserahkan
// ke langkah tersambung yang paling cocok. Tugas yang tidak cocok dilaporkan sebagai peringatan.
import {agentByKind,agents,type Agent} from "./organization.ts";
import {directoryByKind} from "./directory.ts";
import {pluginById} from "./plugins.ts";

export const promptKind = "prompt";
export const routerKind = "router";
export const hrdKind = "hrd";
/** Agent Struktur: menata agent dari Agent HRD menjadi cabang divisi (kepala → staf). */
export const structureKind = "struktur";
/** Agent baru buatan Agent HRD (atau pengguna); kartu perannya tersimpan di pesan langkah. */
export const customAgentKind = "custom-agent";
/** Bagian kartu Agent baru yang dipakai untuk mencocokkan tugas (tanpa atasan dan aturan umum). */
export function customAgentProfile(message:string) { return message.split(/\n\s*(?:Melapor ke|Aturan)\s*:/)[0]; }
/** Batas panjang prompt di Agent prompt (karakter). Cukup untuk menempelkan prompt besar. */
export const promptMax = 50000;
/** Batas jumlah tugas yang dibagikan dari satu prompt. */
export const taskMax = 2000;
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

// Penanda pesan chat yang ikut tersalin, misalnya "[26/11/2026 20:45] Nama:" atau "26/11/26 20.45 - Nama:".
const chatStamp = /^\s*(?:\[\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\]|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}[:.]\d{2}\s+-)\s*[^:\n]{1,40}:\s*/u;
// Kata pembuka perintah selain daftar kata kerja: "Jangan …", "Gunakan …", juga perintah bahasa Inggris.
const orders = new Set(("jangan tolong mohon harap silakan pastikan usahakan hindari mulai lanjutkan simulasikan cuci siram sewa pilih antar masak ganti bongkar rakit "+
  "gambar ukur baca tonton unduh unggah simpan hapus pakai ikuti tentukan lihat telusuri "+
  "create build make use find check search write design model simulate review ensure verify add avoid do don't never always").split(" "));
const contextLabels = /^(?:konteks|latar belakang|catatan|keterangan|informasi|info|context|project context|background|notes?|about|tentang)$/iu;
/** Kalimat perintah: diawali kata kerja ("Buat …", "Gunakan …", "Jangan …"). */
export function isOrder(text:string) {
  const first = text.toLocaleLowerCase("id").match(/[\p{L}']+/u)?.[0] ?? "";
  return verbs.has(first) || orders.has(first) || (first.length >= 6 && /(?:kan|lah)$/.test(first));
}
const clean = (t:string) => t.replace(/\*\*|__|`/g, "").replace(/^\s*(?:[-*•–]|\d+[.)]|[a-z][.)])\s+/u, "").replace(/^\s*\[[ xX]\]\s*/, "").trim();
const heading = (t:string) => /^\s*#{1,6}\s/.test(t) || (/\p{Lu}{2}/u.test(t) && !/\p{Ll}/u.test(t) && words(t).length > 0);
// Isi daftar: tanpa kata perintah dan pendek (maks. 5 kata setelah "Label:", 3 kata di bawah judul, 2 kata tanpa keduanya).
const short = (t:string, list:boolean, section:boolean) => !isOrder(t) && t.split(/\s+/).length <= (list ? 5 : section ? 3 : 2);

/**
 * Pecah prompt menjadi tugas. Satu baris, titik koma, atau kalimat perintah menjadi satu tugas.
 * Judul (Markdown "#" atau HURUF KAPITAL), label bagian ("Sumber:"), penanda chat, dan tautan saja tidak dihitung.
 * Isi daftar yang pendek (misalnya "YouTube", "Vimeo") digabung dengan labelnya menjadi satu tugas:
 * "Sumber video: YouTube, Vimeo". Keterangan "Label: isi" tanpa perintah dan isi bagian konteks dianggap konteks.
 */
export function splitPrompt(text:string, limit = taskMax) { return parse(text).tasks.slice(0, limit); }
/** Aturan umum di prompt ("Jangan …", "Hindari …"): berlaku untuk semua agent, jadi tidak dibagikan sebagai tugas. */
export function promptRules(text:string) { return parse(text).rules; }
const ruleWords = /^(?:jangan|hindari|dilarang|tidak boleh|never|don't|do not|avoid)\b/iu;
function parse(text:string) {
  let all = splits.get(text);
  if (!all) {
    const out:string[] = [], rules:string[] = [];
    // section: judul terakhir; list: label "…:" terakhir, berlaku sampai ada tugas biasa.
    // lead: frasa tanpa perintah (misalnya "Level A — Complete machine search") yang mungkin menjadi judul daftar berikutnya.
    let section = "", list = "", items:string[] = [], owner = "", lead = "";
    const settle = () => { if (lead) out.push(lead); lead = ""; };
    const flush = () => {
      if (items.length && !contextLabels.test(owner)) {
        for (let i = 0; i < items.length; i += 30) {
          const part = items.slice(i, i + 30).join(", ");
          out.push(owner ? owner + ": " + part : part);
        }
      }
      items = [];
    };
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(chatStamp, "");
      if (!line.trim() || /^\s*(?:```|---+\s*$|===+\s*$)/.test(line)) continue;
      if (heading(line)) { flush(); settle(); section = clean(line.replace(/^\s*#{1,6}\s*/, "")).replace(/[:.]+$/, "").trim(); list = ""; continue; }
      const body = clean(line);
      if (/:\s*$/.test(body)) { flush(); settle(); list = body.replace(/:\s*$/, "").trim(); continue; }
      for (const piece of body.split(/;|(?<=[.!?])\s+(?=[\p{Lu}\d])/u)) {
        const t = clean(piece).replace(/[.!?]+$/, "").trim();
        if (!words(t).length || /^(?:https?:\/\/|www\.)\S+$/i.test(t)) continue;
        if (lead && short(t, true, true) && !/:/.test(t)) { flush(); list = lead; lead = ""; }
        const label = list || section;
        if (short(t, !!list, !!section) && !/:/.test(t)) { if (owner !== label) flush(); owner = label; items.push(t); continue; }
        flush(); settle(); list = "";
        const meta = t.match(/^([^:]{1,40}):\s+(.+)$/u);
        // "Standard: Universal …" hanya keterangan; "Simulator: rapikan tampilan" tetap tugas.
        if (meta && !isOrder(meta[2]) && !isOrder(meta[1]) && !meta[2].includes(",")) continue;
        if (ruleWords.test(t)) { rules.push(t); continue; }
        if (contextLabels.test(section) && !isOrder(t)) continue;
        if (!isOrder(t) && t.split(/\s+/).length <= 8) lead = t; else out.push(t);
      }
    }
    flush(); settle();
    all = {tasks:[...new Set(out)], rules:[...new Set(rules)]};
    remember(splits, text, all);
  }
  return all;
}
// Hasil pemecahan dan pembagian disimpan sementara: editor menghitung ulang setiap kali bagan berubah.
const splits = new Map<string,{tasks:string[], rules:string[]}>();
function remember<K,V>(cache:Map<K,V>, key:K, value:V) { if (cache.size >= 20) cache.delete(cache.keys().next().value as K); cache.set(key, value); }
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
// Awalan kata untuk padanan longgar: 5 huruf untuk kata pendek, 6 huruf untuk kata panjang ("complete" ≠ "compliance").
const stem = (w:string) => w.slice(0, w.length >= 8 ? 6 : 5);
const profiles = new Map<string,{id:string,lines:Set<string>,label:string[],strong:Bag,body:Bag}>();
function bag(s:string):Bag {
  const all = new Set(words(s).flatMap(variants));
  return {all, pre:new Set([...all].filter(w => w.length >= 5).flatMap(w => [w.slice(0, 5), w.slice(0, 6)]))};
}
type Profile = ReturnType<typeof describe>;
function exact(set:Bag, w:string) {
  return set.all.has(w) || (w.length >= 5 && set.pre.has(stem(w)));
}
/** Kata-kata sebuah tugas beserta bobotnya, dihitung sekali per tugas (bukan per agent). */
type Term = {forms:string[], word:string, value:number, main:boolean};
function terms(task:string):Term[] {
  const list = words(task), extra = list.flatMap(w => synonyms[w] ?? []).filter(w => !list.includes(w));
  return [...list, ...extra].map(w => {
    const verb = verbs.has(w);
    return {forms:variants(w), word:w, value:weight(w) * (verb ? .5 : 1), main:!verb && list.includes(w)};
  });
}
function has(set:Bag, forms:string[]) {
  return forms.some(v => set.all.has(v) || (v.length >= 5 && set.pre.has(stem(v))));
}
function score(task:string, lower:string, list:Term[], p:Profile, strict = false) {
  // Tugas yang tertulis persis di kartu Agent baru selalu diserahkan ke agent itu.
  if (p.lines.has(task)) return 100;
  const named = p.label.some(l => lower.includes(l));
  let total = named ? 10 : 0, hits = 0, strong = false, specific = false;
  for (const t of list) {
    // Padanan dan bentuk dasar ikut menambah nilai, tetapi tidak cukup sendirian (misalnya "pelayaran" ≠ "layar").
    if (has(p.strong, t.forms)) { total += 3 * t.value; hits++; strong ||= t.main; }
    else if (has(p.body, t.forms)) { total += t.value; hits++; specific ||= t.main && t.value >= 3 && exact(p.body, t.word); }
  }
  // Satu kata kebetulan sama (misalnya "pasang" pada "bongkar-pasang") belum cukup sebagai kecocokan.
  return named || strong || (specific && !strict) || hits >= 2 ? total : 0;
}

/** Bagikan setiap tugas ke kandidat dengan nilai tertinggi (atau yang hampir sama tingginya, maks. 3). */
/** `strict`: satu kata khas saja belum cukup (dipakai Agent HRD sebelum menambah agent ke bagan). */
export function routePrompt(text:string, candidates:Node[], most = 3, strict = false):Routing {
  const profiles = candidates.map(describe);
  const key = [most, strict, ...candidates.map(n => n.id + "\u0000" + n.kind + "\u0000" + n.name + "\u0000" + n.message)].join("\u0001") + "\u0002" + text;
  const cached = routings.get(key);
  if (cached) return cached;
  const tasks:Assignment[] = [], unmatched:string[] = [];
  for (const task of splitPrompt(text)) {
    const lower = task.toLocaleLowerCase("id"), list = terms(task);
    const ranked = profiles.map(p => ({id:p.id, value:score(task, lower, list, p, strict)})).filter(r => r.value >= threshold).sort((a, b) => b.value - a.value);
    const best = ranked[0]?.value ?? 0;
    const targets = ranked.filter(r => r.value >= best * .6).slice(0, most).map(r => r.id);
    if (targets.length) tasks.push({task, targets}); else unmatched.push(task);
  }
  const made = {tasks, unmatched};
  remember(routings, key, made);
  return made;
}
const routings = new Map<string,Routing>();

const executes = (n:Node) => n.kind !== "trigger" && n.kind !== promptKind && n.kind !== routerKind && n.kind !== hrdKind && n.kind !== structureKind;
/** Agent yang bisa menjadi atasan dalam struktur bercabang (meneruskan tugas ke stafnya). */
export const delegates = (n:{kind:string}) => agentByKind.has(n.kind) || n.kind === customAgentKind;
/**
 * Tim sebuah Pembagi tugas: langkah yang tersambung langsung, ditambah staf di bawah agent
 * (struktur bercabang: Pembagi tugas → kepala divisi → staf). Semua anggota bisa menerima tugas.
 */
export function routerTargets(g:G, id:string) {
  const out:Node[] = [], seen = new Set([id]), queue = [id];
  while (queue.length) {
    const at = queue.shift()!, top = at === id;
    for (const e of g.edges) {
      if (e.from !== at || seen.has(e.to)) continue;
      const n = g.nodes.find(x => x.id === e.to);
      if (!n || !(top ? executes(n) : delegates(n))) continue;
      seen.add(n.id); out.push(n);
      if (delegates(n)) queue.push(n.id);
    }
  }
  return out;
}

const near = (g:G, id:string, up:boolean) => g.edges.filter(e => (up ? e.to : e.from) === id).map(e => g.nodes.find(n => n.id === (up ? e.from : e.to))).filter((n):n is Node => !!n);
/** Agent prompt di hulu sebuah langkah, menembus Agent HRD dan Pembagi tugas. */
export function upstreamPrompts(g:G, id:string) {
  const out:Node[] = [], seen = new Set([id]), queue = [id];
  while (queue.length) for (const n of near(g, queue.shift()!, true)) {
    if (seen.has(n.id)) continue; seen.add(n.id);
    if (n.kind === promptKind) out.push(n); else if (n.kind === hrdKind || n.kind === routerKind || n.kind === structureKind) queue.push(n.id);
  }
  return out;
}
/** Pembagi tugas di hilir sebuah langkah, menembus Agent HRD dan Agent Struktur. */
export function downstreamRouters(g:G, id:string) {
  const out:Node[] = [], seen = new Set([id]), queue = [id];
  while (queue.length) for (const n of near(g, queue.shift()!, false)) {
    if (seen.has(n.id)) continue; seen.add(n.id);
    if (n.kind === routerKind) out.push(n); else if (n.kind === hrdKind || n.kind === structureKind) queue.push(n.id);
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
