import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const bundled = await build({entryPoints: ['functions/alur/api/machines-settings.ts'], bundle: true,
  format: 'esm', platform: 'browser', write: false, logLevel: 'silent'});
const {onRequest} = await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const view = (patch = {}) => ({settings: {primary_worker: 'claude', claude_enabled: true, codex_enabled: true, takeover_minutes: 75,
  updated_at: '2026-11-26T08:45:00Z'}, workers: {claude: '2026-11-26T08:40:00Z', codex: null}, primary_alive: true,
  queue: {queued: 1, running: 0, review: 2, needs_evidence: 0, failed: 0}, active: [], ...patch});
const good = {primary_worker: 'codex', claude_enabled: false, codex_enabled: true, takeover_minutes: 120};
const req = (method = 'GET', body, headers = {}) => new Request('https://example.com/alur/api/machines-settings', {method,
  headers: {cookie: 'alur_access=user-a', origin: 'https://example.com', 'content-type': 'application/json', ...headers},
  ...(method === 'GET' ? {} : {body: typeof body === 'string' ? body : JSON.stringify(body)})});
const call = request => onRequest({request});
const bomb = () => {throw new Error('Unexpected fetch');};

test('settings require login, same origin, JSON and exact valid fields before any network call', async t => {
  t.mock.method(globalThis, 'fetch', bomb);
  assert.equal((await call(req('GET', undefined, {cookie: ''}))).status, 401);
  assert.equal((await call(req('DELETE', '{}'))).status, 405);
  assert.equal((await call(req('POST', good, {origin: 'https://evil.example'}))).status, 403);
  assert.equal((await call(req('POST', good, {'content-type': 'text/plain'}))).status, 415);
  assert.equal((await call(req('POST', '{broken'))).status, 400);
  for (const body of [{...good, primary_worker: 'gemini'}, {...good, takeover_minutes: 14}, {...good, takeover_minutes: 1441},
    {...good, takeover_minutes: 60.5}, {...good, claude_enabled: 'false'}, {...good, updated_at: 'x'}, {primary_worker: 'codex'}]) {
    assert.equal((await call(req('POST', body))).status, 400);
  }
});

test('settings read and save call the owner RPCs and keep a safe envelope', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({url, options}); return Response.json(view({owner_secret: 'x'})); });
  const got = await call(req('GET'));
  assert.equal(got.status, 200); const body = await got.json();
  assert.equal(body.settings.primary_worker, 'claude'); assert.equal('owner_secret' in body, false);
  assert.match(calls[0].url, /rpc\/alur_get_production_settings$/);
  const saved = await call(req('POST', good));
  assert.equal(saved.status, 200);
  assert.match(calls[1].url, /rpc\/alur_save_production_settings$/);
  assert.deepEqual(JSON.parse(calls[1].options.body), {p_primary: 'codex', p_claude: false, p_codex: true, p_takeover: 120});
  t.mock.method(globalThis, 'fetch', async () => Response.json(view({settings: {...view().settings, primary_worker: 'gemini'}})));
  assert.equal((await call(req('GET'))).status, 503);
  t.mock.method(globalThis, 'fetch', async () => Response.json({message: 'no'}, {status: 403}));
  assert.equal((await call(req('GET'))).status, 403);
});
