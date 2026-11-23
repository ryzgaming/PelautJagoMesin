import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';

const bundled = await build({entryPoints: ['functions/alur/api/machines.ts'], bundle: true,
  format: 'esm', platform: 'browser', write: false, logLevel: 'silent'});
const {onRequest} = await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const owner = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const previousId = '44444444-4444-4444-8444-444444444444';
const base = (patch = {}) => ({id: sessionId, request_id: requestId, brand: 'YANMAR', model: '6AYM-WET',
  machine_key: '["yanmar", "6aym-wet"]', status: 'queued', created_at: '2026-11-23T12:00:00Z',
  updated_at: '2026-11-23T12:00:00Z', result_url: null, source_leads: null, ...patch});
const checkpoint = (patch = {}) => ({session_id: sessionId, role: 'fuel', revision: 1, summary: 'Fixture: routing needs confirmation.',
  sources: [{id: 's1', title: 'Synthetic fixture', url: 'https://www.yanmar.com/example', locator: 'fixture page', evidence_status: 'OBSERVED'}],
  decisions: [{text: 'Retain uncertainty.', evidence_status: 'UNKNOWN', source_ids: ['s1']}],
  open_questions: ['Which exact variant?'], status: 'UNVERIFIED', written_at: '2026-11-23T12:01:00Z', ...patch});
const detail = (patch = {}) => ({account_id: owner, session: base(), memory: [checkpoint()],
  previous_sessions: [base({id: previousId, status: 'review'})], canonical_memory: [],
  previous_memory: [checkpoint({session_id: previousId})], ...patch});
const req = (method = 'GET', options = {}) => new Request('https://example.com/alur/api/machines'+(options.query || ''), {
  method, headers: {cookie: 'alur_access=user-a', origin: 'https://example.com', 'content-type': 'application/json', ...options.headers},
  ...(method === 'GET' ? {} : {body: options.raw ?? JSON.stringify(options.body ?? {brand: 'YANMAR', model: '6AYM-WET', request_id: requestId})}),
});
const call = (request, context = {}) => onRequest({request, ...context});
const bomb = () => {throw new Error('Unexpected fetch');};

test('machines authentication, methods and CSRF fail before network', async t => {
  t.mock.method(globalThis, 'fetch', bomb);
  for (const method of ['GET', 'POST']) assert.equal((await call(req(method, {headers: {cookie: 'alur_refresh=only'}}))).status, 401);
  assert.equal((await call(req('DELETE'))).status, 405);
  for (const origin of ['', 'https://evil.example']) assert.equal((await call(req('POST', {headers: {origin}}))).status, 403);
});

test('machines input rejects owner/command injection, invalid identifiers and oversized requests', async t => {
  t.mock.method(globalThis, 'fetch', bomb);
  for (const body of [null, [], {}, {brand: '', model: 'M', request_id: requestId},
    {brand: 'A'.repeat(81), model: 'M', request_id: requestId}, {brand: 'A', model: 'M'.repeat(121), request_id: requestId},
    {brand: 'A', model: 'M', request_id: 'bad'}, {brand: 'A', model: 'M', request_id: requestId, owner_id: owner},
    {brand: 'A', model: 'M', request_id: requestId, command: 'arbitrary'}]) {
    assert.equal((await call(req('POST', {raw: JSON.stringify(body)}))).status, 400);
  }
  assert.equal((await call(req('POST', {raw: '{broken'}))).status, 400);
  assert.equal((await call(req('POST', {raw: 'x'.repeat(4097)}))).status, 413);
  assert.equal((await call(req('POST', {headers: {'content-type': 'text/plain'}}))).status, 415);
  for (const id of ['', 'other-account', 'id&owner_id=other']) assert.equal((await call(req('GET', {query: '?id='+encodeURIComponent(id)}))).status, 400);
});

test('machines POST normalizes names and preserves idempotency ID and safe session projection', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({url, options}); return Response.json(base({owner_id: owner, private_log: 'hidden'}));
  });
  for (let i = 0; i < 2; i++) {
    const response = await call(req('POST', {body: {brand: '  YANMAR ', model: ' 6AYM-WET ', request_id: requestId}}));
    assert.equal(response.status, 202); assert.deepEqual(await response.json(), {session: base()});
  }
  for (const {url, options} of calls) {
    assert.equal(new URL(url).pathname, '/rest/v1/rpc/alur_enqueue_machine_session');
    assert.equal(options.method, 'POST'); assert.equal(options.headers.Authorization, 'Bearer user-a');
    assert.match(options.headers.apikey, /^sb_publishable_/);
    assert.deepEqual(JSON.parse(options.body), {p_brand: 'YANMAR', p_model: '6AYM-WET', p_request_id: requestId});
  }
});

