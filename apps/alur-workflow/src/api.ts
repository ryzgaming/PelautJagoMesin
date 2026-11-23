import { alurBase } from "./paths";

let refreshing: Promise<boolean> | null = null;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function api(
  path: string,
  body?: unknown,
  again = true,
  signal?: AbortSignal,
): Promise<any> {
  const r = await fetch(
    alurBase + "api/" + path,
    body !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal,
        }
      : { cache: "no-store", signal },
  );
  if (
    r.status === 401 &&
    again &&
    (path.startsWith("flows") || path.startsWith("agent-jobs"))
  ) {
    refreshing ??= api("session", { action: "refresh" }, false)
      .then(
        () => true,
        () => false,
      )
      .finally(() => {
        refreshing = null;
      });
    if (await refreshing) return api(path, body, false, signal);
  }
  if (!r.headers.get("content-type")?.includes("application/json"))
    throw new ApiError("Layanan cloud belum terhubung.", r.status);
  const j = (await r.json()) as Record<string, any>;
  if (!r.ok) throw new ApiError(j.error || "Permintaan gagal.", r.status);
  return j;
}
