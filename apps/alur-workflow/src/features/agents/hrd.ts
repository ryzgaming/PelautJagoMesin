// Agent HRD: melengkapi bagan dengan agent Orang Mesin yang dibutuhkan prompt, dan membuka
// lowongan (beserta profil agent yang dicari) bila tidak ada satu pun agent yang sanggup.
import {accuracyStandards,agentKind,agents,divisions,type Agent,type Division} from "./organization.ts";
import {customAgentKind,downstreamRouters,hrdKind,hrdRouters,maxSteps,promptKind,routerKind,routePrompt,routerTargets,splitPrompt,upstreamPrompts,variantsOf,verbs,weight,words,type Link,type Node} from "./prompt-router.ts";

type G = {nodes:Node[], edges:Link[]};
export type Vacancy = {task:string, title:string, division:string, divisionKey:string, reportsTo:string, summary:string, skills:string[], duties:string[], rules:string[]};
export type Hire = {agent:Agent, tasks:string[], existing?:string};
export type HrdPlan = {routers:Node[], hires:Hire[], vacancies:Vacancy[], note:string, auto:boolean};

const orgNodes = agents.map(a => ({id:a.id, kind:agentKind(a), name:a.short, message:""}));
// Kata petunjuk divisi; bila tidak ada, divisi ditebak dari kartu peran yang paling mirip.
const hints:Record<string,string> = Object.fromEntries(Object.entries({
  growth:"iklan promosi pemasaran marketing konten video sosial media facebook instagram tiktok youtube seo kampanye brand merek logo",
  sales:"jual penjualan klien prospek kemitraan mitra proposal tender b2b perusahaan",
  cs:"pelanggan keluhan dukungan komunitas refund siswa pelajar member",
  finance:"pajak keuangan biaya anggaran gaji kontrak hukum legal vendor rekrut kru tiket perjalanan pembelian akuntansi faktur",
  produk:"aplikasi website situs kode server database 3d model animasi ui fitur",
  kurikulum:"manual materi modul kurikulum pelajaran kuis teknis kapal mesin",
  qa:"audit keamanan kualitas bug pengujian",
  eksekutif:"strategi rencana laporan prioritas okr data dashboard",
}).flatMap(([key, list]) => list.split(" ").map(w => [w, key])));
const title = (w:string) => w.length <= 3 && /\d/.test(w) ? w.toUpperCase() : w[0].toLocaleUpperCase("id") + w.slice(1);

function divisionFor(task:string):{division:Division|null, strength:number} {
  let best:Division|null = null, strength = 0;
  const terms = words(task), votes = new Map<string,number>();
  for (const w of terms) if (hints[w] && !verbs.has(w)) votes.set(hints[w], (votes.get(hints[w]) ?? 0) + 1);
  const voted = [...votes].sort((a, b) => b[1] - a[1])[0];
  if (voted) return {division: divisions.find(d => d.key === voted[0]) ?? null, strength: voted[1] * 10};
  for (const d of divisions) for (const a of agents.filter(x => x.division === d.key)) {
    const body = new Set(words([a.name, a.mission, ...a.tasks, ...a.outputs].join(" ")).flatMap(variantsOf));
    const value = terms.filter(w => !verbs.has(w)).reduce((sum, w) => sum + (variantsOf(w).some(v => body.has(v)) ? weight(w) : 0), 0);
    if (value > strength) { strength = value; best = d; }
  }
  return {division: strength >= 1 ? best : null, strength};
}

/** Profil agent yang perlu direkrut untuk tugas yang belum bisa dikerjakan siapa pun. */
export function vacancy(task:string):Vacancy {
  const first = task.trim().split(/\s+/)[0]?.toLocaleLowerCase("id") ?? "";
  const topic = words(task).filter((w, i) => !(i === 0 && w === first && (verbs.has(w) || /kan$/.test(w))));
  const name = "Spesialis " + (topic.slice(0, 2).map(title).join(" ") || "Tugas Baru");
  const {division} = divisionFor(task);
  const lead = division && agents.find(a => a.division === division.key && a.lead);
  const reportsTo = lead ? lead.name : "Orchestrator (Chief of Staff)";
  const where = division ? "di divisi " + division.name : "di divisi yang belum ditentukan (diputuskan Orchestrator bersama pemilik)";
  return {task, title:name, division:division?.name ?? "Belum ditentukan", divisionKey:division?.key ?? "", reportsTo,
    summary:"Dibutuhkan agent " + name + " " + where + " yang mampu: " + task.charAt(0).toLocaleLowerCase("id") + task.slice(1) + ". Melapor ke " + reportsTo + ".",
    skills:topic.slice(0, 5).map(title),
    duties:["Mengerjakan: " + task, "Menyerahkan hasil beserta sumbernya ke " + reportsTo, "Melaporkan celah data, bukan menebak"],
    rules:[accuracyStandards[0], ...(division ? ["Dilarang: " + division.forbidden[0].charAt(0).toLocaleLowerCase("id") + division.forbidden[0].slice(1)] : [])]};
}

