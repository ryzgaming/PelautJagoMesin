// Agent Struktur: menata agent yang terhubung dengan Agent HRD (tim Pembagi tugas) menjadi bagan
// bercabang seperti perusahaan: Pembagi tugas → kepala divisi → staf divisi. Saat alur diuji,
// tugas mengalir turun lewat cabang itu (lihat execute di flow.ts).
import {agentByKind,agentKind,agents,divisionByKey} from "./organization.ts";
import {customAgentKind,delegates,hrdRouters,routerKind,routerTargets,structureKind} from "./prompt-router.ts";
import {layoutTree,type TreeNode} from "./org-tree.ts";
import {type Step} from "./flow.ts";

/** Kepala cabang yang dipasang Agent Struktur memakai awalan ini (boleh dilepas lagi bila tidak diperlukan). */
export const structurePrefix = "struktur-";
const order = ["eksekutif","kurikulum","produk","qa","growth","sales","cs","finance"];
const maxNodes = 80;

type Node = Step;
type Link = {from:string, port:string, to:string};
type Full = {nodes:Node[], edges:Link[]};
export type Branch = {division:string, label:string, head:{id:string, name:string, added:boolean}, staff:{id:string, name:string}[]};
export type StructurePlan = {routers:string[], branches:Branch[], direct:{id:string, name:string}[], auto:boolean, note:string, changed:boolean};

const leadOf = (division:string) => agents.find(a => a.division === division && a.lead);
function divisionOf(n:Node) {
  const agent = agentByKind.get(n.kind);
  if (agent) return agent.division as string;
  return n.kind === customAgentKind && divisionByKey.has(n.value) ? n.value : "";
}
const ancestors = (edges:Link[], id:string) => {
  const seen = new Set<string>(), queue = [id];
  while (queue.length) { const at = queue.shift()!; for (const e of edges) if (e.to === at && !seen.has(e.from)) { seen.add(e.from); queue.push(e.from); } }
  return seen;
};
/**
 * Pembagi tugas yang ditata satu Agent Struktur: yang tersambung dengannya (sesudah atau sebelumnya,
 * menembus Agent HRD), atau semua Pembagi tugas bila Agent Struktur belum disambung.
 */
function routersOf(g:Full, id:string):Node[] {
  const found = hrdRouters(g, id) as Node[];
  if (found.length || g.edges.some(e => e.to === id)) return found;
  return g.nodes.filter(n => n.kind === routerKind);
}

type Design = {router:Node, branches:{division:string, head:Node, added:boolean, staff:Node[]}[], direct:Node[], drop:string[]};
/** Rancang struktur satu Pembagi tugas: kelompokkan agent per divisi, satu kepala per divisi bila stafnya 2 atau lebih. */
function design(g:Full, router:Node, budget:{left:number}):Design {
  const team = routerTargets(g, router.id) as Node[];
  const above = ancestors(g.edges, router.id);
  const groups = new Map<string,Node[]>();
  const direct:Node[] = [];
  for (const n of team) {
    if (!delegates(n)) { direct.push(n); continue; }
    const d = divisionOf(n);
    if (!d) { direct.push(n); continue; }
    groups.set(d, [...(groups.get(d) ?? []), n]);
  }
  const branches:Design["branches"] = [], drop:string[] = [];
  for (const division of [...order, ...[...groups.keys()].filter(k => !order.includes(k))]) {
    const list = groups.get(division);
    if (!list) continue;
    const lead = leadOf(division);
    // Kepala: agent lead divisi yang sudah ada di tim; atau kepala buatan Agent Struktur sebelumnya.
    let head = list.find(n => agentByKind.get(n.kind)?.lead) ?? list.find(n => n.id.startsWith(structurePrefix));
    const staff = list.filter(n => n !== head);
    const made = !!head && head.id.startsWith(structurePrefix);
    if (!staff.length || (made && staff.length < 2)) {
      // Cabang hanya untuk 2 agent atau lebih. Kepala buatan Agent Struktur yang tidak diperlukan lagi dilepas.
      if (made) drop.push(head!.id); else if (head) direct.push(head);
      direct.push(...staff);
      continue;
    }
    let added = false;
    // Kepala baru hanya untuk divisi dengan 2 agent atau lebih; satu agent cukup langsung di bawah Pembagi tugas.
    if (!head && staff.length < 2) { direct.push(...staff); continue; }
    if (!head) {
      if (!lead || budget.left <= 0) { direct.push(...staff); continue; }
      // Pakai kotak kepala divisi yang masih lepas (belum tersambung) bila ada, selain itu buat baru.
      const existing = g.nodes.find(n => n.kind === agentKind(lead) && !above.has(n.id) && !g.edges.some(e => e.to === n.id || e.from === n.id));
      if (existing) head = existing;
      else {
        let id = structurePrefix + division;
        while (g.nodes.some(n => n.id === id)) id += "-1";
        head = {kind:agentKind(lead), id, x:router.x, y:router.y, name:lead.short, field:"email", operator:"filled", value:"", message:""} as Node;
        added = true; budget.left--;
      }
    }
    branches.push({division, head, added, staff});
  }
  return {router, branches, direct, drop};
}

const key = (e:Link) => e.from + "\u0000" + e.to;
/** Sambungan yang diinginkan untuk satu tim, dan sambungan lama di dalam tim yang diganti. */
function wiring(g:Full, d:Design) {
  const inside = new Set([d.router.id, ...(routerTargets(g, d.router.id) as Node[]).filter(delegates).map(n => n.id), ...d.branches.map(b => b.head.id)]);
  const want:Link[] = [
    ...d.branches.map(b => ({from:d.router.id, port:"out", to:b.head.id})),
    ...d.direct.map(n => ({from:d.router.id, port:"out", to:n.id})),
    ...d.branches.flatMap(b => b.staff.map(s => ({from:b.head.id, port:"out", to:s.id}))),
  ];
  // Sambungan lama: dari Pembagi tugas ke tim, dan antaranggota tim. Sambungan ke luar tim (misalnya ke Laporan) tetap.
  const old = g.edges.filter(e => (e.from === d.router.id && (inside.has(e.to) || d.direct.some(n => n.id === e.to))) || (inside.has(e.from) && inside.has(e.to) && e.from !== d.router.id));
  return {want, old};
}

