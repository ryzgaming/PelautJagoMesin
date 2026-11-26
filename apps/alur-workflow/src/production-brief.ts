// Brief produksi dari bagan: prompt, pembagian tugas, dan aturan umum yang ikut masuk antrean
// produksi mesin, lalu dibaca pekerja Claude/Codex. Dipakai browser (membuat) dan server (memeriksa).
import {promptKind, promptMax, splitPrompt} from "./prompt-router.ts";

export const briefLimits = {name: 120, prompt: promptMax, tasks: 2000, task: 2000, agents: 3, agent: 80, rules: 500, rule: 2000, bytes: 600000};
export type BriefTask = {task: string, agents: string[]};
export type FlowBrief = {version: 1, flow_id: string, flow_name: string, prompt: string, tasks: BriefTask[], rules: string[], unmatched: string[]};
export type FlowBriefInfo = {flow_name: string, tasks: number, rules: number};
/** Ukuran brief menurut JSON ringkas; database memakai batas sedikit lebih longgar untuk format jsonb. */
export const briefBytes = (b: FlowBrief) => new TextEncoder().encode(JSON.stringify(b)).length;
type Graph = {id: string, name: string, nodes: {kind: string, message: string}[]};
type Result = {assignments?: {name: string, tasks: string[]}[], rules?: string[], warnings?: string[], prompts?: string[]};

const unmatchedPrefix = "Tidak ada agent yang cocok untuk: ";
const cut = (s: string, n: number) => Array.from(s).slice(0, n).join("").trim();

/** Bagan dengan Agent prompt berisi bisa dikirim ke produksi bersama brief-nya. */
export function hasPrompt(g: Graph) { return g.nodes.some(n => n.kind === promptKind && n.message.trim()); }

/**
 * Susun brief dari bagan dan hasil Uji alur. Prompt diambil dari hasil uji (isian seperti {nama} sudah
 * terisi), sehingga sama persis dengan teks yang dibagi ke agent. Urutan tugas mengikuti urutan di prompt.
 */
export function buildBrief(g: Graph, result: Result, notes = ""): FlowBrief {
  const rendered = (result.prompts ?? []).map(p => p.trim()).filter(Boolean);
  const raw = g.nodes.filter(n => n.kind === promptKind).map(n => n.message.trim()).filter(Boolean);
  const prompt = cut((rendered.length ? rendered : raw).join("\n\n") || notes, briefLimits.prompt);
  const owners = new Map<string, string[]>();
  for (const a of result.assignments ?? []) for (const t of a.tasks) {
    const list = owners.get(t) ?? [];
    if (!list.includes(a.name) && list.length < briefLimits.agents) list.push(cut(a.name, briefLimits.agent));
    owners.set(t, list);
  }
  const order = new Map(splitPrompt(prompt).map((t, i) => [t, i]));
  const tasks = [...owners].sort((a, b) => (order.get(a[0]) ?? 1e9) - (order.get(b[0]) ?? 1e9))
    .slice(0, briefLimits.tasks).map(([task, agents]) => ({task: cut(task, briefLimits.task), agents}));
  const unmatched = (result.warnings ?? []).filter(w => w.startsWith(unmatchedPrefix))
    .map(w => cut(w.slice(unmatchedPrefix.length), briefLimits.task)).slice(0, briefLimits.tasks);
  return {version: 1, flow_id: cut(g.id, 80), flow_name: cut(g.name, briefLimits.name) || "Bagan", prompt,
    tasks, rules: (result.rules ?? []).slice(0, briefLimits.rules).map(r => cut(r, briefLimits.rule)), unmatched};
}

const str = (v: unknown, max: number, empty = false) => typeof v === "string" && (empty || !!v.trim()) && Array.from(v).length <= max && !/[\u0000]/.test(v);
const list = (v: unknown, max: number, each: number) => Array.isArray(v) && v.length <= max && v.every(x => str(x, each));
/** Periksa bentuk brief sebelum masuk database (aturan yang sama ditegakkan lagi di SQL). */
export function validBrief(v: unknown): v is FlowBrief {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const b = v as Record<string, unknown>;
  if (Object.keys(b).sort().join() !== "flow_id,flow_name,prompt,rules,tasks,unmatched,version") return false;
  return b.version === 1 && str(b.flow_id, 80) && str(b.flow_name, briefLimits.name) && str(b.prompt, briefLimits.prompt) &&
    Array.isArray(b.tasks) && b.tasks.length >= 1 && b.tasks.length <= briefLimits.tasks &&
    b.tasks.every(t => !!t && typeof t === "object" && !Array.isArray(t) && Object.keys(t).sort().join() === "agents,task" &&
      str((t as BriefTask).task, briefLimits.task) && list((t as BriefTask).agents, briefLimits.agents, briefLimits.agent)) &&
    list(b.rules, briefLimits.rules, briefLimits.rule) && list(b.unmatched, briefLimits.tasks, briefLimits.task) &&
    briefBytes(b as FlowBrief) <= briefLimits.bytes;
}

/**
 * Ringkasan brief yang ditampilkan di daftar sesi mesin (isi lengkap hanya dibaca pekerja).
 * Ringkasan yang aneh diabaikan, bukan dilempar, agar satu sesi tidak merusak seluruh daftar.
 */
export function briefInfo(v: unknown): FlowBriefInfo | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const b = v as Record<string, unknown>;
  if (!str(b.flow_name, briefLimits.name, true) || !Number.isSafeInteger(b.tasks) || !Number.isSafeInteger(b.rules)) return null;
  return {flow_name: (b.flow_name as string).trim() || "Bagan", tasks: b.tasks as number, rules: b.rules as number};
}
