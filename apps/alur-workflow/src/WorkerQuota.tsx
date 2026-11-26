import { Bot, ExternalLink, Sparkles } from "lucide-react";
import { finishedToday, usageLinks, workerHealth, type WorkerName } from "./worker-health";

type Settings = { primary_worker: WorkerName; claude_enabled: boolean; codex_enabled: boolean; takeover_minutes: number };
type Session = { status: string; worker?: string | null; updated_at: string; brand?: string; model?: string };
const short: Record<WorkerName, string> = { claude: "Claude", codex: "Codex" };

/** Kartu kondisi pekerja + tombol menuju halaman sisa token resmi. */
export default function WorkerQuota({
  worker,
  settings,
  checkin,
  sessions,
  now,
  countToday = true,
  compact = false,
}: {
  worker: WorkerName;
  settings: Settings;
  checkin: string | null;
  sessions: Session[];
  now: number;
  countToday?: boolean;
  compact?: boolean;
}) {
  const health = workerHealth(worker, settings, checkin, sessions, now);
  const done = finishedToday(worker, sessions, now);
  return (
    <div className={"worker-quota " + health.tone + (compact ? " compact" : "")}>
      <div className="worker-quota-head">
        {!compact && (worker === "claude" ? <Sparkles size={18} /> : <Bot size={18} />)}
        {!compact && <strong>{short[worker]}</strong>}
        {!compact && <em>{settings.primary_worker === worker ? "Utama" : "Cadangan"}</em>}
        <span className="worker-quota-state">
          <i aria-hidden="true" />
          {health.label}
        </span>
      </div>
      <small>
        {health.detail}
        {countToday ? ` · ${done} mesin selesai hari ini` : ""}
      </small>
      <a href={usageLinks[worker]} target="_blank" rel="noreferrer">
        Cek sisa token {short[worker]} <ExternalLink size={13} />
      </a>
    </div>
  );
}
