import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  Check,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  LoaderCircle,
  LogIn,
  RefreshCw,
  Workflow,
} from "lucide-react";
import { api, ApiError } from "../../api";
import { alurBase } from "../../paths";
import "./agent-studio.css";

export const stages = [
  {
    name: "Bukti & inventaris",
    hint: "Sumber, varian, dan identitas komponen",
    roles: [
      { key: "evidence", name: "Bukti", detail: "Menetapkan dasar produksi" },
    ],
  },
  {
    name: "Aliran sistem",
    hint: "Sesudah bukti · maksimal 2 spesialis bersamaan",
    roles: [
      { key: "fuel", name: "Bahan bakar", detail: "Suplai, injeksi & return" },
      { key: "freshwater", name: "Air tawar", detail: "Sirkuit pendinginan" },
      {
        key: "seawater",
        name: "Air laut",
        detail: "Pendingin & batas instalasi",
      },
      { key: "lubrication", name: "Pelumasan", detail: "Suplai oli & drain" },
      {
        key: "intake-exhaust",
        name: "Udara & gas",
        detail: "Intake, kompresi & exhaust",
      },
    ],
  },
  {
    name: "Model 3D",
    hint: "Sesudah lima aliran · dua peran paralel",
    roles: [
      { key: "exterior", name: "Eksterior", detail: "Bentuk luar & material" },
      {
        key: "internals",
        name: "Internal",
        detail: "Komponen & hierarki rakitan",
      },
    ],
  },
  {
    name: "Integrasi",
    hint: "Menunggu eksterior dan internal",
    roles: [
      {
        key: "integrator",
        name: "Integrator",
        detail: "Workspace interaktif untuk review",
      },
    ],
  },
  {
    name: "Pemeriksaan",
    hint: "Menunggu hasil integrasi",
    roles: [{ key: "qa", name: "QA", detail: "Audit hasil & batas bukti" }],
  },
] as const;
type ProgressStatus =
  "pending" | "running" | "review" | "failed" | "not_applicable";
type JobStatus = "queued" | "running" | "review" | "failed";
type Job = {
  id: string;
  project_key: string;
  request_id: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  progress: Record<string, ProgressStatus>;
  note: string;
};
const progressLabel: Record<ProgressStatus, string> = {
  pending: "Menunggu",
  running: "Berjalan",
  review: "Hasil tersedia",
  failed: "Gagal",
  not_applicable: "Tidak berlaku",
};
const jobLabel: Record<JobStatus, string> = {
  queued: "Dalam antrean",
  running: "Sedang dikerjakan",
  review: "Menunggu review pemilik",
  failed: "Proses gagal",
};
const notes: Record<string, string> = {
  queued: "Menunggu runner yang terhubung ke proyek ini.",
  runner_claimed: "Runner telah mengambil pekerjaan.",
  running: "Runner sedang memproses proyek.",
  review_ready: "Hasil produksi tersedia untuk diperiksa pemilik.",
  review_with_gaps:
    "Hasil tersedia dengan temuan atau bukti yang belum lengkap. Periksa catatan QA sebelum melanjutkan.",
  runner_failed:
    "Runner melaporkan kegagalan. Periksa log pada komputer runner.",
};
const toolkitUrl =
  "https://tanabe-h74-review.violetblackbird16.chatgpt.site/Orang-Mesin-5-Agent.zip";
const keyStorage = "alur.agent.project.v1";
const pendingPrefix = "alur.agent.request.v1.";
const validKey = (s: string) =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 64;
function rememberedKey() {
  try {
    return localStorage.getItem(keyStorage) || "mesin-baru";
  } catch {
    return "mesin-baru";
  }
}
function date(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Belum tersedia"
    : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}
