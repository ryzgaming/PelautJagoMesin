/** Menghubungkan bagan "Produksi mesin 3D" dengan sesi produksi di tab Agen mesin. */

export type Tone = "done" | "warn" | "pending" | "na" | "active" | "failed";
export type Badge = {tone: Tone, label: string};
type RoleMemory = {role: string, status: string};
type SessionLike = {status: string, worker?: string | null};

// Merek yang namanya lebih dari satu kata. Merek lain dianggap satu kata pertama.
const multiWordBrands = ["Alfa Laval", "MAN Energy Solutions", "MAN B&W", "Mitsubishi Heavy Industries", "Rolls-Royce Power Systems", "Hyundai Himsen", "Daihatsu Diesel", "Niigata Power Systems"];

export function splitMachine(text: string): {brand: string, model: string} {
  const clean = text.trim().replace(/\s+/g, " ");
  const known = multiWordBrands.find(b => clean.toLowerCase() === b.toLowerCase() || clean.toLowerCase().startsWith(b.toLowerCase() + " "));
  if (known) return {brand: clean.slice(0, known.length), model: clean.slice(known.length).trim()};
  const space = clean.indexOf(" ");
  return space < 0 ? {brand: clean, model: ""} : {brand: clean.slice(0, space), model: clean.slice(space + 1)};
}

/** Peran pipeline Agen mesin → kotak di bagan produksi yang menanganinya. */
export const roleNodes: Record<string, string[]> = {
  evidence: ["dokumentasi-oem", "inventaris", "dimensi"],
  fuel: ["spesialis-diesel"],
  "intake-exhaust": ["spesialis-diesel"],
  freshwater: ["spesialis-pendingin"],
  seawater: ["spesialis-pendingin"],
  lubrication: ["spesialis-pompa"],
  exterior: ["pemodel"],
  internals: ["pemodel"],
  integrator: ["pipeline"],
  qa: ["kepala-qa", "auditor"],
};

const memoryTone: Record<string, Badge> = {
  DOCUMENTED: {tone: "done", label: "Terbukti"},
  PARTIAL: {tone: "warn", label: "Sebagian"},
  UNVERIFIED: {tone: "warn", label: "Belum terverifikasi"},
  NOT_APPLICABLE: {tone: "na", label: "Tidak berlaku"},
};
const rank: Tone[] = ["failed", "warn", "pending", "active", "done", "na"];

export const sessionBadges: Record<string, Badge> = {
  queued: {tone: "pending", label: "Dalam antrean"},
  running: {tone: "active", label: "Sedang bekerja"},
  review: {tone: "done", label: "Siap direview"},
  needs_evidence: {tone: "warn", label: "Bukti kurang"},
  failed: {tone: "failed", label: "Terhenti"},
};

/** Status tiap kotak dari memori peran sesi. Satu kotak dengan beberapa peran memakai status terlemah. */
export function productionBadges(session: SessionLike, memory: RoleMemory[]): Record<string, Badge> {
  const waiting: Badge = session.status === "failed" ? {tone: "failed", label: "Terhenti"}
    : session.status === "running" ? {tone: "pending", label: "Menunggu"} : {tone: "pending", label: "Belum mulai"};
  const latest = new Map<string, RoleMemory>();
  for (const row of memory) latest.set(row.role, row);
  const perNode = new Map<string, Badge[]>();
  for (const [role, nodes] of Object.entries(roleNodes)) {
    const row = latest.get(role);
    const badge = row ? memoryTone[row.status] ?? waiting : waiting;
    for (const node of nodes) perNode.set(node, [...perNode.get(node) ?? [], badge]);
  }
  const who = session.worker === "claude" ? "Claude" : session.worker === "codex" ? "Codex" : "";
  const badges: Record<string, Badge> = {direktur: session.status === "running" && who
    ? {tone: "active", label: who + " bekerja"} : sessionBadges[session.status] ?? waiting};
  for (const [node, list] of perNode) {
    const done = list.filter(b => b.tone === "done" || b.tone === "na");
    badges[node] = done.length === list.length && list.some(b => b.tone === "done")
      ? {tone: "done", label: "Terbukti"}
      : list.slice().sort((a, b) => rank.indexOf(a.tone) - rank.indexOf(b.tone))[0];
  }
  return badges;
}

/** Urutan 10 peran produksi, sama dengan urutan kerja di runbook pekerja. */
export const roleOrder = [
  {key: "evidence", name: "Bukti"},
  {key: "fuel", name: "Bahan bakar"},
  {key: "freshwater", name: "Air tawar"},
  {key: "seawater", name: "Air laut"},
  {key: "lubrication", name: "Pelumasan"},
  {key: "intake-exhaust", name: "Udara & gas buang"},
  {key: "exterior", name: "Eksterior"},
  {key: "internals", name: "Internal"},
  {key: "integrator", name: "Integrator"},
  {key: "qa", name: "Agen Produksi"},
] as const;
export type RoleStep = {key: string, name: string, tone: Tone, label: string};
export type Progress = {steps: RoleStep[], done: number, partial: number, waiting: number, percent: number};

/** Status tiap peran (checkpoint terakhir) untuk strip progres 10 tahap. */
export function roleProgress(session: SessionLike, memory: RoleMemory[]): Progress {
  const latest = new Map<string, RoleMemory>();
  for (const row of memory) latest.set(row.role, row);
  const waiting: Badge = session.status === "failed" ? {tone: "failed", label: "Terhenti"}
    : session.status === "running" ? {tone: "pending", label: "Menunggu giliran"} : {tone: "pending", label: "Belum mulai"};
  const steps = roleOrder.map(role => {
    const row = latest.get(role.key);
    const badge = row ? memoryTone[row.status] ?? waiting : waiting;
    return {key: role.key, name: role.name, tone: badge.tone, label: badge.label};
  });
  const done = steps.filter(s => s.tone === "done" || s.tone === "na").length;
  const partial = steps.filter(s => s.tone === "warn").length;
  return {steps, done, partial, waiting: steps.length - done - partial, percent: Math.round(done / steps.length * 100)};
}
