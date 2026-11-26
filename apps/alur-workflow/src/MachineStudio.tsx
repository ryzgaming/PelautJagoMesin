import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Layers3,
  LoaderCircle,
  LogIn,
  Plus,
  RefreshCw,
} from "lucide-react";
import { api, ApiError } from "./api";
import { revisionProducts, workspaceBrief } from "./revision-products";
import { stages } from "./AgentStudio";
import "./machine-studio.css";

export type SessionStatus =
  "queued" | "running" | "review" | "needs_evidence" | "failed";
export type EvidenceStatus =
  "DOCUMENTED" | "PARTIAL" | "UNVERIFIED" | "NOT_APPLICABLE";
type Source = {
  id: string;
  title: string;
  url: string | null;
  locator: string;
  evidence_status: string;
};
type Decision = { text: string; evidence_status: string; source_ids: string[] };
export type Memory = {
  session_id: string;
  role: string;
  revision: number;
  summary: string;
  sources: Source[];
  decisions: Decision[];
  open_questions: string[];
  status: EvidenceStatus;
  written_at: string;
};
export type MachineSession = {
  id: string;
  request_id: string;
  brand: string;
  model: string;
  machine_key: string;
  revision_brief?: string;
  source_product?: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  result_url: string | null;
  source_leads?: {
    provider: string;
    status: string;
    items: { url: string; title: string }[];
  } | null;
};
export type Detail = {
  account_id: string;
  session: MachineSession;
  memory: Memory[];
  previous_sessions: MachineSession[];
  canonical_memory: Memory[];
  previous_memory: Memory[];
};
type Pending = Pick<MachineSession, "brand" | "model" | "request_id" | "source_product" | "revision_brief">;
export const statusLabels: Record<SessionStatus, string> = {
  queued: "Dalam antrean",
  running: "Agen sedang bekerja",
  review: "Siap Anda review",
  needs_evidence: "Bukti belum lengkap",
  failed: "Proses terhenti",
};
const statusText: Record<SessionStatus, string> = {
  queued:
    "Pencarian awal dimulai saat dikirim. Pekerja 3D memeriksa antrean setiap 10 menit.",
  running: "Kemajuan dan catatan agen diperbarui selama proses berjalan.",
  review: "Baca hasil dan catatan agen sebelum menentukan revisi berikutnya.",
  needs_evidence: "Bagian yang belum didukung sumber dicatat pada memori agen.",
  failed:
    "Pekerjaan berhenti. Catatan yang sudah tersimpan tetap dapat dibaca.",
};
const evidenceLabels: Record<EvidenceStatus, string> = {
  DOCUMENTED: "Terdokumentasi",
  PARTIAL: "Sebagian terbukti",
  UNVERIFIED: "Belum terverifikasi",
  NOT_APPLICABLE: "Tidak berlaku",
};
const roleList = stages.flatMap((stage) =>
  stage.roles.map((role) => ({
    key: role.key as string,
    name: role.name,
    detail: role.detail,
  })),
);
const roleKeys = new Set(roleList.map((role) => role.key));
const pendingKey = (owner: string) => "alur.machine.pending.v1." + owner;
function stamp(value: string) {
  const time = new Date(value);
  return Number.isNaN(time.getTime())
    ? "Belum tersedia"
    : time.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}