test('machines GET lists bounded own sessions and GET detail preserves separate memory classes', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (address, options) => {
    calls.push({address: new URL(address), options});
    return Response.json(address.includes('alur_get_machine_session') ? detail() : {account_id: owner, sessions: [base()], private: 'hidden'});
  });
  const list = await call(req('GET', {query: '?owner_id=other&select=*'}));
  assert.deepEqual(await list.json(), {account_id: owner, sessions: [base()]});
  assert.equal(list.headers.get('cache-control'), 'private, no-store'); assert.equal(list.headers.get('vary'), 'Cookie');
  const result = await call(req('GET', {query: '?id='+sessionId}));
  assert.deepEqual(await result.json(), detail());
  assert.equal(calls[0].address.pathname, '/rest/v1/rpc/alur_list_machine_sessions');
  assert.equal(calls[0].address.search, '');
  assert.equal(calls[1].address.searchParams.get('p_session_id'), sessionId);
  assert.equal(calls[1].options.method, 'GET');
});

test('machines reject unsafe result links but retain source links to external HTTPS evidence', async t => {
  const unsafe = ['javascript:alert(1)', 'data:text/html,abc', '//a.violetblackbird16.chatgpt.site',
    'https://a.violetblackbird16.chatgpt.site.evil.test/', 'https://violetblackbird16.chatgpt.site/',
    'https://a.b.violetblackbird16.chatgpt.site/', 'https://user@a.violetblackbird16.chatgpt.site/',
    'https://a.violetblackbird16.chatgpt.site:443/', 'https://a.violetblackbird16.chatgpt.site/?secret=x',
    'https://a.violetblackbird16.chatgpt.site/#fragment', 'http://a.violetblackbird16.chatgpt.site/', 'https://evil.test/'];
  for (const result_url of unsafe) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({account_id: owner, sessions: [base({result_url})]}));
    const response = await call(req()); assert.equal(response.status, 200);
    assert.equal((await response.json()).sessions[0].result_url, null); mock.mock.restore();
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json(detail({session: base({result_url: 'https://machine-1.violetblackbird16.chatgpt.site/review'})})));
  const data = await (await call(req('GET', {query: '?id='+sessionId}))).json();
  assert.equal(data.session.result_url, 'https://machine-1.violetblackbird16.chatgpt.site/review');
  assert.equal(data.memory[0].sources[0].url, 'https://www.yanmar.com/example');
});

test('machines preserve source discovery status and remove private source fields', async t => {
  const source_leads = {provider: 'Internet Archive', status: 'found', items: [{title: 'Candidate only', url: 'https://archive.org/details/test'}]};
  t.mock.method(globalThis, 'fetch', async () => Response.json({account_id: owner,
    sessions: [base({source_leads: {...source_leads, secret: 'hidden'}})]}));
  assert.deepEqual((await (await call(req())).json()).sessions[0].source_leads, source_leads);
});

test('machines contract rejects mixed-machine history and promoted unknown canonical memory', async t => {
  for (const data of [detail({previous_sessions: [base({id: previousId, machine_key: 'other'})]}),
    detail({memory: [checkpoint({session_id: previousId})]}), detail({canonical_memory: [checkpoint({session_id: previousId})]}),
    {account_id: owner, sessions: Array.from({length: 51}, () => base())}]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(data));
    assert.equal((await call(req('GET', {query: 'session' in data ? '?id='+sessionId : ''}))).status, 503); mock.mock.restore();
  }
});

test('machines owner errors, missing details and expired tokens reveal no upstream payload', async t => {
  for (const [upstream, method, query, expected] of [[401,'GET','',401], [403,'GET','?id='+sessionId,404],
    [403,'POST','',403], [409,'POST','',409], [400,'POST','',400], [500,'GET','',503]]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response('private SQL and token', {status: upstream}));
    const response = await call(req(method, {query})); assert.equal(response.status, expected);
    assert(!JSON.stringify(await response.json()).includes('private')); mock.mock.restore();
  }
});

test('machines schedules source discovery only after successful queued enqueue without leads', async t => {
  const calls = [], background = [];
  t.mock.method(globalThis, 'fetch', async (address, options) => {
    const target = String(address); calls.push(target);
    if (target.includes('alur_enqueue_machine_session')) return Response.json(base());
    if (target.startsWith('https://archive.org/')) { assert.equal(options.headers, undefined); return Response.json({response: {docs: []}}); }
    if (target.includes('alur_save_source_leads')) return Response.json(null);
    throw new Error('Unexpected URL');
  });
  const response = await call(req('POST'), {waitUntil(promise) {background.push(promise);}});
  assert.equal(response.status, 202); assert.equal(background.length, 1);
  await Promise.all(background);
  assert(calls[0].includes('alur_enqueue_machine_session'));
  assert(calls[1].startsWith('https://archive.org/')); assert(calls[2].includes('alur_save_source_leads'));
});

