import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Hammer,
  LogIn,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { api, ApiError } from "./api";
import {
  detailRecord,
  sessionRecord,
  statusLabels,
  type MachineSession,
} from "./MachineStudio";
import { roleProgress, splitMachine, type Progress } from "./production-status";
import StageProgress from "./StageProgress";
import WorkerQuota from "./WorkerQuota";
import ActivityFeed from "./ActivityFeed";
import "./home.css";

type Worker = "claude" | "codex";
type Workers = {
  settings: { primary_worker: Worker; claude_enabled: boolean; codex_enabled: boolean; takeover_minutes: number };
  workers: Record<Worker, string | null>;
  primary_alive: boolean;
};

const TARGET = 50;
const short: Record<Worker, string> = { claude: "Claude", codex: "Codex" };

function ago(value: string | null | undefined, now: number) {
  if (!value) return "belum pernah";
  const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} jam lalu` : `${Math.round(hours / 24)} hari lalu`;
}

export default function HomeStudio({
  signed,
  authReady,
  onLogin,
  onAuthExpired,
  onOpenSession,
  onOpen,
}: {
  signed: boolean;
  authReady: boolean;
  onLogin: () => void;
  onAuthExpired: () => void;
  onOpenSession: (id: string) => void;
  onOpen: (mode: "agen" | "editor" | "atur") => void;
}) {
  const [sessions, setSessions] = useState<MachineSession[] | null>(null),
    [workers, setWorkers] = useState<Workers | null>(null),
    [focus, setFocus] = useState<{ session: MachineSession; progress: Progress } | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now()),
    [text, setText] = useState(""),
    [edit, setEdit] = useState(false),
    [brand, setBrand] = useState(""),
    [model, setModel] = useState(""),
    [sending, setSending] = useState(false),
    [sendError, setSendError] = useState(""),
    [sent, setSent] = useState<MachineSession | null>(null);
  const request = useRef<{ key: string; id: string } | null>(null),
    alive = useRef(true);

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        onAuthExpired();
        return "Sesi berakhir. Masuk kembali.";
      }
      return (e as Error).message || "Data produksi belum dapat dimuat.";
    },
    [onAuthExpired],
  );
  const load = useCallback(async () => {
    if (!signed) return;
    setLoading(true);
    try {
      const list = await api("machines");
      const rows = (Array.isArray(list.sessions) ? list.sessions : []).map(sessionRecord) as MachineSession[];
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      const settings = await api("machines-settings").catch(() => null);
      // Mesin yang paling layak dipantau: yang sedang dikerjakan, lalu yang menunggu, lalu yang terbaru.
      const target =
        rows.find((s) => s.status === "running") ?? rows.find((s) => s.status === "queued") ?? rows[0];
      let next: { session: MachineSession; progress: Progress } | null = null;
      if (target) {
        const detail = detailRecord(await api("machines?id=" + encodeURIComponent(target.id)));
        next = { session: detail.session, progress: roleProgress(detail.session, detail.memory) };
      }
      if (!alive.current) return;
      setSessions(rows);
      setWorkers(settings as Workers | null);
      setFocus(next);
      setError("");
      setNow(Date.now());
    } catch (e) {
      if (alive.current) setError(fail(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [signed, fail]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!signed) {
      setSessions(null);
      setWorkers(null);
      setFocus(null);
      return;
    }
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [signed, load]);

  function type(value: string) {
    setText(value);
    setSendError("");
    setSent(null);
    const split = splitMachine(value);
    setBrand(split.brand);
    setModel(split.model);
  }
  const valid =
    !!brand.trim() && !!model.trim() && brand.trim().length <= 80 && model.trim().length <= 120;
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || sending) return;
    const key = brand.trim().toLowerCase() + "\u0000" + model.trim().toLowerCase();
    // Kirim ulang identitas yang sama memakai request_id yang sama, jadi tidak ada sesi ganda.
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    setSending(true);
    setSendError("");
    try {
      const response = await api("machines", { brand: brand.trim(), model: model.trim(), request_id: request.current.id });
      const created = sessionRecord(response.session);
      request.current = null;
      setSent(created);
      setText("");
      setBrand("");
      setModel("");
      setEdit(false);
      void load();
    } catch (e) {
      setSendError(
        e instanceof ApiError && e.status === 409
          ? "Mesin ini sudah ada di antrean atau sedang dikerjakan."
          : e instanceof ApiError && e.status === 403
            ? "Hanya akun pemilik yang dapat menambah mesin."
            : fail(e),
      );
    } finally {
      setSending(false);
    }
  }

  const rows = sessions ?? [];
  const count = (status: MachineSession["status"]) => rows.filter((s) => s.status === status).length;
  const ready = new Set(rows.filter((s) => s.status === "review").map((s) => s.machine_key)).size;
  const attention = count("needs_evidence") + count("failed");
  const primary = workers?.settings.primary_worker ?? "claude";
  const nextClaude = (() => {
    const at = new Date(now);
    at.setMinutes(40, 0, 0);
    if (at.getTime() <= now) at.setHours(at.getHours() + 1);
    return at.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  })();

  return (
    <section className="agent-studio home-studio" aria-labelledby="home-title">
      <div className="home-top">
        <div>
          <p className="agent-eyebrow">ORANG MESIN</p>
          <h1 id="home-title">Beranda produksi</h1>
        </div>
        {signed && (
          <button type="button" className="home-refresh" aria-label="Muat ulang" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={18} className={loading ? "agent-spin" : ""} />
          </button>
        )}
      </div>

      {!signed ? (
        <section className="agent-card home-login">
          <Sparkles size={26} />
          <h2>Pabrik desain 3D mesin kapal</h2>
          <p>Tulis merk dan tipe mesin, lalu agent Claude dan Codex mengerjakan model 3D-nya dengan sumber yang terverifikasi.</p>
          <button type="button" className="primary" onClick={onLogin} disabled={!authReady}>
            <LogIn size={16} /> Masuk sebagai pemilik
          </button>
          <button type="button" className="secondary" onClick={() => onOpen("editor")}>
            Lihat bagan organisasi
          </button>
        </section>
      ) : (
        <>
          {error && (
            <p className="machine-error" role="alert">
              {error}
            </p>
          )}

          <form className="agent-card home-new" onSubmit={send}>
            <label htmlFor="home-machine">
              <Plus size={18} /> Mesin baru
            </label>
            <div className="home-new-row">
              <input
                id="home-machine"
                value={text}
                onChange={(e) => type(e.target.value)}
                placeholder="Merk dan tipe, misal Caterpillar 3512C"
                maxLength={200}
                autoComplete="off"
              />
              <button className="primary" disabled={!valid || sending}>
                {sending ? "Mengirim…" : "Produksi"}
              </button>
            </div>
            {text.trim() && !edit && (
              <p className="home-split">
                Merk <b>{brand || "—"}</b> · Tipe <b>{model || "—"}</b>{" "}
                <button type="button" onClick={() => setEdit(true)}>
                  Ubah
                </button>
              </p>
            )}
            {edit && (
              <div className="pair home-pair">
                <label>
                  Merk
                  <input value={brand} maxLength={80} onChange={(e) => setBrand(e.target.value)} />
                </label>
                <label>
                  Tipe
                  <input value={model} maxLength={120} onChange={(e) => setModel(e.target.value)} />
                </label>
              </div>
            )}
            {sendError && (
              <p className="machine-error" role="alert">
                {sendError}
              </p>
            )}
            {sent && (
              <p className="machine-notice" role="status">
                {sent.brand} {sent.model} masuk antrean.{" "}
                {primary === "claude" ? `Claude mengambilnya sekitar pukul ${nextClaude}.` : "Codex mengambilnya pada putaran berikutnya."}
              </p>
            )}
          </form>

          <div className="home-stats">
            <section className="agent-card home-target">
              <div>
                <Target size={18} />
                <span>Target katalog</span>
              </div>
              <strong>
                {ready}
                <small> / {TARGET} desain</small>
              </strong>
              <div className="home-meter" aria-hidden="true">
                <i style={{ width: Math.min(100, (ready / TARGET) * 100) + "%" }} />
              </div>
              <small>Mesin dengan hasil siap direview</small>
            </section>
            <dl className="home-counts">
              <div className="queued">
                <dt>
                  <Clock3 size={15} /> Menunggu
                </dt>
                <dd>{count("queued")}</dd>
              </div>
              <div className="running">
                <dt>
                  <Hammer size={15} /> Dikerjakan
                </dt>
                <dd>{count("running")}</dd>
              </div>
              <div className="review">
                <dt>
                  <CheckCircle2 size={15} /> Siap review
                </dt>
                <dd>{count("review")}</dd>
              </div>
              <div className="attention">
                <dt>
                  <AlertCircle size={15} /> Perlu dicek
                </dt>
                <dd>{attention}</dd>
              </div>
            </dl>
          </div>

          {focus && (
            <button type="button" className="agent-card home-focus" onClick={() => onOpenSession(focus.session.id)}>
              <span className="home-focus-head">
                <span>
                  <small>{focus.session.status === "running" ? "Sedang dikerjakan" : focus.session.status === "queued" ? "Berikutnya" : "Terakhir"}</small>
                  <strong>
                    {focus.session.brand} {focus.session.model}
                  </strong>
                </span>
                <span className={`agent-pill ${focus.session.status}`}>
                  {focus.session.status === "running" && focus.session.worker
                    ? `${short[focus.session.worker]} bekerja`
                    : statusLabels[focus.session.status]}
                </span>
              </span>
              <StageProgress progress={focus.progress} compact />
              <span className="home-focus-foot">
                Diperbarui {ago(focus.session.updated_at, now)}
                <span>
                  Detail <ArrowRight size={14} />
                </span>
              </span>
            </button>
          )}

          {focus && focus.session.status !== "queued" && (
            <section className="agent-card home-activity">
              <ActivityFeed
                key={focus.session.id}
                sessionId={focus.session.id}
                running={focus.session.status === "running"}
                limit={5}
                title={focus.session.status === "running" ? "Aktivitas langsung" : "Aktivitas terakhir"}
              />
            </section>
          )}

          {workers && (
            <section className="agent-card home-workers" aria-labelledby="home-workers-title">
              <div className="agent-section-heading">
                <h2 id="home-workers-title">Pekerja & token</h2>
                <button type="button" className="secondary" onClick={() => onOpen("atur")}>
                  Atur
                </button>
              </div>
              <div className="worker-quota-list">
                {(["claude", "codex"] as Worker[])
                  .sort((a) => (a === primary ? -1 : 1))
                  .map((worker) => (
                    <WorkerQuota
                      key={worker}
                      worker={worker}
                      settings={workers.settings}
                      checkin={workers.workers[worker]}
                      sessions={rows}
                      now={now}
                    />
                  ))}
              </div>
              <p className="worker-quota-note">
                Sisa token persis hanya terlihat di halaman Usage Claude dan ChatGPT. Status di atas adalah perkiraan dari aktivitas terakhir.
              </p>
            </section>
          )}

          <section className="agent-card home-recent" aria-labelledby="home-recent-title">
            <div className="agent-section-heading">
              <h2 id="home-recent-title">Mesin terbaru</h2>
              <button type="button" className="secondary" onClick={() => onOpen("agen")}>
                Semua
              </button>
            </div>
            {sessions === null ? (
              <div className="home-skeleton" aria-label="Memuat">
                <i />
                <i />
                <i />
              </div>
            ) : rows.length === 0 ? (
              <p className="machine-muted">Belum ada mesin. Tulis merk dan tipe di atas untuk mulai.</p>
            ) : (
              <ul>
                {rows.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => onOpenSession(s.id)}>
                      <span className={`machine-status-dot ${s.status}`} aria-hidden="true" />
                      <span>
                        <strong>
                          {s.brand} {s.model}
                        </strong>
                        <small>
                          {statusLabels[s.status]}
                          {s.worker ? " · " + short[s.worker] : ""} · {ago(s.updated_at, now)}
                        </small>
                      </span>
                      {s.result_url ? <ExternalLink size={15} /> : <ArrowRight size={15} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}
