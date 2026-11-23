import {url, apiKey} from "../config";
import {cookie} from "./session";

const roles = ["evidence", "exterior", "internals", "integrator", "qa", "fuel", "freshwater", "seawater", "lubrication", "intake-exhaust"] as const;
const stages = new Set(["pending", "running", "review", "failed", "not_applicable"]);
const statuses = new Set(["queued", "running", "review", "failed"]);
const notes = new Set(["queued", "runner_claimed", "running", "review_ready", "review_with_gaps", "runner_failed"]);
const columns = "id,project_key,request_id,status,created_at,updated_at,progress,note";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const projectKey = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const json = (body: unknown, status = 200) => Response.json(body, {
  status, headers: {"Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff"},
});
const unavailable = () => json({error: "Antrean agen belum tersedia. Coba lagi dengan permintaan yang sama."}, 503);

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// PostgREST enforces the user's JWT and owner RLS. Select and project only the
// public job contract: never return owner IDs, lease tokens, logs or runner paths.
function publicJob(value: unknown) {
  if (!object(value) || !object(value.progress)) throw new Error("Invalid job response");
  const strings = ["id", "project_key", "request_id", "created_at", "updated_at"];
  if (strings.some(key => typeof value[key] !== "string") ||
      typeof value.status !== "string" || !statuses.has(value.status) ||
      typeof value.note !== "string" || !notes.has(value.note)) throw new Error("Invalid job response");
  const progress: Record<string, string> = {};
  for (const role of roles) {
    const stage = value.progress[role];
    if (typeof stage !== "string" || !stages.has(stage)) throw new Error("Invalid job progress");
    progress[role] = stage;
  }
  return {id: value.id, project_key: value.project_key, request_id: value.request_id,
    status: value.status, created_at: value.created_at, updated_at: value.updated_at,
    progress, note: value.note};
}

async function bodyWithinLimit(request: Request): Promise<unknown> {
  if (!request.body) throw json({error: "Isi permintaan tidak valid."}, 400);
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", {fatal: true});
  let size = 0, text = "";
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        throw json({error: "Isi permintaan terlalu besar."}, 413);
      }
      text += decoder.decode(value, {stream: true});
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof Response) throw error;
    throw json({error: "Isi permintaan tidak valid."}, 400);
  } finally {
    reader.releaseLock();
  }
}

export const onRequest: PagesFunction = async ({request}) => {
  if (request.method !== "GET" && request.method !== "POST") {
    const response = json({error: "Metode tidak tersedia."}, 405);
    response.headers.set("Allow", "GET, POST");
    return response;
  }
  const token = cookie(request, "alur_access");
  if (!token) return json({error: "Masuk untuk menggunakan antrean agen."}, 401);
  const incoming = new URL(request.url);
  if (request.method === "POST" && request.headers.get("origin") !== incoming.origin) {
    return json({error: "Permintaan tidak valid."}, 403);
  }
  try {
    let endpoint: string, payload: unknown;
    if (request.method === "GET") {
      const limit = incoming.searchParams.get("limit") ?? "20";
      if (!/^[1-9]\d?$/.test(limit) || Number(limit) > 50) return json({error: "Batas daftar harus 1–50."}, 400);
      endpoint = "/rest/v1/alur_agent_jobs?" + new URLSearchParams({
        select: columns, order: "created_at.desc,id.desc", limit,
      });
    } else {
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
        return json({error: "Gunakan isi JSON."}, 415);
      }
      const body = await bodyWithinLimit(request);
      if (!object(body) || Object.keys(body).some(key => key !== "project_key" && key !== "request_id") ||
          typeof body.project_key !== "string" || body.project_key.length > 64 || !projectKey.test(body.project_key) ||
          typeof body.request_id !== "string" || !uuid.test(body.request_id)) {
        return json({error: "Gunakan kunci proyek huruf kecil/angka dengan tanda hubung dan request_id UUID."}, 400);
      }
      endpoint = "/rest/v1/rpc/alur_enqueue_agent_job";
      payload = {p_project_key: body.project_key, p_request_id: body.request_id};
    }
    const response = await fetch(url + endpoint, {
      method: request.method,
      headers: {apikey: apiKey, Authorization: "Bearer " + token, "Content-Type": "application/json"},
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      // Never forward database error bodies; they may contain row data or SQL details.
      if (response.status === 401) return json({error: "Sesi berakhir. Silakan masuk kembali."}, 401);
      if (response.status === 403) return json({error: "Anda tidak memiliki akses ke antrean ini."}, 403);
      if (response.status === 409) return json({error: "Proyek masih memiliki pekerjaan aktif. Tunggu pekerjaan tersebut selesai."}, 409);
      if (response.status === 400) return json({error: "Permintaan antrean tidak dapat diterima."}, 400);
      return unavailable();
    }
    const data: unknown = await response.json();
    if (request.method === "POST") return json({job: publicJob(data)}, 202);
    if (!Array.isArray(data)) return unavailable();
    return json({jobs: data.map(publicJob)});
  } catch (error) {
    return error instanceof Response ? error : unavailable();
  }
};