function safeSource(value: unknown): string | null {
  try {
    if (typeof value !== "string") return null;
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function safeResult(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.violetblackbird16\.chatgpt\.site(?:\/[^?#]*)?$/i.test(
      value,
    )
  )
    return null;
  return safeSource(value);
}
export function sessionRecord(value: unknown): MachineSession {
  const s = value as MachineSession;
  if (
    !s ||
    typeof s.id !== "string" ||
    typeof s.brand !== "string" ||
    typeof s.model !== "string" ||
    typeof s.updated_at !== "string" ||
    !Object.hasOwn(statusLabels, s.status)
  )
    throw Error("Data sesi belum dapat dibaca. Muat ulang halaman ini.");
  const leads = s.source_leads;
  return {
    ...s,
    source_leads:
      leads &&
      Array.isArray(leads.items) &&
      leads.items.every(
        (item) =>
          item &&
          typeof item.title === "string" &&
          typeof item.url === "string",
      )
        ? leads
        : null,
  };
}
function memoryRecord(value: unknown): Memory {
  const m = value as Memory;
  if (
    !m ||
    !roleKeys.has(m.role) ||
    !Object.hasOwn(evidenceLabels, m.status) ||
    typeof m.session_id !== "string" ||
    typeof m.summary !== "string" ||
    !Number.isInteger(m.revision) ||
    m.revision < 1 ||
    !Array.isArray(m.sources) ||
    !Array.isArray(m.decisions) ||
    !Array.isArray(m.open_questions) ||
    m.open_questions.some((value) => typeof value !== "string") ||
    m.sources.some(
      (source) =>
        !source ||
        typeof source.id !== "string" ||
        typeof source.title !== "string" ||
        typeof source.locator !== "string" ||
        typeof source.evidence_status !== "string" ||
        (source.url !== null && typeof source.url !== "string"),
    ) ||
    m.decisions.some(
      (decision) =>
        !decision ||
        typeof decision.text !== "string" ||
        typeof decision.evidence_status !== "string" ||
        !Array.isArray(decision.source_ids) ||
        decision.source_ids.some((id) => typeof id !== "string"),
    )
  )
    throw Error("Catatan agen belum dapat dibaca. Muat ulang sesi.");
  return m;
}
export function detailRecord(value: unknown): Detail {
  const d = value as Detail;
  if (
    !d ||
    typeof d.account_id !== "string" ||
    !Array.isArray(d.memory) ||
    !Array.isArray(d.previous_sessions) ||
    !Array.isArray(d.canonical_memory)
  )
    throw Error("Detail sesi belum tersedia.");
  return {
    account_id: d.account_id,
    session: sessionRecord(d.session),
    memory: d.memory.map(memoryRecord),
    previous_sessions: d.previous_sessions.map(sessionRecord),
    canonical_memory: d.canonical_memory.map(memoryRecord),
    previous_memory: Array.isArray(d.previous_memory)
      ? d.previous_memory.map(memoryRecord)
      : [],
  };
}
function clearPending(owner: string) {
  try {
    sessionStorage.removeItem(pendingKey(owner));
  } catch {}
}
function readPending(owner: string): Pending | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(pendingKey(owner)) || "null");
    return p &&
      typeof p.brand === "string" &&
      typeof p.model === "string" &&
      /^[0-9a-f-]{36}$/i.test(p.request_id)
      ? p
      : null;
  } catch {
    return null;
  }
}

