import {adminStatus, authenticate, cookie, errorText} from "../../apps/alur-workflow/functions/api/session";

const privateHeaders = {"Cache-Control":"private, no-store", "Vary":"Cookie", "X-Robots-Tag":"noindex, nofollow"};
function login(status: number) {
  const html = `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Masuk admin · Alur</title>
<link rel="stylesheet" href="/assets/site.css"><main class="shell" style="max-width:32rem;padding-block:8vh"><a href="/" class="brand">orangmesin.</a><h1>Masuk admin</h1>
<p role="status">${errorText(status)}</p><form method="post"><label>Email admin<input name="email" type="email" autocomplete="username" required></label>
<label>Kata sandi<input name="password" type="password" autocomplete="current-password" required></label><button class="btn primary">Masuk ke Alur</button></form></main></html>`;
  return new Response(html,{status,headers:{...privateHeaders,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; style-src 'self' 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}
export const onRequest: PagesFunction = async ({request, next}) => {
  const target = new URL(request.url);
  const path = target.pathname.replace(/\/+$/,"");
  if (path === "/alur/api/session") return next(); // This handler checks membership before issuing cookies.
  const document = ["/alur","/alur/index","/alur/index.html","/alur/form","/alur/form/index","/alur/form/index.html"].includes(path);
  const refresh = document && request.method === "GET" && cookie(request,"alur_refresh");
  const posting = document && request.method === "POST";
  let status = await adminStatus(cookie(request,"alur_access"));
  if (posting || (refresh && status === 401)) {
    if (posting && request.headers.get("origin") !== target.origin) return login(403);
    try {
      const headers = new Headers(privateHeaders);
      const form = posting ? await request.formData() : null;
      status = await authenticate(form ? {action:"login",email:String(form.get("email") || ""),password:String(form.get("password") || "")} : {action:"refresh"},request,headers);
      if (status === 200) { headers.set("Location",target.pathname + target.search); return new Response(null,{status:303,headers}); }
    } catch { status = 503; }
    return login(status);
  }
  if (status !== 200) return document ? login(status) : Response.json({error:errorText(status)},{status,headers:{...privateHeaders,"X-Alur-Access":"denied"}});
  const original = await next();
  const result = new Response(original.body,original);
  result.headers.set("Cache-Control",privateHeaders["Cache-Control"]);
  result.headers.append("Vary","Cookie");
  result.headers.set("X-Robots-Tag",privateHeaders["X-Robots-Tag"]);
  return result;
};
