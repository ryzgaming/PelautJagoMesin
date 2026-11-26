export type Activity = {
  id: number;
  at: string;
  worker: "claude" | "codex" | null;
  kind: "search" | "open" | "read" | "think" | "write" | "model" | "check" | "info";
  message: string;
  url: string | null;
};

/** Gabungkan baris baru (terbaru di atas) tanpa duplikat, maksimal 50. */
export function mergeActivity(current: Activity[], incoming: Activity[]) {
  const seen = new Set(current.map((a) => a.id));
  return [...incoming.filter((a) => !seen.has(a.id)), ...current].sort((a, b) => b.id - a.id).slice(0, 50);
}