function checkedJob(value: unknown): Job {
  if (!value || typeof value !== "object")
    throw Error("Data pekerjaan tidak valid. Coba muat ulang.");
  const j = value as Job;
  if (
    typeof j.id !== "string" ||
    typeof j.project_key !== "string" ||
    !Object.hasOwn(jobLabel, j.status) ||
    !j.progress ||
    typeof j.progress !== "object" ||
    typeof j.updated_at !== "string"
  )
    throw Error("Data pekerjaan tidak valid. Coba muat ulang.");
  for (const stage of stages)
    for (const role of stage.roles)
      if (!Object.hasOwn(progressLabel, j.progress[role.key]))
        throw Error(
          "Status agen belum lengkap. Muat ulang setelah layanan diperbarui.",
        );
  return j;
}
function statusIcon(status: ProgressStatus) {
  return status === "running" ? (
    <LoaderCircle className="agent-spin" size={14} />
  ) : status === "review" ? (
    <Check size={14} />
  ) : status === "failed" ? (
    <AlertCircle size={14} />
  ) : (
    <Clock3 size={14} />
  );
}

export default function AgentStudio({
  signed,
  authReady,
  onLogin,
  onAuthExpired,
}: {
  signed: boolean;
  authReady: boolean;
  onLogin: () => void;
  onAuthExpired: () => void;
}) {
  const [project, projectSet] = useState(rememberedKey),
    [jobs, jobsSet] = useState<Job[]>([]),
    [selected, select] = useState<string | null>(null),
    [loading, loadSet] = useState(false),
    [error, errorSet] = useState(""),
    [submitError, submitErrorSet] = useState(""),
    [submitting, submitSet] = useState(false),
    [loaded, loadedSet] = useState(false),
    [lastCheck, checkSet] = useState<number | null>(null),
    [now, nowSet] = useState(Date.now()),
    [copied, copySet] = useState(false);
  const signedRef = useRef(signed);
  signedRef.current = signed;
  const alive = useRef(true),
    inFlight = useRef(false),
    mutation = useRef(0),
    loadAbort = useRef<AbortController | null>(null),
    postAbort = useRef<AbortController | null>(null),
    submitLock = useRef(false),
    authExpired = useRef(onAuthExpired),
    request = useRef<{ key: string; id: string } | null>(null);
  authExpired.current = onAuthExpired;
  const current = jobs.find((j) => j.id === selected) || jobs[0];
  const projectKey = project.trim();
  const active = jobs.find(
    (j) =>
      j.project_key === projectKey &&
      (j.status === "queued" || j.status === "running"),
  );
  const stale =
    !!current &&
    current.status === "running" &&
    now - new Date(current.updated_at).getTime() > 120000;
  const done = current
    ? stages
        .flatMap((stage) => stage.roles.map((role) => role.key))
        .filter((key) =>
          ["review", "not_applicable"].includes(current.progress[key]),
        ).length
    : 0;
  const command = `python3 runner.py --toolkit /path/orang-mesin-production --project /path/jobs/${validKey(projectKey) ? projectKey : "mesin-baru"} --project-key ${validKey(projectKey) ? projectKey : "mesin-baru"}`;

  const refresh = useCallback(async () => {
    if (!signedRef.current || inFlight.current) return;
    inFlight.current = true;
    const controller = new AbortController();
    loadAbort.current = controller;
    const version = mutation.current;
    loadSet(true);
    try {
      const result = await api(
        "agent-jobs?limit=20",
        undefined,
        true,
        controller.signal,
      );
      if (!Array.isArray(result.jobs))
        throw Error("Daftar pekerjaan tidak valid.");
      const rows = result.jobs.map(checkedJob);
      if (
        alive.current &&
        !controller.signal.aborted &&
        version === mutation.current
      ) {
        jobsSet(rows);
        errorSet("");
        loadedSet(true);
        checkSet(Date.now());
      }
    } catch (e) {
      if (alive.current && !controller.signal.aborted) {
        errorSet(
          e instanceof ApiError && e.status === 401
            ? "Sesi berakhir. Masuk kembali untuk melihat pekerjaan."
            : (e as Error).message,
        );
        if (e instanceof ApiError && e.status === 401) authExpired.current();
      }
    } finally {
      if (loadAbort.current === controller) {
        loadAbort.current = null;
        inFlight.current = false;
        if (alive.current) loadSet(false);
      }
    }
  }, [signed]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      loadAbort.current?.abort();
      postAbort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!signed) {
      jobsSet([]);
      select(null);
      loadedSet(false);
      checkSet(null);
      return;
    }
    void refresh();
    const tick = setInterval(() => {
      nowSet(Date.now());
      if (!document.hidden) void refresh();
    }, 5000);
    const visible = () => {
      if (!document.hidden) {
        nowSet(Date.now());
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", visible);
      loadAbort.current?.abort();
    };
  }, [signed, refresh]);
  useEffect(() => {
    try {
      if (validKey(projectKey)) localStorage.setItem(keyStorage, projectKey);
    } catch {}
  }, [projectKey]);
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => copySet(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  async function create() {
    if (!signed) {
      onLogin();
      return;
    }
    if (submitLock.current || !validKey(projectKey) || active) return;
    submitLock.current = true;
    submitSet(true);
    submitErrorSet("");
    mutation.current++;
    const controller = new AbortController();
    postAbort.current = controller;
    try {
      if (request.current?.key !== projectKey) {
        let previous: string | null = null;
        try {
          previous = sessionStorage.getItem(pendingPrefix + projectKey);
        } catch {}
        request.current = {
          key: projectKey,
          id:
            previous && /^[0-9a-f-]{36}$/i.test(previous)
              ? previous
              : crypto.randomUUID(),
        };
      }
      const pending = request.current;
      try {
        sessionStorage.setItem(pendingPrefix + projectKey, pending.id);
      } catch {}
      const response = await api(
        "agent-jobs",
        { project_key: pending.key, request_id: pending.id },
        true,
        controller.signal,
      );
      const job = checkedJob(response.job);
      if (alive.current && !controller.signal.aborted) {
        jobsSet((old) => [job, ...old.filter((j) => j.id !== job.id)]);
        select(job.id);
        loadedSet(true);
        errorSet("");
        checkSet(Date.now());
        request.current = null;
        try {
          sessionStorage.removeItem(pendingPrefix + pending.key);
        } catch {}
      }
    } catch (e) {
      if (alive.current && !controller.signal.aborted) {
        const failure = e as Error;
        submitErrorSet(
          e instanceof ApiError && e.status === 409
            ? "Proyek ini sudah memiliki pekerjaan aktif atau ID permintaannya bertentangan. Muat ulang daftar dan periksa runner."
            : e instanceof ApiError && e.status === 401
              ? "Sesi berakhir. Masuk, lalu kirim ulang; ID permintaan tetap sama."
              : failure.message,
        );
        if (e instanceof ApiError && e.status === 401) authExpired.current();
      }
    } finally {
      submitLock.current = false;
      postAbort.current = null;
      if (alive.current) {
        submitSet(false);
        void refresh();
      }
    }
  }

  return (
    <section className="agent-studio" aria-labelledby="agent-title">
      <div className="agent-intro">
        <div>
          <p className="agent-eyebrow">ORANG MESIN · RUANG PRODUKSI</p>
          <h1 id="agent-title">Proyek lokal</h1>
          <p>
            Sepuluh peran mengolah sumber mesin menjadi model untuk Anda review.
          </p>
        </div>
        <span className="agent-private">
          <Workflow size={16} />
          Review pribadi
        </span>
      </div>
      <div className="agent-layout">
        <aside className="agent-sidebar" aria-label="Pengaturan produksi">
          <section className="agent-card">
            <h2>Mulai produksi</h2>
            <p>Gunakan kunci yang sama dengan proyek pada komputer runner.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <label htmlFor="agent-project-key">
                Kunci proyek
                <input
                  id="agent-project-key"
                  value={project}
                  onChange={(e) => projectSet(e.target.value)}
                  maxLength={64}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  disabled={submitting}
                  aria-describedby="agent-project-help"
                />
              </label>
              <p className="agent-help" id="agent-project-help">
                Huruf kecil, angka, dan tanda hubung. Contoh: tanabe-h74.
              </p>
              {!authReady ? (
                <p role="status">Memeriksa sesi…</p>
              ) : !signed ? (
                <button type="button" className="primary" onClick={onLogin}>
                  <LogIn size={16} />
                  Masuk untuk memulai
                </button>
              ) : (
                <button
                  className="primary"
                  type="submit"
                  disabled={submitting || !validKey(projectKey) || !!active}
                >
                  {submitting ? (
                    <LoaderCircle className="agent-spin" size={16} />
                  ) : (
                    <Workflow size={16} />
                  )}{" "}
                  {submitting
                    ? "Mengirim…"
                    : active
                      ? "Proyek sedang aktif"
                      : "Antrekan produksi"}
                </button>
              )}
              {active && (
                <p className="agent-help">
                  Pekerjaan aktif tetap berjalan di runner.{" "}
                  <button
                    type="button"
                    className="agent-text-button"
                    onClick={() => select(active.id)}
                  >
                    Lihat statusnya
                  </button>
                </p>
              )}
              {submitError && (
                <p className="agent-error" role="alert">
                  {submitError}
                </p>
              )}
            </form>
            <p className="agent-help">
              Runner yang terhubung akan mengambil pekerjaan ini.
            </p>
          </section>
          <section className="agent-card agent-setup">
            <h2>Hubungkan runner</h2>
            <p>
              Satu kali persiapan di komputer yang memiliki sumber mesin, Codex
              CLI, dan Blender. Biarkan runner aktif selama produksi.
            </p>
            <div className="agent-downloads">
              <a href={toolkitUrl} target="_blank" rel="noreferrer">
                <Download size={15} />
                Toolkit produksi
                <ExternalLink size={12} />
              </a>
              <a href={alurBase + "runner.py"} download>
                <Download size={15} />
                runner.py
              </a>
            </div>
            <details>
              <summary>Perintah menjalankan runner</summary>
              <p>
                Ekstrak toolkit. Ganti path toolkit dan proyek sesuai folder
                Anda. Alamat layanan sudah disiapkan di runner. Email dan kata
                sandi diminta secara lokal, bukan ditulis dalam perintah.
              </p>
              <pre tabIndex={0} aria-label="Perintah runner">
                <code>{command}</code>
              </pre>
              <button
                type="button"
                className="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(command);
                    copySet(true);
                  } catch {
                    copySet(false);
                    submitErrorSet(
                      "Salin perintah secara manual dari kotak runner.",
                    );
                  }
                }}
              >
                {copied ? <Check size={14} /> : null}
                {copied ? "Tersalin" : "Salin perintah"}
              </button>
              <p className="agent-help">
                Windows: ganti <code>python3</code> dengan <code>py -3</code>.
                Kunci proyek harus sama dengan yang didaftarkan pada runner.
              </p>
            </details>
          </section>
        </aside>
        <div className="agent-main">
          <section className="agent-card agent-status">
            <div className="agent-section-heading">
              <h2>Status pekerjaan</h2>
              <button
                type="button"
                className="secondary"
                onClick={() => void refresh()}
                disabled={!signed || loading}
                aria-label="Muat ulang pekerjaan"
              >
                {loading ? (
                  <LoaderCircle className="agent-spin" size={15} />
                ) : (
                  <RefreshCw size={15} />
                )}
                Muat ulang
              </button>
            </div>
            {error && (
              <p className="agent-error" role="alert">
                {error}
                {jobs.length > 0 &&
                  " Status di bawah adalah data terakhir yang berhasil dimuat."}
              </p>
            )}
            {!signed ? (
              <p>
                {authReady
                  ? "Masuk untuk melihat pekerjaan akun Anda."
                  : "Memeriksa koneksi akun…"}
              </p>
            ) : !loaded && loading ? (
              <p role="status">Memuat pekerjaan…</p>
            ) : loaded && jobs.length === 0 ? (
              <div className="agent-empty">
                <Workflow size={25} />
                <div>
                  <strong>Belum ada pekerjaan</strong>
                  <p>Hubungkan runner, lalu antrekan proyek pertama.</p>
                </div>
              </div>
            ) : null}
            {current && (
              <>
                <div className="agent-job-field">
                  <label htmlFor="agent-job">Pekerjaan</label>
                  <select
                    id="agent-job"
                    value={current.id}
                    onChange={(e) => select(e.target.value)}
                  >
                    {jobs.map((job) => (
                      <option value={job.id} key={job.id}>
                        {job.project_key} · {date(job.created_at)} ·{" "}
                        {jobLabel[job.status]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="agent-job-summary">
                  <span
                    className={`agent-pill ${current.status}`}
                    role="status"
                  >
                    {jobLabel[current.status]}
                  </span>
                  <span>{done}/10 peran selesai diproses</span>
                </div>
                <progress
                  max={10}
                  value={done}
                  aria-label="Peran yang sudah dilaporkan"
                />
                <p>
                  {notes[current.note] ||
                    "Status diterima dari layanan pekerjaan."}
                </p>
                <dl className="agent-metadata">
                  <div>
                    <dt>Pembaruan runner</dt>
                    <dd>{date(current.updated_at)}</dd>
                  </div>
                  <div>
                    <dt>Pemeriksaan halaman</dt>
                    <dd>
                      {lastCheck
                        ? date(new Date(lastCheck).toISOString())
                        : "Belum tersedia"}
                    </dd>
                  </div>
                </dl>
                {stale && (
                  <p className="agent-warning" role="status">
                    <AlertCircle size={17} />
                    Runner belum memperbarui status lebih dari 2 menit. Periksa
                    proses dan koneksi runner; pekerjaan belum dinyatakan gagal
                    dan tidak diulang otomatis.
                  </p>
                )}
                {current.status === "failed" && (
                  <p className="agent-error">
                    <AlertCircle size={17} />
                    Produksi belum selesai. Baca log runner dan perbaiki
                    penyebabnya sebelum membuat pekerjaan baru.
                  </p>
                )}
                {current.status === "review" && (
                  <p className="agent-review-note">
                    Buka hasil pada folder proyek runner:{" "}
                    <code>{`.alur-runner/jobs/${current.id}/project`}</code>.
                    Catatan QA menunjukkan bagian yang perlu diperbaiki.
                  </p>
                )}
              </>
            )}
          </section>
          <section
            className="agent-card agent-pipeline"
            aria-labelledby="agent-pipeline-title"
          >
            <div className="agent-section-heading">
              <h2 id="agent-pipeline-title">Alur sepuluh peran</h2>
              <span className="agent-help">
                {current ? "Status dari runner" : "Rencana tahap"}
              </span>
            </div>
            <p className="agent-help">
              Setiap tahap menunggu keluaran tahap sebelumnya.
            </p>
            <ol className="agent-stages">
              {stages.map((stage, index) => (
                <li key={stage.name} className="agent-stage">
                  <div className="agent-stage-heading">
                    <span>{index + 1}</span>
                    <div>
                      <h3>{stage.name}</h3>
                      <p>{stage.hint}</p>
                    </div>
                  </div>
                  <ul className="agent-role-grid">
                    {stage.roles.map((role) => {
                      const state = current?.progress[role.key];
                      return (
                        <li
                          key={role.key}
                          className={`agent-role ${state || "planned"}`}
                        >
                          <div>
                            <strong>{role.name}</strong>
                            <p>{role.detail}</p>
                          </div>
                          <span className="agent-role-status">
                            {state ? statusIcon(state) : <Clock3 size={14} />}{" "}
                            {state ? progressLabel[state] : "Belum dijalankan"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {index < stages.length - 1 && (
                    <div className="agent-stage-connector">
                      <ArrowDown size={18} aria-hidden="true" />
                      <span className="sr-only">
                        Dilanjutkan ke tahap berikut setelah tahap ini selesai
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <div className="agent-owner">
              <ChevronRight size={18} />
              <div>
                <strong>Keputusan Anda</strong>
                <p>
                  Review hasil dan tentukan revisi atau kelayakannya. Publikasi
                  katalog dilakukan terpisah.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
