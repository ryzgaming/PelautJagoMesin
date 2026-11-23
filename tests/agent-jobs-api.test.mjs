import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';

// Exercise the same TypeScript entrypoint Cloudflare deploys, without deploying.
const bundle = await build({entryPoints: ['functions/alur/api/agent-jobs.ts'],
  bundle: true, format: 'esm', platform: 'browser', write: false, logLevel: 'silent'});
const {onRequest} = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const roles = ['evidence', 'exterior', 'internals', 'integrator', 'qa', 'fuel', 'freshwater', 'seawater', 'lubrication', 'intake-exhaust'];
const requestId = 'cbf116d8-c6b2-40ae-88e1-0941eb4f8472';
const job = (overrides = {}) => ({id: '36345db6-f8a5-4859-8473-36c86197c734', project_key: 'tanabe-h74',
  request_id: requestId, status: 'queued', created_at: '2026-11-23T12:00:00Z', updated_at: '2026-11-23T12:00:00Z',
  progress: Object.fromEntries(roles.map(role => [role, 'pending'])), note: 'queued', ...overrides});
const req = (method = 'GET', options = {}) => new Request('https://example.com/alur/api/agent-jobs' + (options.query || ''), {
  method, headers: {cookie: 'alur_access=user-a-token', origin: 'https://example.com',
    'content-type': 'application/json', ...options.headers},
  ...(method === 'GET' ? {} : {body: options.raw ?? JSON.stringify(options.body ?? {project_key: 'tanabe-h74', request_id: requestId})}),
});
const call = request => onRequest({request});
const bomb = () => {throw new Error('Unexpected network request');};

test('agent queue requires access cookie and rejects unsupported methods', async t => {
  t.mock.method(globalThis, 'fetch', bomb);
  for (const method of ['GET', 'POST']) {
    const response = await call(req(method, {headers: {cookie: 'alur_refresh=refresh-only'}}));
    assert.equal(response.status, 401);
  }
  const response = await call(req('DELETE'));
  assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET, POST');
});

test('agent queue rejects cross-origin POST and malformed requests before RPC', async t => {
  t.mock.method(globalThis, 'fetch', bomb);
  for (const origin of ['', 'https://evil.example', 'https://example.com.evil.example']) {
    assert.equal((await call(req('POST', {headers: {origin}}))).status, 403);
  }
  const bodies = [null, [], {}, {project_key: 'Bad Key', request_id: requestId},
    {project_key: '../source', request_id: requestId}, {project_key: 'a'.repeat(65), request_id: requestId},
    {project_key: 'x', request_id: 'not-uuid'}, {project_key: 'x', request_id: requestId, owner_id: 'other-user'},
    {project_key: 'x', request_id: requestId, command: 'arbitrary code'}];
  for (const body of bodies) assert.equal((await call(req('POST', {raw: JSON.stringify(body)}))).status, 400);
  assert.equal((await call(req('POST', {raw: '{broken'}))).status, 400);
  assert.equal((await call(req('POST', {raw: 'a'.repeat(2049)}))).status, 413);
  assert.equal((await call(req('POST', {headers: {'content-type': 'text/plain'}}))).status, 415);
});

test('agent queue GET uses owner JWT, explicit safe columns and bounded newest-first list', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({url: new URL(url), options});
    assert.equal(options.headers.Authorization, 'Bearer user-a-token');
    assert.match(options.headers.apikey, /^sb_publishable_/);
    return Response.json([job({owner_id: 'private-owner', claim_token: 'private-token', log: 'private-path',
      progress: {...job().progress, secret: 'private-progress'}})]);
  });
  const response = await call(req('GET', {query: '?limit=5&owner_id=other-user&select=*'}));
  assert.deepEqual(await response.json(), {jobs: [job()]});
  const {url, options} = calls[0];
  assert.equal(url.pathname, '/rest/v1/alur_agent_jobs');
  assert.equal(url.searchParams.get('limit'), '5');
  assert.equal(url.searchParams.get('order'), 'created_at.desc,id.desc');
  assert.equal(url.searchParams.get('select'), 'id,project_key,request_id,status,created_at,updated_at,progress,note');
  assert.equal(url.searchParams.has('owner_id'), false); assert.equal(options.method, 'GET');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Cookie');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('agent queue invalid limits make no upstream calls', async t => {
  t.mock.method(globalThis, 'fetch', bomb);
  for (const limit of ['0', '51', '-1', '1.5', 'Infinity', '', '1e1']) {
    assert.equal((await call(req('GET', {query: '?limit='+encodeURIComponent(limit)}))).status, 400);
  }
});

test('agent queue preserves review_with_gaps without promoting it to ready', async t => {
  const gapJob = job({status: 'review', note: 'review_with_gaps',
    progress: Object.fromEntries(roles.map(role => [role, 'review']))});
  t.mock.method(globalThis, 'fetch', async () => Response.json([gapJob]));
  const response = await call(req());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), {jobs: [gapJob]});
});