/** Tinjau prompt terhadap agent yang sudah ada: siapa yang harus direkrut dari organisasi, dan lowongan apa yang dibuka. */
export function review(text:string, targets:Node[], present:Node[] = []) {
  const {unmatched} = routePrompt(text, targets);
  const hires = new Map<string,Hire>(), vacancies:Vacancy[] = [];
  for (const task of unmatched) {
    const id = routePrompt(task, orgNodes, 1, true).tasks[0]?.targets[0];
    const agent = id ? agents.find(a => a.id === id) : undefined;
    if (!agent) { vacancies.push(vacancy(task)); continue; }
    const hire = hires.get(agent.id) ?? {agent, tasks:[], existing:present.find(n => n.kind === agentKind(agent))?.id};
    hire.tasks.push(task); hires.set(agent.id, hire);
  }
  return {hires:[...hires.values()], vacancies};
}

export function hrdPlan(g:G, id:string):HrdPlan {
  const node = g.nodes.find(n => n.id === id)!;
  // Agent HRD tetap bekerja walau belum disambung: ia membaca Agent prompt dan Pembagi tugas yang ada di bagan.
  const loose = !g.edges.some(e => e.to === id);
  let prompts = upstreamPrompts(g, id);
  if (!prompts.length && loose) prompts = g.nodes.filter(n => n.kind === promptKind);
  let routers = hrdRouters(g, id);
  if (!routers.length) routers = unique(prompts.flatMap(p => downstreamRouters(g, p.id)));
  if (!routers.length && loose) routers = g.nodes.filter(n => n.kind === routerKind);
  const text = prompts.map(p => p.message).join("\n");
  const auto = (node as Node & {value?:string}).value !== "manual";
  if (!prompts.length) return {routers, hires:[], vacancies:[], auto, note:"Sambungkan Agent HRD setelah Agent prompt agar bisa membaca kebutuhan prompt."};
  if (!routers.length) return {routers, hires:[], vacancies:[], auto, note:"Sambungkan Agent HRD ke Pembagi tugas; agent baru akan dipasang di bawah Pembagi tugas."};
  if (!splitPrompt(text).length) return {routers, hires:[], vacancies:[], auto, note:"Prompt masih kosong."};
  const targets = routers.flatMap(r => routerTargets(g, r.id));
  return {routers, ...review(text, targets, g.nodes.filter(n => !targets.some(t => t.id === n.id))), auto, note:""};
}
const unique = (list:Node[]) => list.filter((n, i) => list.findIndex(x => x.id === n.id) === i);
export function hrdPlans(g:G) {
  return Object.fromEntries(g.nodes.filter(n => n.kind === hrdKind).map(n => [n.id, hrdPlan(g, n.id)])) as Record<string,HrdPlan>;
}

/** Kartu peran Agent baru dari satu atau beberapa lowongan bernama sama. */
export function customAgentCard(list:Vacancy[]) {
  const v = list[0], skills = [...new Set(list.flatMap(x => x.skills))];
  return ["Misi: mengerjakan " + list.map(x => x.task.charAt(0).toLocaleLowerCase("id") + x.task.slice(1)).join("; ") + ".",
    "Tugas:", ...list.map(x => "- " + x.task),
    "Kemampuan: " + (skills.join(", ") || "-"),
    "Melapor ke: " + v.reportsTo,
    "Aturan: " + v.rules.join(" ")].join("\n");
}
/** Tambahkan tugas ke kartu Agent baru yang sudah ada (sebelum baris Kemampuan). */
export function appendTasks(message:string, tasks:string[]) {
  const lines = message.split("\n"), have = new Set(lines.filter(l => l.startsWith("- ")).map(l => l.slice(2)));
  const fresh = tasks.filter(t => !have.has(t)).map(t => "- " + t);
  const at = lines.findIndex(l => /^Kemampuan\s*:/.test(l));
  lines.splice(at < 0 ? lines.length : at, 0, ...fresh);
  return lines.join("\n");
}
const ancestors = (edges:Link[], id:string) => {
  const seen = new Set<string>(), queue = [id];
  while (queue.length) { const at = queue.shift()!; for (const e of edges) if (e.to === at && !seen.has(e.from)) { seen.add(e.from); queue.push(e.from); } }
  return seen;
};

