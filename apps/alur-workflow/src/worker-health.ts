/** Perkiraan kondisi tiap pekerja dari jejak aktivitasnya. Sisa token persis hanya ada di halaman Usage penyedia. */
export type WorkerName = "claude" | "codex";
export type Health = {tone: "ok" | "busy" | "warn" | "off" | "idle", label: string, detail: string};
type Session = {status: string, worker?: string | null, updated_at: string, brand?: string, model?: string};
type Settings = {primary_worker: WorkerName, claude_enabled: boolean, codex_enabled: boolean, takeover_minutes: number};

export const usageLinks: Record<WorkerName, string> = {
  claude: "https://claude.ai/settings/usage",
  codex: "https://chatgpt.com/codex/settings/usage",
};
const finished = new Set(["review", "needs_evidence", "failed"]);
const day = (value: string | number) => new Date(value).toLocaleDateString("en-CA", {timeZone: "Asia/Jakarta"});

function since(minutes: number) {
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} jam lalu` : `${Math.round(hours / 24)} hari lalu`;
}

/** Mesin yang diselesaikan pekerja ini hari ini (WIB). */
export function finishedToday(worker: WorkerName, sessions: Session[], now: number) {
  const today = day(now);
  return sessions.filter(s => s.worker === worker && finished.has(s.status) && day(s.updated_at) === today).length;
}

/**
 * Aktivitas terakhir = check-in klaim atau heartbeat sesi yang sedang dikerjakan.
 * Claude dijadwalkan tiap jam, jadi diam lebih dari 90 menit (atau waktu ambil alih, mana yang lebih lama)
 * kemungkinan besar berarti tokennya habis atau automasinya berhenti.
 */
export function workerHealth(worker: WorkerName, settings: Settings, checkin: string | null, sessions: Session[], now: number): Health {
  if (!(worker === "claude" ? settings.claude_enabled : settings.codex_enabled))
    return {tone: "off", label: "Dijeda", detail: "Tidak mengambil antrean"};
  const running = sessions.filter(s => s.worker === worker && s.status === "running");
  const times = [checkin, ...running.map(s => s.updated_at)].filter((t): t is string => !!t).map(t => new Date(t).getTime()).filter(t => !Number.isNaN(t));
  if (!times.length) return {tone: "idle", label: "Belum pernah jalan", detail: worker === "codex" ? "Automasi Codex belum aktif" : "Menunggu jadwal pertama"};
  const minutes = Math.max(0, Math.round((now - Math.max(...times)) / 60000));
  const limit = Math.max(90, settings.takeover_minutes);
  if (minutes > limit) return {tone: "warn", label: "Kemungkinan token habis", detail: `Tidak ada aktivitas sejak ${since(minutes)}`};
  const job = running[0];
  if (job) return {tone: "busy", label: "Sedang bekerja", detail: `${job.brand ?? ""} ${job.model ?? ""}`.trim() + ` · ${since(minutes)}`};
  return {tone: "ok", label: "Siap", detail: `Aktif ${since(minutes)}`};
}