test('agent queue forwards separate user tokens without cached cross-user data', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const token = options.headers.Authorization;
    if (token === 'Bearer user-a-token') return Response.json([job()]);
    if (token === 'Bearer user-b-token') return Response.json([]);
    return new Response('private auth details', {status: 401});
  });
  assert.equal((await (await call(req())).json()).jobs.length, 1);
  assert.deepEqual(await (await call(req('GET', {headers: {cookie: 'alur_access=user-b-token'}}))).json(), {jobs: []});
  const expired = await call(req('GET', {headers: {cookie: 'alur_access=expired'}}));
  assert.equal(expired.status, 401); assert(!JSON.stringify(await expired.json()).includes('private'));
});

test('agent queue POST invokes only enqueue RPC with idempotency ID and returns safe object', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({url, options});
    return Response.json(job({owner_id: 'private-owner', claim_token: 'private-lease'}));
  });
  for (let retry = 0; retry < 2; retry++) {
    const response = await call(req('POST'));
    assert.equal(response.status, 202); assert.deepEqual(await response.json(), {job: job()});
  }
  for (const {url, options} of calls) {
    assert.equal(new URL(url).pathname, '/rest/v1/rpc/alur_enqueue_agent_job');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer user-a-token');
    assert.deepEqual(JSON.parse(options.body), {p_project_key: 'tanabe-h74', p_request_id: requestId});
  }
});

test('agent queue sanitizes upstream errors, conflicts and network failures', async t => {
  for (const [upstream, expected] of [[400,400], [401,401], [403,403], [409,409], [404,503], [500,503]]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response('secret database path/token', {status: upstream}));
    const response = await call(req('POST')); assert.equal(response.status, expected);
    assert(!JSON.stringify(await response.json()).includes('secret')); mock.mock.restore();
  }
  t.mock.method(globalThis, 'fetch', async () => {throw new Error('secret network token');});
  const response = await call(req()); assert.equal(response.status, 503);
  assert(!JSON.stringify(await response.json()).includes('secret'));
});

test('agent queue rejects invalid database output instead of exposing arbitrary notes', async t => {
  for (const value of [null, {status: 'queued'}, [job()], job({note: '/private/path'}), job({progress: {fuel: 'pending'}})]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(value));
    assert.equal((await call(req('POST'))).status, 503); mock.mock.restore();
  }
});

test('agent API consumes actual compiled SQL JSON return and owner-isolated rows', async t => {
  const {PGlite} = await import('@electric-sql/pglite');
  const db = new PGlite();
  t.after(() => db.close());
  const ownerA = '11111111-1111-4111-8111-111111111111';
  const ownerB = '22222222-2222-4222-8222-222222222222';
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;`);
  await db.query('insert into auth.users values ($1),($2)', [ownerA, ownerB]);
  await db.exec(await readFile('apps/alur-workflow/supabase/agent-jobs.sql', 'utf8'));
  await db.exec('set role authenticated');
  // This fixture models PostgREST's verified-JWT context, while executing real SQL/RLS.
  t.mock.method(globalThis, 'fetch', async (address, options) => {
    const owner = options.headers.Authorization === 'Bearer user-b-token' ? ownerB : ownerA;
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    if (new URL(address).pathname.endsWith('/rpc/alur_enqueue_agent_job')) {
      const args = JSON.parse(options.body);
      const result = await db.query('select public.alur_enqueue_agent_job($1,$2) as job', [args.p_project_key, args.p_request_id]);
      return Response.json(result.rows[0].job);
    }
    const result = await db.query('select id,project_key,request_id,status,created_at,updated_at,progress,note from public.alur_agent_jobs order by created_at desc limit 20');
    return Response.json(result.rows);
  });
  const queued = await call(req('POST'));
  assert.equal(queued.status, 202);
  const first = (await queued.json()).job;
  assert.equal(first.project_key, 'tanabe-h74'); assert.equal(first.status, 'queued');
  assert.equal(Object.keys(first.progress).length, 10);
  assert.equal('owner_id' in first, false); assert.equal('claim_token' in first, false);
  const repeated = await call(req('POST'));
  assert.equal((await repeated.json()).job.id, first.id);
  const otherUser = await call(req('GET', {headers: {cookie: 'alur_access=user-b-token'}}));
  assert.deepEqual(await otherUser.json(), {jobs: []});
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ownerA]);
  const claim = '44444444-4444-4444-8444-444444444444';
  await db.query('select public.alur_claim_agent_job($1,$2)', ['tanabe-h74', claim]);
  await db.query('select public.alur_update_agent_job($1,$2,$3,$4,$5)',
    [first.id, claim, 'review', JSON.stringify(Object.fromEntries(roles.map(role => [role, 'review']))), 'review_with_gaps']);
  const reviewed = await call(req()); assert.equal(reviewed.status, 200);
  const [row] = (await reviewed.json()).jobs;
  assert.equal(row.id, first.id); assert.equal(row.note, 'review_with_gaps');
});