type Full = {nodes:(Node & {x:number, y:number})[], edges:(Link & {port:string})[]};
/** Pasang agent yang dibutuhkan di bawah Pembagi tugas. Tanpa `only`, hanya Agent HRD dengan rekrut otomatis yang dijalankan. */
export function applyHiring<T extends Full>(g:T, only?:string):{graph:T, added:string[], created:string[]} {
  let graph = g; const added:string[] = [], created:string[] = [];
  for (const [id, plan] of Object.entries(hrdPlans(g))) {
    if ((only ? id !== only : !plan.auto) || (!plan.hires.length && !plan.vacancies.length)) continue;
    const router = graph.nodes.find(n => n.id === plan.routers[0].id)!;
    const nodes = [...graph.nodes], edges = [...graph.edges];
    const kids = edges.filter(e => e.from === router.id).map(e => nodes.find(n => n.id === e.to)!).filter(Boolean);
    // Kotak baru disusun dalam kolom berisi 8 di kanan Pembagi tugas, agar bagan tetap mudah dibaca.
    const baseX = kids.length ? Math.min(...kids.map(n => n.x)) : router.x + 300, topY = kids.length ? Math.min(...kids.map(n => n.y)) : router.y;
    let slot = kids.length, x = 0, y = 0;
    const place = () => { x = baseX + Math.floor(slot / 8) * 260; y = topY + (slot % 8) * 110; slot++; };
    const above = ancestors(edges, router.id);
    for (const hire of plan.hires) {
      // Agent yang sudah ada di atas Pembagi tugas tidak boleh disambung lagi (membentuk putaran); pasang salinannya.
      let target = hire.existing && !above.has(hire.existing) ? hire.existing : undefined;
      if (!target && nodes.length >= maxSteps) { plan.vacancies.push(...hire.tasks.map(vacancy)); continue; }
      if (!target) {
        target = "hrd-" + hire.agent.id;
        while (nodes.some(n => n.id === target)) target += "-1";
        place();
        nodes.push({kind:agentKind(hire.agent), id:target, x, y, name:hire.agent.short, field:"email", operator:"filled", value:"", message:""} as T["nodes"][number]);
      }
      if (!edges.some(e => e.from === router.id && e.to === target)) edges.push({from:router.id, port:"out", to:target} as T["edges"][number]);
      added.push(hire.agent.short);
    }
    // Lowongan tanpa agent di organisasi: buat Agent baru lengkap dengan kartu perannya.
    let groups = new Map<string,Vacancy[]>();
    for (const v of plan.vacancies) groups.set(v.title, [...(groups.get(v.title) ?? []), v]);
    // Prompt besar dengan banyak lowongan: satukan per divisi agar bagan tidak penuh kotak.
    if (groups.size > 8) {
      groups = new Map();
      for (const v of plan.vacancies) {
        const short = divisions.find(d => d.key === v.divisionKey)?.short ?? "Umum", name = "Agent Tambahan " + short;
        groups.set(name, [...(groups.get(name) ?? []), {...v, title:name}]);
      }
    }
    for (const [name, list] of groups) {
      const same = nodes.find(n => n.kind === customAgentKind && n.name === name.slice(0, 80))
        ?? (nodes.length >= maxSteps ? [...nodes].reverse().find(n => n.kind === customAgentKind && edges.some(e => e.from === router.id && e.to === n.id)) : undefined);
      if (same) {
        const i = nodes.indexOf(same);
        nodes[i] = {...same, message:appendTasks(same.message, list.map(v => v.task))};
        if (!edges.some(e => e.from === router.id && e.to === same.id) && !above.has(same.id)) edges.push({from:router.id, port:"out", to:same.id} as T["edges"][number]);
        created.push(same.name);
        continue;
      }
      if (nodes.length >= maxSteps) break;
      const slug = name.toLocaleLowerCase("id").normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "agent";
      let target = "baru-" + slug;
      while (nodes.some(n => n.id === target)) target += "-1";
      place();
      nodes.push({kind:customAgentKind, id:target, x, y, name:name.slice(0, 80), field:"email", operator:"filled", value:list[0].divisionKey, message:customAgentCard(list)} as T["nodes"][number]);
      edges.push({from:router.id, port:"out", to:target} as T["edges"][number]);
      created.push(name);
    }
    graph = {...graph, nodes, edges};
  }
  return {graph, added, created};
}
