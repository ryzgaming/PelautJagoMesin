import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const bundled = await build({entryPoints: ['functions/alur/api/machines-activity.ts'], bundle: true,
  format: 'esm', platform: 'browser', write: false, logLevel: 'silent'});
const {onRequest} = await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const id = '61111111-1111-4111-8111-111111111111';
const req = (query = `?id=${id}&after=0`, headers = {}, method = 'GET') => new Request('https://example.com/alur/api/machines-activity' + query,
  {method, headers: {cookie: 'alur_access=user-a', ...headers}});
const call = request => onRequest({request});
const item = (patch = {}) => ({id: 7, at: '2026-11-26T10:00:00Z', worker: 'claude', kind: 'open', message: 'Membuka halaman produk',
  url: 'https://www.cat.com/3512c', ...patch});

test('activity needs login, GET, a session uuid and numeric cursor before any network call', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected fetch'); });
  assert.equal((await call(req(undefined, {cookie: ''}))).status, 401);
  assert.equal((await call(req(undefined, {}, 'POST'))).status, 405);
  for (const q of ['', '?id=x', `?id=${id}&after=-1`, `?id=${id}&after=1e3`, `?id=${id}&after=9999999999999999`])
    assert.equal((await call(req(q))).status, 400);
});

test('activity calls the owner RPC and returns only validated rows with https links', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({url, options});
    return Response.json({session_id: id, secret: 'x', items: [item({claim_token: 'leak'}), item({id: 6, kind: 'search', url: 'javascript:alert(1)'}), item({id: 5, url: null})]}); });
  const res = await call(req(`?id=${id}&after=4`));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(calls[0].url, /rpc\/alur_get_machine_activity$/);
  assert.deepEqual(JSON.parse(calls[0].options.body), {p_session_id: id, p_after: 4});
  assert.equal('secret' in body, false); assert.equal('claim_token' in body.items[0], false);
  assert.equal(body.items[0].url, 'https://www.cat.com/3512c'); assert.equal(body.items[1].url, null);
});

test('activity rejects malformed database replies and maps errors', async t => {
  for (const bad of [{session_id: id, items: [item({kind: 'shell'})]}, {session_id: id, items: [item({message: 'x'.repeat(201)})]},
    {session_id: '71111111-1111-4111-8111-111111111111', items: []}, {session_id: id, items: [item({worker: 'gemini'})]}]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(bad));
    assert.equal((await call(req())).status, 503);
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('', {status: 401}));
  assert.equal((await call(req())).status, 401);
  t.mock.method(globalThis, 'fetch', async () => new Response('', {status: 403}));
  assert.equal((await call(req())).status, 403);
});
