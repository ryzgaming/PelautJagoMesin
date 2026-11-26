import { useCallback, useEffect, useState } from "react";
import { Bot, LogIn, LogOut, RefreshCw, Save, Sparkles } from "lucide-react";
import { api, ApiError } from "./api";
import "./settings.css";
import WorkerQuota from "./WorkerQuota";

type Worker = "claude" | "codex";
type Settings = {
  primary_worker: Worker;
  claude_enabled: boolean;
  codex_enabled: boolean;
  takeover_minutes: number;
};
type View = {
  settings: Settings & { updated_at: string | null };
  workers: Record<Worker, string | null>;
  primary_alive: boolean;
  queue: Record<"queued" | "running" | "review" | "needs_evidence" | "failed", number>;
  active: { id: string; brand: string; model: string; worker: Worker | null; updated_at: string | null }[];
};

export const startModeKey = "alur-start-mode";
const names: Record<Worker, string> = { claude: "Claude", codex: "Codex (ChatGPT)" };
const short: Record<Worker, string> = { claude: "Claude", codex: "Codex" };
const takeoverChoices = [30, 45, 60, 75, 90, 120, 180, 360];
const queueLabels: [keyof View["queue"], string][] = [
  ["queued", "Menunggu"],
  ["running", "Dikerjakan"],
  ["review", "Siap direview"],
  ["needs_evidence", "Bukti kurang"],
  ["failed", "Terhenti"],
];

const pick = (s: Settings): Settings => ({
  primary_worker: s.primary_worker,
  claude_enabled: s.claude_enabled,
  codex_enabled: s.codex_enabled,
  takeover_minutes: s.takeover_minutes,
});
type StartMode = "beranda" | "agen" | "editor";
/** Halaman pembuka tersimpan; Beranda bila belum pernah dipilih. */
export function readStart(): StartMode {
  try {
    const value = localStorage.getItem(startModeKey);
    return value === "editor" || value === "agen" ? value : "beranda";
  } catch {
    return "beranda";
  }
}

