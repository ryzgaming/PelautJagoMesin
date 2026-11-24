import {url, apiKey} from "../config";
import {revisionProducts} from "../../src/revision-products";
import {cookie} from "./session";
import {discoverSourceLeads} from "../source-leads";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES = new Set(["evidence", "exterior", "internals", "integrator", "qa", "fuel", "freshwater", "seawater", "lubrication", "intake-exhaust"]);
const EVIDENCE = new Set(["DOCUMENTED", "OBSERVED", "ESTIMATED", "UNKNOWN"]);
const MEMORY = new Set(["DOCUMENTED", "PARTIAL", "UNVERIFIED", "NOT_APPLICABLE"]);
const STATUS = new Set(["queued", "running", "review", "needs_evidence", "failed"]);
const json = (body: unknown, status = 200) => Response.json(body, {status,
  headers: {"Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff"}});
const unavailable = () => json({error: "Layanan produksi mesin belum tersedia. Coba lagi dengan permintaan yang sama."}, 503);
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid response object");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || Array.from(value).length > max) throw new Error("Invalid response text");
  return value;
}
function id(value: unknown): string {
  const result = text(value, 36); if (!UUID.test(result)) throw new Error("Invalid response ID"); return result;
}
function choice(value: unknown, choices: Set<string>): string {
  const result = text(value, 100); if (!choices.has(result)) throw new Error("Invalid response enum"); return result;
}
function items(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error("Invalid response list"); return value;
}
function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1000 || value !== value.trim() || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : null;
  } catch { return null; }
}
function safeResultUrl(value: unknown): string | null {
  if (typeof value !== "string" || !/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.violetblackbird16\.chatgpt\.site(?:\/[A-Za-z0-9_./~-]*)?$/.test(value)) return null;
  const safe = safeSourceUrl(value); if (!safe) return null;
  const parsed = new URL(safe);
  return !parsed.port && !parsed.search && !parsed.hash ? parsed.href : null;
}
function sourceLeads(value: unknown) {
  if (value === null || value === undefined) return null;
  const lead = record(value);
  if (lead.provider !== "Internet Archive") throw new Error("Invalid source provider");
  return {provider: "Internet Archive", status: choice(lead.status, new Set(["found", "empty", "unavailable"])),
    items: items(lead.items, 4).map(value => {
      const item = record(value);
      const link = typeof item.url === "string" && /^https:\/\/archive\.org\/details\/[A-Za-z0-9._-]+$/.test(item.url) ? safeSourceUrl(item.url) : null;
      return {title: text(item.title, 220), url: link};
    })};
}
function session(value: unknown) {
  const row = record(value);
  return {id: id(row.id), request_id: id(row.request_id), brand: text(row.brand, 80), model: text(row.model, 120),
    machine_key: text(row.machine_key, 500), status: choice(row.status, STATUS),
    created_at: text(row.created_at, 80), updated_at: text(row.updated_at, 80),
    ...(row.source_product == null ? {} : {source_product: text(row.source_product, 80), revision_brief: text(row.revision_brief, 1200)}),
    result_url: safeResultUrl(row.result_url), source_leads: sourceLeads(row.source_leads)};
}
function memory(value: unknown) {
  const row = record(value);
  if (typeof row.revision !== "number" || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error("Invalid memory revision");
  const sources = items(row.sources, 12).map(value => {
    const source = record(value);
    return {id: text(source.id, 80), title: text(source.title, 160), url: safeSourceUrl(source.url),
      locator: text(source.locator, 240), evidence_status: choice(source.evidence_status, EVIDENCE)};
  });
  const sourceIds = new Set(sources.map(source => source.id));
  const decisions = items(row.decisions, 16).map(value => {
    const decision = record(value);
    const references = items(decision.source_ids, 12).map(value => text(value, 80));
    if (references.some(value => !sourceIds.has(value))) throw new Error("Invalid decision source");
    return {text: text(decision.text, 600), evidence_status: choice(decision.evidence_status, EVIDENCE), source_ids: references};
  });
  return {session_id: id(row.session_id), role: choice(row.role, ROLES), revision: row.revision,
    summary: text(row.summary, 2000), status: choice(row.status, MEMORY), sources, decisions,
    open_questions: items(row.open_questions, 12).map(value => text(value, 300)), written_at: text(row.written_at, 80)};
}
function envelope(value: unknown, requestedId: string | null) {
  const data = record(value), account_id = id(data.account_id);
  if (!requestedId) return {account_id, sessions: items(data.sessions, 50).map(session)};
  if (data.session === null) throw json({error: "Sesi mesin tidak ditemukan."}, 404);
  const current = session(data.session);
  if (current.id.toLowerCase() !== requestedId.toLowerCase()) throw new Error("Unexpected session ID");
  const memories = items(data.memory, 10).map(memory);
  const previous = items(data.previous_sessions, 20).map(session);
  const canonical = items(data.canonical_memory, 10).map(memory);
  const previousMemory = items(data.previous_memory, 10).map(memory);
  if (memories.some(row => row.session_id !== current.id) ||
      previous.some(row => row.id === current.id || row.machine_key !== current.machine_key) ||
      canonical.some(row => row.session_id === current.id || !["DOCUMENTED", "NOT_APPLICABLE"].includes(row.status)) ||
      previousMemory.some(row => row.session_id === current.id)) throw new Error("Unexpected memory scope");
  return {account_id, session: current, memory: memories, previous_sessions: previous,
    canonical_memory: canonical, previous_memory: previousMemory};
}

async function readBody(request: Request) {
  if (!request.body) throw json({error: "Isi permintaan tidak valid."}, 400);
  const reader = request.body.getReader(), decoder = new TextDecoder("utf-8", {fatal: true});
  let size = 0, body = "";
  try {
    while (true) {
      const {value, done} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw json({error: "Isi permintaan terlalu besar."}, 413); }
      body += decoder.decode(value, {stream: true});
    }
    return JSON.parse(body + decoder.decode()) as unknown;
  } catch (error) {
    throw error instanceof Response ? error : json({error: "Isi permintaan tidak valid."}, 400);
  } finally { reader.releaseLock(); }
}

