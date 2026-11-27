// Agent Penghimpun: mengumpulkan hasil kerja semua agent dalam satu alur menjadi satu prompt tertata.
// Struktur yang sama dipakai Agent Word untuk membuat dokumen .docx, jadi isi Markdown dan Word selalu sama.
import type {Assignment} from "./flow.ts";

export const compilerKind = "penghimpun";
export const wordKind = "word";

export type Block =
  | {t: "title" | "subtitle" | "h1" | "h2" | "p" | "note", text: string}
  | {t: "bullet", items: string[]}
  | {t: "number", items: string[]}
  | {t: "table", head: [string, string], rows: [string, string][]};

export type CompileInput = {
  flow: string, when: Date, prompts?: string[], assignments: Assignment[], rules?: string[],
  warnings?: string[], recruit?: {title: string, summary?: string}[]
};

const unmatchedPrefix = "Tidak ada agent yang cocok untuk: ";
const id = (n: number) => n.toLocaleString("id-ID");

/** Susunan dokumen terhimpun: konteks, ringkasan, aturan, tugas per agent, celah, dan format hasil. */
export function compileBlocks(x: CompileInput): Block[] {
  const prompts = (x.prompts ?? []).map(p => p.trim()).filter(Boolean);
  const rules = x.rules ?? [], warnings = x.warnings ?? [], recruit = x.recruit ?? [];
  const unmatched = warnings.filter(w => w.startsWith(unmatchedPrefix)).map(w => w.slice(unmatchedPrefix.length));
  const other = warnings.filter(w => !w.startsWith(unmatchedPrefix));
  const agents = [...x.assignments].filter(a => a.tasks.length).sort((a, b) => b.tasks.length - a.tasks.length);
  const total = new Set(agents.flatMap(a => a.tasks)).size;
  const b: Block[] = [
    {t: "title", text: "Prompt terhimpun — " + x.flow},
    {t: "subtitle", text: "Disusun Agent Penghimpun · " + x.when.toLocaleString("id-ID", {dateStyle: "long", timeStyle: "short"})},
    {t: "h1", text: "1. Ringkasan"},
    {t: "table", head: ["Butir", "Jumlah"], rows: [
      ["Tugas yang dibagikan", id(total)], ["Agent pelaksana", id(agents.length)], ["Aturan umum", id(rules.length)],
      ["Tugas tanpa agent", id(unmatched.length)], ["Agent yang masih dicari", id(recruit.length)]]},
    {t: "h1", text: "2. Tujuan dan konteks"}
  ];
  if (prompts.length) for (const p of prompts) for (const para of p.split(/\n+/)) { const s = para.trim(); if (s) b.push({t: "p", text: s}); }
  else b.push({t: "note", text: "Belum ada prompt pada alur ini. Isi Agent prompt agar tujuan kerja tercatat."});
  b.push({t: "h1", text: "3. Aturan umum untuk semua agent"});
  if (rules.length) b.push({t: "number", items: rules}); else b.push({t: "note", text: "Tidak ada aturan umum."});
  b.push({t: "h1", text: "4. Tugas per agent"});
  if (!agents.length) b.push({t: "note", text: "Belum ada tugas yang dibagikan. Sambungkan Pembagi tugas ke agent pelaksana."});
  agents.forEach((a, i) => { b.push({t: "h2", text: "4." + (i + 1) + " " + a.name + " (" + id(a.tasks.length) + " tugas)"}, {t: "number", items: a.tasks}); });
  if (unmatched.length || other.length || recruit.length) {
    b.push({t: "h1", text: "5. Celah yang perlu ditindaklanjuti"});
    if (unmatched.length) b.push({t: "h2", text: "Tugas tanpa agent"}, {t: "bullet", items: unmatched});
    if (recruit.length) b.push({t: "h2", text: "Agent yang masih dicari"}, {t: "bullet", items: recruit.map(v => v.title + (v.summary ? " — " + v.summary : ""))});
    if (other.length) b.push({t: "h2", text: "Peringatan lain"}, {t: "bullet", items: other});
  }
  b.push({t: "h1", text: (unmatched.length || other.length || recruit.length ? "6" : "5") + ". Format hasil yang diminta"},
    {t: "number", items: [
      "Kerjakan tugas sesuai urutan dan agent di bagian 4; patuhi semua aturan umum di bagian 3.",
      "Setiap fakta mencantumkan sumber dan lokasinya (halaman, gambar, atau timestamp).",
      "Data yang tidak bisa dibuktikan ditandai UNVERIFIED, bukan ditebak.",
      "Laporan akhir per agent berisi: yang dikerjakan, hasil, sumber, dan pertanyaan terbuka."]});
  return b;
}

/** Versi Markdown, untuk disalin ke chat Claude/Codex atau diunduh. */
export function blocksMarkdown(blocks: Block[]) {
  const out: string[] = [];
  for (const k of blocks) {
    if (k.t === "title") out.push("# " + k.text, "");
    else if (k.t === "subtitle") out.push("_" + k.text + "_", "");
    else if (k.t === "h1") out.push("## " + k.text, "");
    else if (k.t === "h2") out.push("### " + k.text, "");
    else if (k.t === "p") out.push(k.text, "");
    else if (k.t === "note") out.push("> " + k.text, "");
    else if (k.t === "bullet") out.push(...k.items.map(s => "- " + s), "");
    else if (k.t === "number") out.push(...k.items.map((s, i) => (i + 1) + ". " + s), "");
    else if (k.t === "table") out.push("| " + k.head.join(" | ") + " |", "|---|---|", ...k.rows.map(r => "| " + r.join(" | ") + " |"), "");
  }
  return out.join("\n");
}

export const compilePrompt = (x: CompileInput) => blocksMarkdown(compileBlocks(x));

/** Nama berkas aman dari nama alur. */
export function fileStem(prefix: string, flow: string) {
  return prefix + "-" + (flow.toLocaleLowerCase("id").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60) || "alur");
}
