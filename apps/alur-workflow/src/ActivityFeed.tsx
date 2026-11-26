import { useEffect, useRef, useState } from "react";
import { Box, Brain, FileText, Globe, Info, LoaderCircle, Save, Search, ShieldCheck } from "lucide-react";
import { api } from "./api";
import { mergeActivity, type Activity } from "./activity-merge";

const icons = { search: Search, open: Globe, read: FileText, think: Brain, write: Save, model: Box, check: ShieldCheck, info: Info };
const short = { claude: "Claude", codex: "Codex" } as const;

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
function when(at: string, now: number) {
  const seconds = Math.max(0, Math.round((now - new Date(at).getTime()) / 1000));
  if (seconds < 45) return "baru saja";
  if (seconds < 3600) return `${Math.round(seconds / 60)} mnt`;
  return new Date(at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/** Daftar langkah agen, diperbarui tiap 8 detik selama sesi dikerjakan. */
export default function ActivityFeed({
  sessionId,
  running,
  limit = 8,
  title = "Aktivitas langsung",
}: {
  sessionId: string;
  running: boolean;
  limit?: number;
  title?: string;
}) {
  const [items, setItems] = useState<Activity[] | null>(null),
    [error, setError] = useState(""),
    [all, setAll] = useState(false),
    [now, setNow] = useState(Date.now());
  const cursor = useRef(0);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    cursor.current = 0;
    setItems(null);
    setAll(false);
    async function load() {
      try {
        const data = await api(
          `machines-activity?id=${encodeURIComponent(sessionId)}&after=${cursor.current}`,
          undefined,
          true,
          controller.signal,
        );
        if (!alive) return;
        const rows = (Array.isArray(data.items) ? data.items : []) as Activity[];
        if (rows.length) cursor.current = Math.max(cursor.current, ...rows.map((r) => r.id));
        setItems((prev) => mergeActivity(prev ?? [], rows));
        setError("");
        setNow(Date.now());
      } catch (e) {
        if (alive && !controller.signal.aborted) {
          setItems((prev) => prev ?? []);
          setError((e as Error).message || "Aktivitas belum tersedia.");
        }
      }
    }
    void load();
    const timer = running
      ? window.setInterval(() => {
          if (document.visibilityState === "visible") void load();
        }, 8000)
      : undefined;
    return () => {
      alive = false;
      controller.abort();
      if (timer) window.clearInterval(timer);
    };
  }, [sessionId, running]);

  const shown = items ? (all ? items : items.slice(0, limit)) : [];
  return (
    <section className="activity-feed" aria-label={title}>
      <div className="activity-head">
        <strong>{title}</strong>
        {running ? (
          <span className="activity-live">
            <i aria-hidden="true" /> Langsung
          </span>
        ) : (
          <span className="activity-quiet">Tidak berjalan</span>
        )}
      </div>
      {items === null ? (
        <div className="home-skeleton" aria-label="Memuat aktivitas">
          <i />
          <i />
        </div>
      ) : items.length === 0 ? (
        <p className="activity-empty">
          {error || (running ? "Menunggu langkah pertama dari agen…" : "Belum ada aktivitas tercatat untuk sesi ini.")}
        </p>
      ) : (
        <ol className="activity-list" aria-live="polite">
          {shown.map((item, index) => {
            const Icon = running && index === 0 ? LoaderCircle : icons[item.kind];
            return (
              <li key={item.id} className={item.kind + (running && index === 0 ? " activity-now" : "")}>
                <span className="activity-icon">
                  <Icon size={15} className={running && index === 0 ? "agent-spin" : ""} />
                </span>
                <span className="activity-body">
                  <span className="activity-text">{item.message}</span>
                  <small>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noreferrer noopener">
                        {host(item.url)}
                      </a>
                    )}
                    {item.url ? " · " : ""}
                    {item.worker ? short[item.worker] + " · " : ""}
                    {when(item.at, now)}
                  </small>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {items && items.length > limit && (
        <button type="button" className="activity-more" onClick={() => setAll(!all)}>
          {all ? "Tampilkan lebih sedikit" : `Tampilkan semua (${items.length})`}
        </button>
      )}
    </section>
  );
}