export const onRequest: PagesFunction = async context => {
  const {request} = context;
  if (request.method !== "GET" && request.method !== "POST") {
    const response = json({error: "Metode tidak tersedia."}, 405); response.headers.set("Allow", "GET, POST"); return response;
  }
  const token = cookie(request, "alur_access");
  if (!token) return json({error: "Masuk untuk membuat dan melihat mesin Anda."}, 401);
  const incoming = new URL(request.url), requestedId = incoming.searchParams.get("id");
  if (request.method === "POST" && request.headers.get("origin") !== incoming.origin) return json({error: "Permintaan tidak valid."}, 403);
  try {
    let rpc: string, payload: unknown;
    if (request.method === "GET") {
      if (requestedId !== null && !UUID.test(requestedId)) return json({error: "ID sesi tidak valid."}, 400);
      rpc = requestedId ? "alur_get_machine_session?" + new URLSearchParams({p_session_id: requestedId}) : "alur_list_machine_sessions";
    } else {
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json({error: "Gunakan isi JSON."}, 415);
      const body = await readBody(request);
      if (!body || typeof body !== "object" || Array.isArray(body)) return json({error: "Isi merek dan model mesin."}, 400);
      const row = body as Record<string, unknown>;
      if ("source_product" in row || "revision_brief" in row) {
        const brief = typeof row.revision_brief === "string" ? row.revision_brief.trim() : "";
        if (Object.keys(row).some(key => !["source_product", "revision_brief", "request_id"].includes(key)) ||
            !revisionProducts.some(product => product.id === row.source_product) || !brief || Array.from(brief).length > 1200 ||
            typeof row.request_id !== "string" || !UUID.test(row.request_id)) {
          return json({error: "Pilih mesin katalog dan isi tugas revisi (maksimal 1200 karakter)."}, 400);
        }
        rpc = "alur_enqueue_machine_revision";
        payload = {p_product: row.source_product, p_brief: brief, p_request_id: row.request_id};
      } else {
        const brand = typeof row.brand === "string" ? row.brand.trim().replace(/\s+/g, " ") : "";
        const model = typeof row.model === "string" ? row.model.trim().replace(/\s+/g, " ") : "";
        if (Object.keys(row).some(key => !["brand", "model", "request_id"].includes(key)) ||
            !brand || Array.from(brand).length > 80 || !model || Array.from(model).length > 120 ||
            /[\u0000-\u001f\u007f]/.test(brand + model) || typeof row.request_id !== "string" || !UUID.test(row.request_id)) {
          return json({error: "Gunakan merek 1–80 karakter, model 1–120 karakter, dan request_id UUID."}, 400);
        }
        rpc = "alur_enqueue_machine_session"; payload = {p_brand: brand, p_model: model, p_request_id: row.request_id};
      }
    }
    const response = await fetch(url + "/rest/v1/rpc/" + rpc, {
      method: request.method, headers: {apikey: apiKey, Authorization: "Bearer " + token, "Content-Type": "application/json"},
      body: payload === undefined ? undefined : JSON.stringify(payload), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      if (response.status === 401) return json({error: "Sesi berakhir. Silakan masuk kembali."}, 401);
      if (response.status === 403 && request.method === "GET" && requestedId) return json({error: "Sesi mesin tidak ditemukan."}, 404);
      if (response.status === 403) return json({error: "Akses pemilik diperlukan untuk membuat mesin."}, 403);
      if (response.status === 409) return json({error: "Masih ada produksi aktif untuk mesin ini. Buka riwayatnya."}, 409);
      if (response.status === 400) return json({error: "Permintaan produksi tidak dapat diterima."}, 400);
      return unavailable();
    }
    const data: unknown = await response.json();
    if (request.method === "GET") return json(envelope(data, requestedId));
    const created = session(data);
    if (created.status === "queued" && created.source_leads === null && typeof context.waitUntil === "function") {
      context.waitUntil(discoverSourceLeads(created, token));
    }
    return json({session: created}, 202);
  } catch (error) { return error instanceof Response ? error : unavailable(); }
};
