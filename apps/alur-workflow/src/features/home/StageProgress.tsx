import type { Progress } from "../machines/production-status";
import "./home.css";

/** Strip 10 segmen: hijau terbukti, kuning sebagian/belum terverifikasi, abu-abu belum dikerjakan. */
export default function StageProgress({ progress, compact = false }: { progress: Progress; compact?: boolean }) {
  return (
    <div className={"stage-progress" + (compact ? " compact" : "")}>
      <div className="stage-progress-head">
        <strong>{progress.done}/10 tahap terbukti</strong>
        <span>
          {progress.partial ? `${progress.partial} sebagian · ` : ""}
          {progress.waiting} belum
        </span>
      </div>
      <ol className="stage-bar" aria-label="Progres 10 tahap produksi">
        {progress.steps.map((step) => (
          <li key={step.key} className={step.tone} title={`${step.name}: ${step.label}`}>
            <span className="sr-only">
              {step.name}: {step.label}
            </span>
          </li>
        ))}
      </ol>
      {!compact && (
        <ul className="stage-legend">
          {progress.steps.map((step) => (
            <li key={step.key} className={step.tone}>
              <i aria-hidden="true" />
              {step.name}
              <small>{step.label}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