export default function SettingsStudio({
  signed,
  onLogin,
  onAuthExpired,
  onLogout,
  onOpen,
}: {
  signed: boolean;
  onLogin: () => void;
  onAuthExpired: () => void;
  onLogout: () => void;
  onOpen: (mode: "agen" | "editor") => void;
}) {
  const [view, setView] = useState<View | null>(null),
    [draft, setDraft] = useState<Settings | null>(null),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [start, setStart] = useState(readStart),
    [now, setNow] = useState(Date.now());

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        onAuthExpired();
        return "Sesi berakhir. Masuk kembali untuk membuka pengaturan.";
      }
      return (e as Error).message || "Pengaturan belum dapat dimuat.";
    },
    [onAuthExpired],
  );
  const load = useCallback(async () => {
    if (!signed) return;
    setLoading(true);
    try {
      const next = (await api("machines-settings")) as View;
      setView(next);
      setDraft((current) => current ?? pick(next.settings));
      setError("");
      setNow(Date.now());
    } catch (e) {
      setError(fail(e));
    } finally {
      setLoading(false);
    }
  }, [signed, fail]);
  useEffect(() => {
    if (!signed) {
      setView(null);
      setDraft(null);
      return;
    }
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [signed, load]);

  const changed =
    !!view &&
    !!draft &&
    (Object.keys(draft) as (keyof Settings)[]).some((key) => draft[key] !== view.settings[key]);
  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const next = (await api("machines-settings", draft)) as View;
      setView(next);
      setDraft(pick(next.settings));
      setError("");
      setNow(Date.now());
      setNotice("Pengaturan tersimpan. Pekerja mengikuti aturan baru mulai klaim berikutnya.");
    } catch (e) {
      setError(fail(e));
    } finally {
      setSaving(false);
    }
  }
  function chooseStart(mode: StartMode) {
    setStart(mode);
    try {
      localStorage.setItem(startModeKey, mode);
    } catch {}
  }

  const backup: Worker = draft?.primary_worker === "claude" ? "codex" : "claude";
  const set = (patch: Partial<Settings>) => {
    setNotice("");
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  return (
    <section className="agent-studio settings-studio" aria-labelledby="settings-title">
      <div className="settings-top">
        <p className="agent-eyebrow">ORANG MESIN · PENGATURAN</p>
        <h1 id="settings-title">Pengaturan</h1>
        <p>Atur siapa yang mengerjakan produksi mesin, pantau antrean, dan sesuaikan Alur.</p>
      </div>

      {!signed ? (
        <section className="agent-card settings-card">
          <h2>Pekerja produksi</h2>
          <p>Masuk dengan akun pemilik untuk mengatur pekerja dan melihat antrean.</p>
          <button type="button" className="primary" onClick={onLogin}>
            <LogIn size={16} /> Masuk
          </button>
        </section>
      ) : (
        <>
          {error && (
            <p className="machine-error" role="alert">
              {error}
            </p>
          )}
          <section className="agent-card settings-card" aria-labelledby="settings-workers">
            <div className="agent-section-heading">
              <h2 id="settings-workers">Pekerja produksi</h2>
              <button type="button" aria-label="Muat ulang pengaturan" onClick={() => void load()} disabled={loading}>
                <RefreshCw size={16} className={loading ? "agent-spin" : ""} />
              </button>
            </div>
            {!draft || !view ? (
              <p role="status">{loading ? "Memuat pengaturan…" : "Pengaturan belum dimuat."}</p>
            ) : (
              <>
                <div className="settings-field">
                  <span className="settings-label">Pekerja utama</span>
                  <div className="settings-segment" role="radiogroup" aria-label="Pekerja utama">
                    {(["claude", "codex"] as Worker[]).map((worker) => (
                      <button
                        key={worker}
                        type="button"
                        role="radio"
                        aria-checked={draft.primary_worker === worker}
                        onClick={() => set({ primary_worker: worker })}
                      >
                        {worker === "claude" ? <Sparkles size={15} /> : <Bot size={15} />}
                        {short[worker]}
                      </button>
                    ))}
                  </div>
                  <small>
                    {short[draft.primary_worker]} mengerjakan semua mesin. {short[backup]} hanya cadangan: mengambil
                    alih bila {short[draft.primary_worker]} berhenti di tengah pekerjaan, atau tidak aktif selama
                    waktu di bawah.
                  </small>
                </div>

                {(["claude", "codex"] as Worker[]).map((worker) => {
                  const key = worker === "claude" ? "claude_enabled" : "codex_enabled";
                  const on = draft[key];
                  return (
                    <div className="settings-worker-block" key={worker}>
                    <div className="settings-worker">
                      <div>
                        <strong>
                          {names[worker]}
                          <span className="settings-role">
                            {draft.primary_worker === worker ? "Utama" : "Cadangan"}
                          </span>
                        </strong>
                        <small>
                          {worker === "claude" ? "Jadwal tiap jam menit ke-40" : "Automasi di ChatGPT"}
                        </small>
                      </div>
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => set({ [key]: e.target.checked } as Partial<Settings>)}
                        />
                        <span aria-hidden="true" />
                        <span className="sr-only">{names[worker]} aktif</span>
                        <em>{on ? "Aktif" : "Dijeda"}</em>
                      </label>
                    </div>
                    <WorkerQuota
                      worker={worker}
                      settings={view.settings}
                      checkin={view.workers[worker]}
                      sessions={view.active.map((a) => ({ ...a, updated_at: a.updated_at ?? "", status: "running" }))}
                      now={now}
                      countToday={false}
                      compact
                    />
                    </div>
                  );
                })}

                <label className="settings-field">
                  <span className="settings-label">Cadangan mengambil alih bila pekerja utama tidak aktif selama</span>
                  <select
                    value={draft.takeover_minutes}
                    onChange={(e) => set({ takeover_minutes: Number(e.target.value) })}
                  >
                    {[...new Set([...takeoverChoices, draft.takeover_minutes])]
                      .sort((a, b) => a - b)
                      .map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes < 60 || minutes % 60 ? `${minutes} menit` : `${minutes / 60} jam`}
                        </option>
                      ))}
                  </select>
                  {draft.primary_worker === "claude" && (
                    <small>Claude berjalan tiap jam, jadi beri waktu lebih dari 60 menit.</small>
                  )}
                </label>

                {!draft.claude_enabled && !draft.codex_enabled && (
                  <p className="machine-warning">Kedua pekerja dijeda. Mesin baru akan menunggu di antrean.</p>
                )}
                {draft.primary_worker === "claude" && draft.takeover_minutes <= 60 && draft.codex_enabled && (
                  <p className="machine-warning">
                    Dengan waktu ini, Codex bisa mengambil antrean di sela jadwal Claude per jam.
                  </p>
                )}
                <div className="settings-actions">
                  <button type="button" className="primary" onClick={() => void save()} disabled={!changed || saving}>
                    <Save size={16} /> {saving ? "Menyimpan…" : "Simpan pengaturan"}
                  </button>
                  {changed && (
                    <button type="button" className="secondary" onClick={() => setDraft(pick(view.settings))}>
                      Batal
                    </button>
                  )}
                </div>
                {notice && (
                  <p className="machine-notice" role="status">
                    {notice}
                  </p>
                )}
              </>
            )}
          </section>

          {view && (
            <section className="agent-card settings-card" aria-labelledby="settings-queue">
              <h2 id="settings-queue">Antrean produksi</h2>
              <p className="settings-state">
                {view.primary_alive
                  ? `${short[view.settings.primary_worker]} (utama) aktif.`
                  : `${short[view.settings.primary_worker]} (utama) sedang tidak aktif — cadangan boleh mengambil antrean.`}
              </p>
              <dl className="settings-queue">
                {queueLabels.map(([key, label]) => (
                  <div key={key} className={key}>
                    <dt>{label}</dt>
                    <dd>{view.queue[key]}</dd>
                  </div>
                ))}
              </dl>
              {view.active.length > 0 && (
                <ul className="settings-active">
                  {view.active.map((row) => (
                    <li key={row.id}>
                      <strong>
                        {row.brand} {row.model}
                      </strong>
                      <small>{row.worker ? `Dikerjakan ${short[row.worker]}` : "Dikerjakan"}</small>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="secondary" onClick={() => onOpen("agen")}>
                Buka Agen mesin
              </button>
            </section>
          )}
        </>
      )}

      <section className="agent-card settings-card" aria-labelledby="settings-general">
        <h2 id="settings-general">Umum</h2>
        <div className="settings-field">
          <span className="settings-label">Halaman pembuka</span>
          <div className="settings-segment" role="radiogroup" aria-label="Halaman pembuka">
            {(
              [
                ["beranda", "Beranda"],
                ["agen", "Mesin"],
                ["editor", "Bagan"],
              ] as const
            ).map(([mode, label]) => (
              <button key={mode} type="button" role="radio" aria-checked={start === mode} onClick={() => chooseStart(mode)}>
                {label}
              </button>
            ))}
          </div>
          <small>Disimpan di perangkat ini.</small>
        </div>
        {signed && (
          <button type="button" className="secondary settings-logout" onClick={onLogout}>
            <LogOut size={16} /> Keluar dari akun
          </button>
        )}
      </section>
    </section>
  );
}
