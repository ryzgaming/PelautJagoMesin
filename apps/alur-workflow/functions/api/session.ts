import {url, apiKey} from "../config";

export function cookie(req: Request, key: string) {
  return (req.headers.get("cookie") || "").split(/;\s*/).find(v => v.startsWith(key + "="))?.slice(key.length + 1) || "";
}
export async function adminStatus(token: string): Promise<number> {
  if (!token) return 401;
  try {
    const response = await fetch(url + "/rest/v1/rpc/alur_is_admin", {
      method: "POST", headers: {apikey: apiKey, Authorization: "Bearer " + token, "Content-Type": "application/json"},
      body: "{}", signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401) return 401;
    if (!response.ok) return 503;
    return (await response.json()) === true ? 200 : 403;
  } catch { return 503; }
}
export function errorText(status: number) {
  if (status === 401) return "Silakan masuk dengan akun admin.";
  if (status === 403) return "Alur hanya dapat diakses oleh admin.";
  return "Pemeriksaan akses belum tersedia. Coba lagi.";
}
function json(body: unknown, status = 200, headers = new Headers()) {
  headers.set("Cache-Control","private, no-store");
  return Response.json(body, {status, headers});
}
function setCookies(h: Headers, credentials?: {access_token: string, refresh_token: string, expires_in: number}) {
  for (const [key,value,age] of [
    ["alur_access",credentials?.access_token,credentials?.expires_in],
    ["alur_refresh",credentials?.refresh_token,2592000],
  ] as const) {
    const suffix = "; HttpOnly; Secure; SameSite=Strict";
    h.append("Set-Cookie",key + "=; Path=/alur/api; Max-Age=0" + suffix);
    h.append("Set-Cookie",key + "=" + (value || "") + "; Path=/alur; Max-Age=" + (credentials ? age : 0) + suffix);
  }
}
export async function authenticate(body: Record<string,string>, request: Request, headers: Headers) {
  const refresh = body.action === "refresh";
  const credentials = refresh ? {refresh_token: cookie(request,"alur_refresh")} : {email: body.email,password: body.password};
  if (refresh ? !credentials.refresh_token : !credentials.email || !credentials.password) return 401;
  const result = await fetch(url + "/auth/v1/token?grant_type=" + (refresh ? "refresh_token" : "password"), {
    method: "POST", headers: {apikey: apiKey,"Content-Type":"application/json"}, body: JSON.stringify(credentials), signal: AbortSignal.timeout(10000),
  });
  if (!result.ok) return result.status >= 500 || result.status === 429 ? 503 : 401;
  const tokens = await result.json() as {access_token:string,refresh_token:string,expires_in:number};
  const status = await adminStatus(tokens.access_token);
  if (status === 200) setCookies(headers,tokens);
  return status;
}
export const onRequest: PagesFunction = async ({request}) => {
  try {
    if (request.method === "GET") {
      const status = await adminStatus(cookie(request,"alur_access"));
      return json(status === 200 ? {signedIn:true} : {signedIn:false,error:errorText(status)},status);
    }
    if (request.method !== "POST" || request.headers.get("origin") !== new URL(request.url).origin) return json({error:"Permintaan tidak valid."},403);
    const body = await request.json() as Record<string,string>;
    const headers = new Headers();
    if (body.action === "logout") { setCookies(headers); return json({ok:true},200,headers); }
    if (body.action !== "login" && body.action !== "refresh") return json({error:"Aksi tidak tersedia."},400);
    const status = await authenticate(body,request,headers);
    return json(status === 200 ? {ok:true} : {error:errorText(status)},status,headers);
  } catch { return json({error:errorText(503)},503); }
};
