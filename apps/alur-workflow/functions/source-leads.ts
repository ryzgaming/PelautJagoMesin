import { apiKey, url } from "./config";

type Session = { id: string; brand: string; model: string };
type Item = { title: string; url: string };
type Status = "found" | "empty" | "unavailable";

// Only indexing terms leave the account. Keep account/session identifiers out of the query.
function phrase(name: string) {
  return '"' + name.replace(/[^\p{L}\p{N} ._/-]/gu, " ").trim() + '"';
}

export async function discoverSourceLeads(session: Session, token: string): Promise<void> {
  const index = new URL("https://archive.org/advancedsearch.php");
  const brand = phrase(session.brand);
  index.searchParams.set("q", `mediatype:texts AND (title:(${brand}) OR creator:(${brand})) AND ${phrase(session.model)}`);
  index.searchParams.append("fl[]", "identifier");
  index.searchParams.append("fl[]", "title");
  index.searchParams.set("rows", "4");
  index.searchParams.set("output", "json");
  let status: Status = "unavailable";
  const items: Item[] = [];
  try {
    const result = await fetch(index, { signal: AbortSignal.timeout(6000), redirect: "error" });
    if (result.ok) {
      const body = await result.json() as { response?: { docs?: { identifier?: unknown; title?: unknown }[] } };
      if (Array.isArray(body.response?.docs)) {
        for (const hit of body.response.docs.slice(0, 4)) {
          if (typeof hit.identifier !== "string" || !/^[\w.-]{1,150}$/.test(hit.identifier) ||
              hit.identifier === "." || hit.identifier === ".." || typeof hit.title !== "string") continue;
          const title = Array.from(hit.title.replace(/\s+/g, " ").trim()).slice(0, 210).join("");
          if (title) items.push({ title, url: "https://archive.org/details/" + hit.identifier });
        }
        status = items.length ? "found" : "empty";
      }
    }
  } catch {
    // The agent still researches manufacturer documentation when the index is unavailable.
  }
  try {
    await fetch(url + "/rest/v1/rpc/alur_save_source_leads", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(5000),
      headers: { apikey: apiKey, Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ p_session_id: session.id, p_leads: { provider: "Internet Archive", status, items } }),
    });
  } catch {
    // A transient write failure leaves source_leads null. The durable session is already enqueued.
  }
}