function MemoryContent({ memory }: { memory: Memory }) {
  return (
    <div className="machine-memory-content">
      <div className="machine-memory-meta">
        <span className={`memory-badge ${memory.status.toLowerCase()}`}>
          {evidenceLabels[memory.status]}
        </span>
        <span>
          Catatan #{memory.revision} · {stamp(memory.written_at)}
        </span>
      </div>
      <p>{memory.summary}</p>
      <h4>Sumber</h4>
      {memory.sources.length ? (
        <ul className="machine-sources">
          {memory.sources.map((source, i) => {
            const url = safeSource(source.url);
            return (
              <li key={source.id + ":" + i}>
                <strong>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer">
                      {source.title || source.id}
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    source.title || source.id
                  )}
                </strong>
                <small>
                  {source.locator || "Lokasi sumber belum dicatat"} ·{" "}
                  {source.evidence_status}
                </small>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="machine-muted">Belum ada sumber tercatat.</p>
      )}
      <h4>Keputusan</h4>
      {memory.decisions.length ? (
        <ul>
          {memory.decisions.map((decision, i) => (
            <li key={i}>
              {decision.text}
              <small>
                {decision.evidence_status}
                {decision.source_ids?.length
                  ? " · " + decision.source_ids.join(", ")
                  : ""}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="machine-muted">Belum ada keputusan tercatat.</p>
      )}
      <h4>Yang masih terbuka</h4>
      {memory.open_questions.length ? (
        <ul className="machine-open-questions">
          {memory.open_questions.map((question, i) => (
            <li key={i}>{question}</li>
          ))}
        </ul>
      ) : (
        <p className="machine-muted">
          Tidak ada pertanyaan terbuka yang dicatat pada checkpoint ini.
        </p>
      )}
    </div>
  );
}

export default function MachineStudio({
  prefill,
  onPrefillUsed,
  signed,
  authReady,
  onLogin,
  onAuthExpired,
  onLocal,
}: {
  prefill?: { brand: string; model: string; key: number } | null;
  onPrefillUsed?: () => void;
  signed: boolean;
  authReady: boolean;
  onLogin: () => void;
  onAuthExpired: () => void;
  onLocal: () => void;
}) {
  const [brand, setBrand] = useState(""),
    [model, setModel] = useState("");
  const [productId, setProductId] = useState("");
  const [brief, setBrief] = useState(workspaceBrief);
  const product = revisionProducts.find(item => item.id === productId);
  useEffect(() => {
    if (!prefill) return;
    setProductId("");
    setBrand(prefill.brand);
    setModel(prefill.model);
    setNotice("Merk dan tipe dari bagan Produksi mesin 3D sudah diisi. Periksa sekali lagi, lalu kirim ke antrean.");
    onPrefillUsed?.();
  }, [prefill?.key]);
  const currentBrand = product?.brand ?? brand;
  const currentModel = product?.model ?? model;
  const [owner, setOwner] = useState<string | null>(null),
    [sessions, setSessions] = useState<MachineSession[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false),
    [detailLoading, setDetailLoading] = useState(false),
    [submitting, setSubmitting] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [detailError, setDetailError] = useState(""),
    [submitError, setSubmitError] = useState(""),
    [notice, setNotice] = useState(""),
    [checkedAt, setCheckedAt] = useState<number | null>(null),
    [now, setNow] = useState(Date.now());
  const alive = useRef(true),
    signedRef = useRef(signed),
    ownerRef = useRef<string | null>(null),
    selectedRef = useRef<string | null>(null),
    authExpired = useRef(onAuthExpired),
    epoch = useRef(0),
    pending = useRef<Pending | null>(null),
    submitLock = useRef(false),
    listLock = useRef(false),
    detailLock = useRef(false),
    controllers = useRef(new Set<AbortController>()),
    detailsController = useRef<AbortController | null>(null),
    listController = useRef<AbortController | null>(null),
    brandInput = useRef<HTMLInputElement | null>(null);
  signedRef.current = signed;
  authExpired.current = onAuthExpired;
  selectedRef.current = selected;
  const current =
    detail?.account_id === owner && detail.session.id === selected
      ? detail.session
      : sessions.find((session) => session.id === selected);
  const visibleDetail =
    detail?.account_id === owner && detail.session.id === current?.id
      ? detail
      : null;
  const activeSame = sessions.find(
    (session) =>
      ["queued", "running"].includes(session.status) &&
      session.brand.trim().toLocaleLowerCase() ===
        currentBrand.trim().toLocaleLowerCase() &&
      session.model.trim().toLocaleLowerCase() ===
        currentModel.trim().toLocaleLowerCase(),
  );
  const resultUrl = safeResult(current?.result_url);
  const validForm =
    (!product || !!brief.trim()) &&
    !!currentBrand.trim() &&
    !!currentModel.trim() &&
    currentBrand.trim().length <= 80 &&
    currentModel.trim().length <= 120;
  const stale =
    current?.status === "running" &&
    now - new Date(current.updated_at).getTime() > 180000;

  const resetPrivateState = useCallback(() => {
    epoch.current++;
    controllers.current.forEach((controller) => controller.abort());
    controllers.current.clear();
    detailsController.current = null;
    listController.current = null;
    listLock.current = false;
    detailLock.current = false;
    ownerRef.current = null;
    selectedRef.current = null;
    pending.current = null;
    setProductId("");
    setBrief(workspaceBrief);
    setOwner(null);
    setSessions([]);
    setSelected(null);
    setDetail(null);
    setLoaded(false);
    setCheckedAt(null);
    setDetailError("");
    setLoading(false);
    setDetailLoading(false);
  }, []);
  const adoptOwner = useCallback((account: string) => {
    if (ownerRef.current && ownerRef.current !== account) {
      epoch.current++;
      detailsController.current?.abort();
      setSessions([]);
      setSelected(null);
      selectedRef.current = null;
      setDetail(null);
      setProductId("");
      setBrief(workspaceBrief);
      setBrand("");
      setModel("");
      setSubmitError("");
      setNotice("");
      setDetailError("");
      pending.current = null;
    }
    if (ownerRef.current !== account) {
      ownerRef.current = account;
      setOwner(account);
      pending.current = readPending(account);
      if (pending.current) {
        const saved = pending.current;
        setProductId(saved.source_product || "");
        setBrief(saved.revision_brief || workspaceBrief);
        setBrand((value) => value || saved.brand);
        setModel((value) => value || saved.model);
        setNotice(
          "Permintaan sebelumnya belum terkonfirmasi. Kirim kembali untuk memeriksa permintaan yang sama.",
        );
      }
    }
  }, []);
  const handleAuth = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        resetPrivateState();
        setBrand("");
        setModel("");
        setNotice("");
        authExpired.current();
        return "Sesi berakhir. Masuk kembali untuk melanjutkan.";
      }
      return (e as Error).message || "Permintaan belum berhasil. Coba lagi.";
    },
    [resetPrivateState],
  );

  const loadSessions = useCallback(async () => {
    if (!signedRef.current || listLock.current) return;
    const generation = epoch.current;
    listLock.current = true;
    const controller = new AbortController();
    listController.current = controller;
    controllers.current.add(controller);
    setLoading(true);
    try {
      const response = await api(
        "machines",
        undefined,
        true,
        controller.signal,
      );
      if (
        typeof response.account_id !== "string" ||
        !Array.isArray(response.sessions)
      )
        throw Error("Daftar sesi belum dapat dibaca.");
      const rows = response.sessions.map(sessionRecord) as MachineSession[];
      if (
        !alive.current ||
        controller.signal.aborted ||
        generation !== epoch.current ||
        !signedRef.current
      )
        return;
      adoptOwner(response.account_id);
      setSessions(rows);
      setLoaded(true);
      setError("");
      setCheckedAt(Date.now());
      const recovered =
        pending.current &&
        rows.find(
          (session) => session.request_id === pending.current?.request_id,
        );
      if (recovered) {
        clearPending(response.account_id);
        pending.current = null;
        setSelected(recovered.id);
        selectedRef.current = recovered.id;
        setNotice("Permintaan sebelumnya sudah tercatat.");
      } else if (!selectedRef.current) {
        setSelected(rows[0]?.id || null);
        selectedRef.current = rows[0]?.id || null;
      }
    } catch (e) {
      if (
        alive.current &&
        !controller.signal.aborted &&
        generation === epoch.current
      )
        setError(handleAuth(e));
    } finally {
      controllers.current.delete(controller);
      if (listController.current === controller) {
        listController.current = null;
        listLock.current = false;
        if (alive.current) setLoading(false);
      }
    }
  }, [adoptOwner, handleAuth]);

  const loadDetail = useCallback(
    async (id: string) => {
      if (!signedRef.current || !ownerRef.current || detailLock.current) return;
      const account = ownerRef.current,
        generation = epoch.current;
      const controller = new AbortController();
      controllers.current.add(controller);
      detailsController.current = controller;
      detailLock.current = true;
      setDetailLoading(true);
      try {
        const response = detailRecord(
          await api(
            "machines?id=" + encodeURIComponent(id),
            undefined,
            true,
            controller.signal,
          ),
        );
        if (
          !alive.current ||
          controller.signal.aborted ||
          generation !== epoch.current ||
          selectedRef.current !== id ||
          !signedRef.current
        )
          return;
        if (response.account_id !== account) {
          adoptOwner(response.account_id);
          void loadSessions();
          return;
        }
        if (
          response.session.id !== id ||
          response.memory.some((item) => item.session_id !== id)
        )
          throw Error("Catatan tidak sesuai sesi yang dipilih.");
        setDetail(response);
        setDetailError("");
        setCheckedAt(Date.now());
      } catch (e) {
        if (
          alive.current &&
          !controller.signal.aborted &&
          generation === epoch.current &&
          selectedRef.current === id
        )
          setDetailError(handleAuth(e));
      } finally {
        controllers.current.delete(controller);
        if (detailsController.current === controller) {
          detailsController.current = null;
          detailLock.current = false;
          if (alive.current) setDetailLoading(false);
        }
      }
    },
    [adoptOwner, handleAuth, loadSessions],
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      epoch.current++;
      controllers.current.forEach((controller) => controller.abort());
    };
  }, []);
  useEffect(() => {
    if (!signed) {
      const hadOwner = !!ownerRef.current;
      resetPrivateState();
      if (hadOwner) {
        setBrand("");
        setModel("");
        setNotice("");
        setSubmitError("");
      }
      return;
    }
    void loadSessions();
  }, [signed, loadSessions, resetPrivateState]);
  useEffect(() => {
    detailsController.current?.abort();
    detailsController.current = null;
    detailLock.current = false;
    setDetail(null);
    setDetailError("");
    if (selected && owner) void loadDetail(selected);
  }, [selected, owner, loadDetail]);
  useEffect(() => {
    if (!signed) return;
    const poll = () => {
      setNow(Date.now());
      if (!document.hidden) {
        void loadSessions();
        if (selectedRef.current) void loadDetail(selectedRef.current);
      }
    };
    const timer = setInterval(poll, 5000);
    const visible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [signed, loadSessions, loadDetail]);

  async function create() {
    if (!validForm || submitLock.current) return;
    if (!signed) {
      onLogin();
      return;
    }
    if (!ownerRef.current) {
      void loadSessions();
      return;
    }
    if (activeSame) {
      setSelected(activeSame.id);
      setNotice(product ? "Mesin ini masih memiliki sesi aktif. Tugas revisi baru belum dikirim." : "Mesin ini sudah ada dalam antrean.");
      return;
    }
    const account = ownerRef.current,
      generation = epoch.current;
    const input = { brand: currentBrand.trim(), model: currentModel.trim(), source_product: product?.id, revision_brief: product ? brief.trim() : undefined };
    if (
      !pending.current ||
      pending.current.brand !== input.brand ||
      pending.current.model !== input.model ||
      pending.current.source_product !== input.source_product ||
      pending.current.revision_brief !== input.revision_brief
    )
      pending.current = { ...input, request_id: crypto.randomUUID() };
    const payload = { ...pending.current };
    try {
      sessionStorage.setItem(pendingKey(account), JSON.stringify(payload));
    } catch {}
    const controller = new AbortController();
    controllers.current.add(controller);
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError("");
    setNotice("");
    try {
      const request = product ? {source_product: payload.source_product, revision_brief: payload.revision_brief, request_id: payload.request_id} : payload;
      const response = await api("machines", request, true, controller.signal);
      const session = sessionRecord(response.session);
      if (
        !alive.current ||
        controller.signal.aborted ||
        epoch.current !== generation ||
        ownerRef.current !== account ||
        !signedRef.current
      )
        return;
      // Confirm the authenticated principal via the list endpoint before displaying a POST receipt.
      const confirmed = await api(
        "machines",
        undefined,
        true,
        controller.signal,
      );
      if (
        !alive.current ||
        controller.signal.aborted ||
        epoch.current !== generation ||
        !signedRef.current
      )
        return;
      if (
        typeof confirmed.account_id !== "string" ||
        !Array.isArray(confirmed.sessions)
      )
        throw Error(
          "Permintaan diterima; konfirmasi sesi belum tersedia. Muat ulang daftar.",
        );
      if (confirmed.account_id !== account) {
        adoptOwner(confirmed.account_id);
        void loadSessions();
        return;
      }
      const rows = confirmed.sessions.map(sessionRecord) as MachineSession[];
      if (
        !rows.some(
          (row) =>
            row.id === session.id && row.request_id === payload.request_id,
        )
      ) {
        // A retried request can refer to a session outside the latest history page.
        const receipt = detailRecord(
          await api(
            "machines?id=" + encodeURIComponent(session.id),
            undefined,
            true,
            controller.signal,
          ),
        );
        if (
          !alive.current ||
          controller.signal.aborted ||
          generation !== epoch.current ||
          !signedRef.current
        )
          return;
        if (receipt.account_id !== account) {
          adoptOwner(receipt.account_id);
          void loadSessions();
          return;
        }
        if (
          receipt.session.id !== session.id ||
          receipt.session.request_id !== payload.request_id
        )
          throw Error("Konfirmasi permintaan belum sesuai. Muat ulang sesi.");
        rows.unshift(receipt.session);
      }
      setSessions(rows);
      setLoaded(true);
      setSelected(session.id);
      selectedRef.current = session.id;
      setError("");
      setNotice(
        session.status === "queued"
          ? "Mesin masuk antrean otomatis."
          : "Permintaan sudah tercatat. Sesi yang sama dibuka kembali.",
      );
      setCheckedAt(Date.now());
      clearPending(account);
      pending.current = null;
    } catch (e) {
      if (
        alive.current &&
        !controller.signal.aborted &&
        generation === epoch.current
      )
        setSubmitError(
          e instanceof ApiError && e.status === 403
            ? "Pembuatan mesin hanya tersedia untuk akun pemilik yang diberi akses."
            : e instanceof ApiError && e.status === 409
              ? "Mesin ini sudah memiliki sesi aktif. Muat ulang daftar untuk melanjutkan sesi tersebut."
              : handleAuth(e),
        );
    } finally {
      controllers.current.delete(controller);
      submitLock.current = false;
      if (alive.current) {
        setSubmitting(false);
        void loadSessions();
      }
    }
  }
  function prepareRevision(session: MachineSession) {
    setProductId(session.source_product ?? "");
    setBrief(session.revision_brief ?? workspaceBrief);
    setBrand(session.brand);
    setModel(session.model);
    setSubmitError("");
    setNotice(
      session.source_product ? "Periksa tugas revisi lalu kirim." : "Identitas mesin disalin. Tekan Buat mesin untuk membuat sesi berikutnya dengan memori yang tersedia.",
    );
    brandInput.current?.focus();
    brandInput.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section
      className="agent-studio machine-studio"
      aria-labelledby="machine-title"
    >
      <div className="machine-top">
        <div>
          <p className="agent-eyebrow">ORANG MESIN · PRODUKSI OTOMATIS</p>
          <h1 id="machine-title">Produksi dan revisi mesin</h1>
          <p>
            Pilih mesin katalog untuk revisi, atau masukkan merek dan model untuk membuat mesin.
          </p>
        </div>
        <button className="machine-local-link" type="button" onClick={onLocal}>
          Proyek lokal <ArrowRight size={14} />
        </button>
      </div>
      <form
        className="machine-create"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <div className="machine-revision-field">
          <label htmlFor="revision-source">Jenis sesi dan model asal</label>
          <select id="revision-source" value={productId} disabled={submitting} onChange={event => {setProductId(event.target.value); setNotice(""); setSubmitError("");}}>
            <option value="">Buat mesin baru</option>
            <optgroup label="Revisi mesin katalog">
              {revisionProducts.map(item => <option key={item.id} value={item.id}>Revisi mesin · {item.brand} {item.model}</option>)}
            </optgroup>
          </select>
        </div>
        {product ? <div className="machine-revision-field">
          <label htmlFor="revision-brief">Tugas revisi untuk agen</label>
          <textarea id="revision-brief" rows={3} maxLength={1200} required disabled={submitting}
            value={brief} onChange={event => setBrief(event.target.value)} />
        </div> : <><div>
          <label htmlFor="machine-brand">Merek</label>
          <input
            ref={brandInput}
            id="machine-brand"
            name="brand"
            required
            maxLength={80}
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            placeholder="Contoh: Yanmar"
            disabled={submitting}
          />
        </div>
        <div>
          <label htmlFor="machine-model">Nama / model mesin</label>
          <input
            id="machine-model"
            name="model"
            required
            maxLength={120}
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="Contoh: 6AYM-WET"
            disabled={submitting}
          />
        </div>
        </>}
        <button
          className="primary"
          type="submit"
          disabled={
            !authReady || submitting || !validForm || (signed && !owner)
          }
        >
          {submitting ? (
            <LoaderCircle size={18} className="agent-spin" />
          ) : (
            <Plus size={18} />
          )}{" "}
          {submitting ? "Mengirim…" : product ? "Kirim revisi" : "Buat mesin"}
        </button>
        <div className="machine-form-feedback">
          {!authReady ? (
            <p role="status">Memeriksa sesi…</p>
          ) : !signed ? (
            <p>
              Masuk untuk menyimpan sesi dan memori mesin.{" "}
              <button type="button" onClick={onLogin}>
                <LogIn size={14} />
                Masuk
              </button>
            </p>
          ) : !owner ? (
            <p role="status">
              {error
                ? "Akun belum terhubung. Muat ulang daftar sesi."
                : "Menghubungkan akun…"}
            </p>
          ) : (
            <p>Hasil dan catatan akan muncul di sini selama proses berjalan.</p>
          )}
          {submitError && (
            <p className="machine-error" role="alert">
              {submitError}
            </p>
          )}
          {notice && (
            <p className="machine-notice" role="status">
              {notice}
            </p>
          )}
        </div>
      </form>
      <div className="machine-layout">
        <aside
          className="machine-history agent-card"
          aria-labelledby="machine-history-title"
        >
          <div className="agent-section-heading">
            <h2 id="machine-history-title">Sesi mesin</h2>
            <button
              type="button"
              aria-label="Muat ulang sesi mesin"
              onClick={() => {
                void loadSessions();
                if (selected) void loadDetail(selected);
              }}
              disabled={!signed || loading}
            >
              <RefreshCw size={16} className={loading ? "agent-spin" : ""} />
            </button>
          </div>
          {error && (
            <p className="machine-error" role="alert">
              {error}
            </p>
          )}
          {!signed ? (
            <p>Masuk untuk melihat sesi Anda.</p>
          ) : loading && !loaded ? (
            <p role="status">Memuat sesi…</p>
          ) : loaded && !sessions.length ? (
            <div className="machine-empty">
              <Layers3 size={25} />
              <h3>Belum ada sesi</h3>
              <p>Isi merek dan model untuk memulai.</p>
            </div>
          ) : null}
          <ul>
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  aria-current={selected === session.id ? "true" : undefined}
                  onClick={() => setSelected(session.id)}
                >
                  <span>
                    <strong>{session.brand}</strong>
                    <span>{session.model}</span>
                    <small>{session.source_product && "Revisi · "}{stamp(session.created_at)}</small>
                  </span>
                  <span
                    className={`machine-status-dot ${session.status}`}
                    title={statusLabels[session.status]}
                  />
                  <span className="sr-only">
                    {statusLabels[session.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="machine-work">
          {!current && detailError && (
            <p className="machine-error" role="alert">
              {detailError}
            </p>
          )}
          {!current ? (
            <section className="agent-card machine-welcome">
              <BookOpen size={30} />
              <h2>Satu mesin, riwayat yang berlanjut</h2>
              <p>
                Sumber, keputusan, dan pertanyaan terbuka tersimpan per agen.
                Sesi berikutnya untuk mesin yang sama dapat menggunakan kembali
                catatan terdokumentasi.
              </p>
              <div className="machine-steps">
                <span>Identifikasi sumber</span>
                <ArrowRight size={14} />
                <span>Produksi & audit</span>
                <ArrowRight size={14} />
                <span>Review Anda</span>
              </div>
            </section>
          ) : (
            <>
              <section className="agent-card machine-session">
                <div className="machine-session-heading">
                  <div>
                    <p className="agent-eyebrow">{current.source_product ? "SESI REVISI" : "SESI PRODUKSI"}</p>
                    <h2>
                      {current.brand} <span>{current.model}</span>
                    </h2>
                  </div>
                  <span
                    className={`agent-pill ${current.status}`}
                    role="status"
                  >
                    {statusLabels[current.status]}
                  </span>
                </div>
                {current.source_product && <div>
                  <a href={"/workspace?product=" + encodeURIComponent(current.source_product)}>Buka model asal</a>
                  <h3>Tugas revisi</h3>
                  <p className="machine-brief">{current.revision_brief}</p>
                </div>}
                <p>{statusText[current.status]}</p>
                <dl className="agent-metadata">
                  <div>
                    <dt>Pembaruan terakhir</dt>
                    <dd>{stamp(current.updated_at)}</dd>
                  </div>
                  <div>
                    <dt>Terakhir diperiksa</dt>
                    <dd>
                      {checkedAt
                        ? stamp(new Date(checkedAt).toISOString())
                        : "Belum tersedia"}
                    </dd>
                  </div>
                </dl>
                {stale && (
                  <p className="machine-warning" role="status">
                    <AlertCircle size={16} />
                    Pembaruan belum diterima beberapa menit terakhir. Status
                    tetap menunggu konfirmasi layanan.
                  </p>
                )}
                <div className="machine-session-actions">
                  {resultUrl && (
                    <a
                      className="primary"
                      href={resultUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Buka hasil <ExternalLink size={15} />
                    </a>
                  )}
                  {!["queued", "running"].includes(current.status) && (
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => prepareRevision(current)}
                    >
                      Buat sesi berikutnya <ArrowRight size={15} />
                    </button>
                  )}
                </div>
                {current.status === "review" && !resultUrl && (
                  <p className="machine-muted">
                    Tautan hasil belum tersedia. Catatan sesi dapat diperiksa di
                    bawah.
                  </p>
                )}
                {current.source_leads?.items?.length ? (
                  <details className="machine-source-leads">
                    <summary>Kandidat sumber awal · belum diverifikasi</summary>
                    <ul>
                      {current.source_leads.items.map((source, index) => {
                        const href = safeSource(source.url);
                        return (
                          <li key={index}>
                            {href ? (
                              <a href={href} target="_blank" rel="noreferrer">
                                {source.title}
                                <ExternalLink size={12} />
                              </a>
                            ) : (
                              source.title
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ) : null}
              </section>
              <section
                className="agent-card machine-memory"
                aria-labelledby="machine-memory-title"
              >
                <div className="agent-section-heading">
                  <h2 id="machine-memory-title">Memori tiap agen</h2>
                  <span className="machine-muted">Checkpoint terakhir</span>
                </div>
                {detailError && (
                  <p className="machine-error" role="alert">
                    {detailError}
                  </p>
                )}
                {detailLoading && !visibleDetail && (
                  <p role="status">Memuat catatan sesi…</p>
                )}
                <div className="machine-role-list">
                  {roleList.map((role) => {
                    const memory = visibleDetail?.memory
                      .filter((item) => item.role === role.key)
                      .sort((a, b) => b.revision - a.revision)[0];
                    const prior = visibleDetail?.canonical_memory.find(
                      (item) =>
                        item.role === role.key &&
                        ["DOCUMENTED", "NOT_APPLICABLE"].includes(item.status),
                    );
                    const previous = visibleDetail?.previous_memory.find(
                      (item) =>
                        item.role === role.key &&
                        (!prior ||
                          item.session_id !== prior.session_id ||
                          item.revision !== prior.revision),
                    );
                    return (
                      <details className="machine-role" key={role.key}>
                        <summary>
                          <span className="machine-role-icon">
                            {memory ? (
                              <BookOpen size={17} />
                            ) : (
                              <Clock3 size={17} />
                            )}
                          </span>
                          <span>
                            <strong>{role.name}</strong>
                            <small>
                              {memory
                                ? evidenceLabels[memory.status] +
                                  " · catatan #" +
                                  memory.revision
                                : "Belum ada catatan sesi ini"}
                              {prior ? " · memori sebelumnya tersedia" : ""}
                            </small>
                          </span>
                          <ChevronDown size={15} />
                        </summary>
                        <p className="machine-role-purpose">{role.detail}</p>
                        {memory ? (
                          <MemoryContent memory={memory} />
                        ) : (
                          <p className="machine-muted">
                            Belum ada checkpoint yang diterima untuk agen ini.
                          </p>
                        )}
                        {previous && (
                          <div className="machine-prior">
                            <h4>Checkpoint sesi sebelumnya</h4>
                            <p className="machine-muted">
                              Temuan terbuka tetap disimpan bersama status
                              buktinya.
                            </p>
                            <MemoryContent memory={previous} />
                          </div>
                        )}
                        {prior && (
                          <div className="machine-prior">
                            <h4>Catatan terdokumentasi dari sesi sebelumnya</h4>
                            <p className="machine-muted">
                              Disimpan terpisah dari temuan sesi ini.
                            </p>
                            <MemoryContent memory={prior} />
                          </div>
                        )}
                      </details>
                    );
                  })}
                </div>
              </section>
              {!!visibleDetail?.previous_sessions.length && (
                <section className="agent-card machine-related">
                  <h2>Sesi sebelumnya · mesin yang sama</h2>
                  <ul>
                    {visibleDetail.previous_sessions.map((session) => (
                      <li key={session.id}>
                        <button
                          onClick={() => setSelected(session.id)}
                          type="button"
                        >
                          <span>
                            {session.brand} {session.model}
                            <small>
                              {stamp(session.created_at)} ·{" "}
                              {statusLabels[session.status]}
                            </small>
                          </span>
                          <ArrowRight size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