test('machines does not discover on failed enqueue, existing leads, running sessions or GET', async t => {
  const scenarios = [[new Response('', {status: 403}), 'POST'], [Response.json(base({status: 'running'})), 'POST'],
    [Response.json(base({source_leads: {provider: 'Internet Archive', status: 'empty', items: []}})), 'POST'],
    [Response.json({account_id: owner, sessions: [base()]}), 'GET']];
  for (const [upstream, method] of scenarios) {
    let scheduled = 0;
    const mock = t.mock.method(globalThis, 'fetch', async () => upstream);
    await call(req(method), {waitUntil() {scheduled++;}}); assert.equal(scheduled, 0); mock.mock.restore();
  }
});

test('machines API consumes real SQL, isolates owners and recalls only matching machine checkpoints', async t => {
  const {PGlite} = await import('@electric-sql/pglite');
  const db = new PGlite(); t.after(() => db.close());
  const other = '55555555-5555-4555-8555-555555555555';
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    create table public.admins(user_id uuid primary key references auth.users(id));`);
  await db.query('insert into auth.users values($1),($2)', [owner, other]);
  await db.query('insert into public.admins values($1)', [owner]);
  await db.exec(await readFile('apps/alur-workflow/supabase/machine-sessions.sql', 'utf8'));
  t.mock.method(globalThis, 'fetch', async (address, options) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [options.headers.Authorization === 'Bearer user-b' ? other : owner]);
    await db.exec('set role authenticated');
    const target = new URL(address);
    try {
      let result;
      if (target.pathname.endsWith('alur_enqueue_machine_session')) {
        const body = JSON.parse(options.body);
        result = await db.query('select public.alur_enqueue_machine_session($1,$2,$3) as value', [body.p_brand, body.p_model, body.p_request_id]);
      } else if (target.pathname.endsWith('alur_list_machine_sessions')) {
        result = await db.query('select public.alur_list_machine_sessions() as value');
      } else if (target.pathname.endsWith('alur_get_machine_session')) {
        result = await db.query('select public.alur_get_machine_session($1) as value', [target.searchParams.get('p_session_id')]);
      } else throw new Error('Unexpected RPC');
      return Response.json(result.rows[0].value);
    } catch (error) {
      return Response.json({private: error.message}, {status: error.code === '42501' ? 403 : error.code === '23505' ? 409 : 400});
    }
  });
  const created = await call(req('POST')); assert.equal(created.status, 202);
  const first = (await created.json()).session;
  assert.equal((await (await call(req('POST'))).json()).session.id, first.id);
  const otherRequest = req('GET', {headers: {cookie: 'alur_access=user-b'}});
  assert.deepEqual(await (await call(otherRequest)).json(), {account_id: other, sessions: []});
  assert.equal((await call(req('GET', {query: '?id='+first.id, headers: {cookie: 'alur_access=user-b'}}))).status, 404);
  assert.equal((await call(req('POST', {headers: {cookie: 'alur_access=user-b'}}))).status, 403);

  await db.exec('reset role');
  const claim = '66666666-6666-4666-8666-666666666666';
  await db.query('select alur_machine_private.claim_session($1,$2)', [owner, claim]);
  const checkpointData = checkpoint();
  await db.query('select alur_machine_private.write_checkpoint($1,$2,$3,$4,$5,$6,$7,$8)',
    [first.id, claim, 'fuel', checkpointData.summary, JSON.stringify(checkpointData.sources),
      JSON.stringify(checkpointData.decisions), JSON.stringify(checkpointData.open_questions), 'UNVERIFIED']);
  await db.query('select alur_machine_private.write_checkpoint($1,$2,$3,$4,$5,$6,$7,$8)',
    [first.id, claim, 'fuel', 'Updated fixture gap', JSON.stringify(checkpointData.sources),
      JSON.stringify(checkpointData.decisions), JSON.stringify(['Updated question']), 'UNVERIFIED']);
  await db.query('select alur_machine_private.finish_session($1,$2,$3)', [first.id, claim, 'needs_evidence']);
  const newId = '77777777-7777-4777-8777-777777777777';
  const next = await call(req('POST', {body: {brand: 'YANMAR', model: '6AYM-WET', request_id: newId}}));
  assert.equal(next.status, 202); const current = (await next.json()).session;
  await call(req('POST', {body: {brand: 'MAN', model: 'L23/30H', request_id: '88888888-8888-4888-8888-888888888888'}}));
  const response = await call(req('GET', {query: '?id='+current.id})); assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.account_id, owner);
  assert.equal(data.previous_sessions.length, 1); assert.equal(data.previous_sessions[0].id, first.id);
  assert.equal(data.previous_memory.length, 1); assert.equal(data.previous_memory[0].revision, 2);
  assert.equal(data.previous_memory[0].summary, 'Updated fixture gap');
  assert.deepEqual(data.canonical_memory, []); assert.deepEqual(data.memory, []);
  assert(!JSON.stringify(data).includes('claim_token')); assert(!JSON.stringify(data).includes('owner_id'));
});
