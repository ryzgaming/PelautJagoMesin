import {url, apiKey} from "../config";
import {cookie} from "./session";

const WORKERS = new Set(["claude", "codex"]);
const QUEUE = ["queued", "running", "review", "needs_evidence", "failed"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => Response.json(body, {status,
  headers: {"Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff"}});
const unavailable = () => json({error: "Pengaturan produksi belum tersedia. Coba lagi sebentar lagi."}, 503);
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid object");
  return value as Record<string, unknown>;
}
function time(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > 80 || Number.isNaN(Date.parse(value))) throw new Error("Invalid time");
  return value;
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Invalid boolean"); return value;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid count"); return value;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || Array.from(value).length > max) throw new Error("Invalid text"); return value;
}
export function envelope(value: unknown) {
  const data = record(value), settings = record(data.settings), workers = record(data.workers), queue = record(data.queue);
  const primary = settings.primary_worker, minutes = settings.takeover_minutes;
  if (typeof primary !== "string" || !WORKERS.has(primary) || typeof minutes !== "number" ||
      !Number.isInteger(minutes) || minutes < 15 || minutes > 1440 || !Array.isArray(data.active) || data.active.length > 5) {
    throw new Error("Invalid settings");
  }
  return {
    settings: {primary_worker: primary, claude_enabled: bool(settings.claude_enabled), codex_enabled: bool(settings.codex_enabled),
      takeover_minutes: minutes, updated_at: time(settings.updated_at)},
    workers: {claude: time(workers.claude), codex: time(workers.codex)},
    primary_alive: bool(data.primary_alive),
    queue: Object.fromEntries(QUEUE.map(status => [status, count(queue[status])])),
    active: data.active.map(value => {
      const row = record(value);
      if (typeof row.id !== "string" || !UUID.test(row.id)) throw new Error("Invalid id");
      if (row.worker !== null && (typeof row.worker !== "string" || !WORKERS.has(row.worker))) throw new Error("Invalid worker");
      return {id: row.id, brand: text(row.brand, 80), model: text(row.model, 120), worker: row.worker, updated_at: time(row.updated_at)};
    }),
  };
}

export const onRequest: PagesFunction = async ({request}) => {
  if (request.method !== "GET" && request.method !== "POST") {
    const response = json({error: "Metode tidak tersedia."}, 405); response.headers.set("Allow", "GET, POST"); return response;
  }
  const token = cookie(request, "alur_access");
  if (!token) return json({error: "Masuk sebagai pemilik untuk membuka pengaturan."}, 401);
  let rpc = "alur_get_production_settings", payload: unknown;
  if (request.method === "POST") {
    if (request.headers.get("origin") !== new URL(request.url).origin) return json({error: "Permintaan tidak valid."}, 403);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json({error: "Gunakan isi JSON."}, 415);
    let body: unknown;
    try {
      const raw = await request.text();
      if (raw.length > 2048) return json({error: "Isi permintaan terlalu besar."}, 413);
      body = JSON.parse(raw);
    } catch { return json({error: "Isi permintaan tidak valid."}, 400); }
    const row = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
    const keys = ["primary_worker", "claude_enabled", "codex_enabled", "takeover_minutes"];
    if (!row || Object.keys(row).length !== keys.length || !keys.every(key => key in row) ||
        typeof row.primary_worker !== "string" || !WORKERS.has(row.primary_worker) ||
        typeof row.claude_enabled !== "boolean" || typeof row.codex_enabled !== "boolean" ||
        typeof row.takeover_minutes !== "number" || !Number.isInteger(row.takeover_minutes) ||
        row.takeover_minutes < 15 || row.takeover_minutes > 1440) {
      return json({error: "Pengaturan tidak valid. Waktu ambil alih 15–1440 menit."}, 400);
    }
    rpc = "alur_save_production_settings";
    payload = {p_primary: row.primary_worker, p_claude: row.claude_enabled, p_codex: row.codex_enabled, p_takeover: row.takeover_minutes};
  }
  try {
    const response = await fetch(url + "/rest/v1/rpc/" + rpc, {
      method: request.method, headers: {apikey: apiKey, Authorization: "Bearer " + token, "Content-Type": "application/json"},
      body: payload === undefined ? undefined : JSON.stringify(payload), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      if (response.status === 401) return json({error: "Sesi berakhir. Silakan masuk kembali."}, 401);
      if (response.status === 403) return json({error: "Hanya pemilik yang dapat membuka pengaturan produksi."}, 403);
      if (response.status === 400) return json({error: "Pengaturan tidak dapat diterima."}, 400);
      return unavailable();
    }
    return json(envelope(await response.json()));
  } catch { return unavailable(); }
};
