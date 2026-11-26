import {url, apiKey} from "../config";
import {cookie} from "./session";

const KINDS = new Set(["search", "open", "read", "think", "write", "model", "check", "info"]);
const WORKERS = new Set(["claude", "codex"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => Response.json(body, {status,
  headers: {"Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff"}});

/** Validasi balasan database: hanya baris aktivitas yang dikenali, URL https saja. */
export function activity(value: unknown, session: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid envelope");
  const data = value as Record<string, unknown>;
  if (data.session_id !== session || !Array.isArray(data.items) || data.items.length > 50) throw new Error("Invalid envelope");
  return {session_id: session, items: data.items.map(raw => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid item");
    const row = raw as Record<string, unknown>;
    if (typeof row.id !== "number" || !Number.isSafeInteger(row.id) || row.id < 1) throw new Error("Invalid id");
    if (typeof row.at !== "string" || row.at.length > 80 || Number.isNaN(Date.parse(row.at))) throw new Error("Invalid time");
    if (typeof row.kind !== "string" || !KINDS.has(row.kind)) throw new Error("Invalid kind");
    if (typeof row.message !== "string" || !row.message.trim() || Array.from(row.message).length > 200) throw new Error("Invalid message");
    if (row.worker !== null && (typeof row.worker !== "string" || !WORKERS.has(row.worker))) throw new Error("Invalid worker");
    let link: string | null = null;
    if (typeof row.url === "string") {
      try { const parsed = new URL(row.url); if (parsed.protocol === "https:" && row.url.length <= 500) link = parsed.href; } catch {}
    }
    return {id: row.id, at: row.at, worker: row.worker, kind: row.kind, message: row.message, url: link};
  })};
}

export const onRequest: PagesFunction = async ({request}) => {
  if (request.method !== "GET") {
    const response = json({error: "Metode tidak tersedia."}, 405); response.headers.set("Allow", "GET"); return response;
  }
  const token = cookie(request, "alur_access");
  if (!token) return json({error: "Masuk sebagai pemilik untuk melihat aktivitas."}, 401);
  const params = new URL(request.url).searchParams, id = params.get("id") ?? "", after = params.get("after") ?? "0";
  if (!UUID.test(id) || !/^\d{1,15}$/.test(after)) return json({error: "Permintaan tidak valid."}, 400);
  try {
    const response = await fetch(url + "/rest/v1/rpc/alur_get_machine_activity", {
      method: "POST", headers: {apikey: apiKey, Authorization: "Bearer " + token, "Content-Type": "application/json"},
      body: JSON.stringify({p_session_id: id, p_after: Number(after)}), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      if (response.status === 401) return json({error: "Sesi berakhir. Silakan masuk kembali."}, 401);
      if (response.status === 403) return json({error: "Aktivitas sesi ini tidak tersedia."}, 403);
      return json({error: "Aktivitas belum tersedia."}, 503);
    }
    return json(activity(await response.json(), id.toLowerCase()));
  } catch { return json({error: "Aktivitas belum tersedia."}, 503); }
};