/** Rencana Agent Struktur untuk panel editor. */
export function structurePlan(g:Full, id:string):StructurePlan {
  const node = g.nodes.find(n => n.id === id)!;
  const auto = node.value !== "manual";
  const routers = routersOf(g, id);
  if (!routers.length) return {routers:[], branches:[], direct:[], auto, changed:false,
    note:"Sambungkan Agent Struktur dengan Pembagi tugas agar agent-agentnya tersusun bercabang per divisi."};
  const budget = {left:maxNodes - g.nodes.length};
  const plans = routers.map(r => design(g, r, budget));
  const changed = plans.some(d => {
    const {want, old} = wiring(g, d);
    const now = new Set(old.map(key));
    return d.drop.length > 0 || d.branches.some(b => b.added) || want.length !== old.length || want.some(e => !now.has(key(e)));
  });
  const branches = plans.flatMap(d => d.branches.map(b => ({division:b.division, label:divisionByKey.get(b.division as never)?.short ?? b.division,
    head:{id:b.head.id, name:b.head.name, added:b.added}, staff:b.staff.map(s => ({id:s.id, name:s.name}))})));
  const direct = plans.flatMap(d => d.direct.map(n => ({id:n.id, name:n.name})));
  const note = !plans.some(d => routerTargets(g, d.router.id).length) ? "Belum ada agent di bawah Pembagi tugas. Agent HRD akan menambahkannya dari prompt." : "";
  return {routers:routers.map(r => r.id), branches, direct, auto, changed, note};
}

/**
 * Terapkan struktur: kepala divisi di bawah Pembagi tugas, staf di bawah kepalanya, lalu tata letak
 * pohon dari posisi Pembagi tugas. Tanpa `only`, hanya Agent Struktur dengan susun otomatis yang dijalankan.
 * Bila struktur sudah sesuai, bagan dikembalikan apa adanya (posisi buatan pengguna tidak diubah).
 */
export function applyStructure<T extends Full>(g:T, only?:string):{graph:T, branches:string[], changed:boolean} {
  let graph = g; const names:string[] = []; let changed = false;
  for (const s of g.nodes.filter(n => n.kind === structureKind)) {
    if (only ? s.id !== only : s.value === "manual") continue;
    for (const router of routersOf(graph, s.id)) {
      const budget = {left:maxNodes - graph.nodes.length};
      const d = design(graph, router, budget);
      const {want, old} = wiring(graph, d);
      const now = new Set(old.map(key));
      if (!d.drop.length && !d.branches.some(b => b.added) && want.length === old.length && want.every(e => now.has(key(e)))) continue;
      const gone = new Set(d.drop);
      const nodes = [...graph.nodes.filter(n => !gone.has(n.id)), ...d.branches.filter(b => b.added).map(b => b.head)].map(n => ({...n}));
      const oldKeys = new Set(old.map(key));
      const edges = [...graph.edges.filter(e => !oldKeys.has(key(e)) && !gone.has(e.from) && !gone.has(e.to)), ...want] as T["edges"];
      // Tata letak pohon dimulai dari posisi Pembagi tugas; Pembagi tugas sendiri tidak berpindah.
      const at = (id:string) => nodes.find(n => n.id === id)!;
      const tree:TreeNode = {node:at(router.id), children:[
        ...d.branches.map(b => ({node:at(b.head.id), children:b.staff.map(x => ({node:at(x.id)}))})),
        ...d.direct.map(n => ({node:at(n.id)})),
      ]};
      const keep = {x:router.x, y:router.y};
      layoutTree(tree, keep.x, 0);
      const shift = keep.y - at(router.id).y;
      const placed = new Set([router.id, ...d.branches.flatMap(b => [b.head.id, ...b.staff.map(x => x.id)]), ...d.direct.map(n => n.id)]);
      for (const n of nodes) if (placed.has(n.id)) n.y += shift;
      graph = {...graph, nodes, edges};
      changed = true;
      names.push(...d.branches.map(b => b.head.name));
    }
  }
  return {graph, branches:[...new Set(names)], changed};
}

/**
 * Pasang Agent Struktur baru langsung pada Pembagi tugas: disisipkan di sambungan masuk Pembagi tugas
 * (misalnya Agent HRD → Agent Struktur → Pembagi tugas). Tanpa Pembagi tugas, langkah ditambahkan lepas.
 */
export function spliceStructure<T extends Full>(g:T, s:T["nodes"][number]):T {
  const served = new Set(g.nodes.filter(n => n.kind === structureKind).flatMap(n => routersOf(g, n.id).map(r => r.id)));
  const router = g.nodes.find(n => n.kind === routerKind && !served.has(n.id));
  const into = router && g.edges.find(e => e.to === router.id);
  if (!router || !into) return {...g, nodes:[...g.nodes, s]};
  const from = g.nodes.find(n => n.id === into.from)!;
  const node = {...s, x:Math.round((from.x + router.x) / 2), y:Math.min(from.y, router.y) - 120};
  const edges = g.edges.filter(e => e !== into);
  edges.push({...into, to:node.id} as T["edges"][number], {from:node.id, port:"out", to:router.id} as T["edges"][number]);
  return {...g, nodes:[...g.nodes, node], edges};
}
