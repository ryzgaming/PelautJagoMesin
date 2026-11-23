import { handleApi } from './api.mjs';

export const SITE_ORIGIN = 'https://pelaut-jago-mesin.violetblackbird16.chatgpt.site';
export const PAGES_ORIGIN = 'https://pelautjagomesin.pages.dev';
export const MAN_V4_REVIEW_ORIGIN = 'https://chatgpt-man-workspace-v4-ui.pelautjagomesin.pages.dev';

// Supabase verifies user sessions inside handleApi and webhook signatures separately.
// Public config/catalog and CORS preflights do not require an end-user JWT.
export async function handleEdge(request, env, fetcher = fetch) {
  const allowedOrigins = new Set([SITE_ORIGIN, PAGES_ORIGIN, MAN_V4_REVIEW_ORIGIN, ...(env.APP_ORIGIN ? [env.APP_ORIGIN] : [])]);
  const origin = request.headers.get('origin');
  const allowedOrigin = allowedOrigins.has(origin) ? origin : (env.APP_ORIGIN || SITE_ORIGIN);
  const headers = new Headers({ 'Vary': 'Origin', 'Cache-Control': 'no-store' });
  if (origin === allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'authorization, content-type, apikey, x-client-info');
  }
  if (origin && !allowedOrigins.has(origin)) {
    return Response.json({ error: 'INVALID_ORIGIN' }, { status: 403, headers });
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: origin ? 204 : 403, headers });
  if (!['GET', 'POST'].includes(request.method)) {
    return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405, headers });
  }
  const url = new URL(request.url);
  const route = url.pathname.match(/^\/(?:functions\/v1\/)?commerce\/([a-z-]+)\/?$/);
  if (!route) return Response.json({ error: 'NOT_FOUND' }, { status: 404, headers });
  url.pathname = '/api/' + route[1];
  const forwarded = new Request(url, request);
  const result = await handleApi(forwarded, { ...env, APP_ORIGIN: allowedOrigin }, fetcher);
  for (const [key, value] of result.headers) headers.set(key, value);
  return new Response(result.body, { status: result.status, headers });
}
