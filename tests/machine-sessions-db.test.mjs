import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
let db;
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',stranger='33333333-3333-4333-8333-333333333333';
const roles=['evidence','exterior','internals','integrator','qa','fuel','freshwater','seawater','lubrication','intake-exhaust'];
const migration=await readFile(new URL('../apps/alur-workflow/supabase/machine-sessions.sql',import.meta.url),'utf8');
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const as=async(id,fn)=>{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}};
const enqueue=(brand='YANMAR',model='6AYM-WET',request=randomUUID())=>scalar('select public.alur_enqueue_machine_session($1,$2,$3)',[brand,model,request]);
const create=(id=owner,brand='YANMAR',model='6AYM-WET')=>as(id,()=>enqueue(brand,model));
const claim=(id=owner,token=randomUUID(),seconds=900)=>scalar('select alur_machine_private.claim_session($1,$2,$3)',[id,token,seconds]);
const finish=(s,t,status='review',url='https://yanmar-review.violetblackbird16.chatgpt.site/review')=>scalar('select alur_machine_private.finish_session($1,$2,$3,$4)',[s,t,status,url]);
const documented={summary:'Known manufacturer fact',sources:[{id:'manual',title:'Official manual',url:'https://manufacturer.example/manual.pdf',locator:'Page 3',evidence_status:'DOCUMENTED'}],decisions:[{text:'Preserve sourced fact',evidence_status:'DOCUMENTED',source_ids:['manual']}],open_questions:[],status:'DOCUMENTED'};
const unverified={summary:'Missing drawing; geometry remains unknown',sources:[],decisions:[{text:'Do not infer dimensions',evidence_status:'UNKNOWN',source_ids:[]}],open_questions:['Obtain exact variant drawing'],status:'UNVERIFIED'};
const checkpoint=(s,t,role='evidence',m=documented)=>scalar('select alur_machine_private.write_checkpoint($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8)',[s,t,role,m.summary,JSON.stringify(m.sources),JSON.stringify(m.decisions),JSON.stringify(m.open_questions),m.status]);
const complete=async(id=owner,brand='YANMAR',model='6AYM-WET',m=documented)=>{const s=await create(id,brand,model),c=await claim(id);for(const role of roles)await checkpoint(s.id,c.claim_token,role,m);return {session:await finish(s.id,c.claim_token),token:c.claim_token};};
const detail=id=>scalar('select public.alur_get_machine_session($1)',[id]);
const leads={provider:'Internet Archive',status:'found',items:[{url:'https://archive.org/details/yanmar-manual-6aym',title:'Unverified search candidate'}]};

before(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table public.admins(user_id uuid primary key references auth.users(id));alter table public.admins enable row level security;revoke all on public.admins from public,anon,authenticated;`);
 await db.query('insert into auth.users values($1),($2),($3)',[owner,other,stranger]);await db.query('insert into public.admins values($1),($2)',[owner,other]);await db.exec('create table public.profiles(id uuid primary key, blocked boolean default false); insert into public.profiles(id) select id from auth.users');
  await db.exec(await readFile('apps/alur-workflow/supabase/admin-access.sql','utf8'));
  await db.exec(migration);
});
beforeEach(async()=>{await db.exec('reset role;truncate public.alur_machine_sessions cascade;');});
after(async()=>{await db.close();});

test('machine migration applies twice; browser can read own metadata but has no raw/worker write permissions',async()=>{
 await db.exec(migration);
 for(const table of ['public.alur_machine_sessions','public.alur_machine_memory'])for(const p of ['INSERT','UPDATE','DELETE'])assert.equal(await scalar("select has_table_privilege('authenticated',$1,$2)",[table,p]),false);
 assert.equal(await scalar("select has_function_privilege('authenticated','alur_machine_private.claim_session(uuid,uuid,integer)','EXECUTE')"),false);
 assert.equal(await scalar("select has_function_privilege('service_role','alur_machine_private.claim_session(uuid,uuid,integer)','EXECUTE')"),false);
 assert.equal(await scalar("select has_table_privilege('authenticated','alur_machine_private.leases','SELECT')"),false);
});

test('only admin owner may enqueue; missing login and anonymous calls fail closed',async()=>{
 await as(stranger,()=>assert.rejects(enqueue(),/Owner access required/));await as(null,()=>assert.rejects(enqueue(),/Owner access required/));
 await db.exec('set role anon');try{await assert.rejects(enqueue(),/permission denied/);}finally{await db.exec('reset role');}
 const s=await create();assert.equal(s.status,'queued');assert.equal(s.result_url,null);assert.equal(s.source_leads,null);assert.equal('owner_id' in s,false);
});

test('identity normalization, idempotency and exact sibling separation work',async()=>{
 await as(owner,async()=>{
  const request=randomUUID(),s=await enqueue('\t YANMAR\n','\n 6AYM-WET \t',request);
  assert.equal(s.brand,'YANMAR');assert.equal(s.model,'6AYM-WET');assert.deepEqual(JSON.parse(s.machine_key),['yanmar','6aym-wet']);
  assert.equal((await enqueue('yanmar','6aym-wet',request)).id,s.id);
  await assert.rejects(enqueue('YANMAR','6AYM-WET'),/active session/);
  await assert.rejects(enqueue('YANMAR','6AYM WET',request),/identity mismatch/);
  assert.notEqual((await enqueue('YANMAR','6AYM WET')).id,s.id);
  for(const [brand,model]of [[null,'x'],['x',null],['','x'],['\t\n','x'],['x','\t\n'],['a'.repeat(81),'x'],['x','x'.repeat(121)]])await assert.rejects(enqueue(brand,model),/Invalid machine identity/);
 });
});

test('source leads first-write-only are unverified, bounded, owner-isolated, and included in claim',async()=>{
 const s=await create();
 await as(other,()=>assert.rejects(scalar('select public.alur_save_source_leads($1,$2::jsonb)',[s.id,JSON.stringify(leads)]),/unavailable/));
 await as(owner,async()=>{
  for(const bad of [null,{},[],{...leads,raw:'/tmp/manual.pdf'},{...leads,items:Array(5).fill(leads.items[0])},{...leads,items:[{url:'https://archive.org/details/..',title:'bad'}]},{...leads,items:[{url:'https://archive.org/details/.',title:'bad'}]},{...leads,items:[{url:'https://archive.org.evil.test/details/x',title:'bad'}]},{...leads,items:[{url:'file:///tmp/manual.pdf',title:'bad'}]}])await assert.rejects(scalar('select public.alur_save_source_leads($1,$2::jsonb)',[s.id,JSON.stringify(bad)]),/Invalid source leads/);
  const first=await scalar('select public.alur_save_source_leads($1,$2::jsonb)',[s.id,JSON.stringify(leads)]);assert.deepEqual(first.source_leads,leads);
  assert.deepEqual(await scalar('select public.alur_save_source_leads($1,$2::jsonb)',[s.id,JSON.stringify(leads)]),first);
  await assert.rejects(scalar('select public.alur_save_source_leads($1,$2::jsonb)',[s.id,JSON.stringify({...leads,items:[{...leads.items[0],title:'changed'}]})]),/already recorded/);
 });
 assert.deepEqual((await claim()).session.source_leads,leads);
});

test('lease claim retries are stable, heartbeat renews, and expired recovery rejects stale writes',async()=>{
 const s=await create(),token=randomUUID(),c=await claim(owner,token);assert.equal(c.session.id,s.id);assert.deepEqual(await claim(owner,token),c);assert.equal(await claim(owner),null);
 const heartbeat=await scalar('select alur_machine_private.heartbeat_session($1,$2,$3)',[s.id,token,1000]);assert.ok(Date.parse(heartbeat.lease_expires_at)>=Date.parse(c.lease_expires_at));
 await db.query("update alur_machine_private.leases set expires_at=now()-interval '1 second' where claim_token=$1",[token]);
 await assert.rejects(checkpoint(s.id,token),/Lease lost/);await assert.rejects(scalar('select alur_machine_private.heartbeat_session($1,$2)',[s.id,token]),/Lease lost/);
 await assert.rejects(claim(owner,token),/expired or already used/);
 const recovered=await claim();assert.equal(recovered.session.id,s.id);assert.notEqual(recovered.claim_token,token);
 await assert.rejects(checkpoint(s.id,token),/Lease lost/);assert.equal((await checkpoint(s.id,recovered.claim_token)).revision,1);
});

test('early checkpoints append per-role revisions; identical network retry is idempotent',async()=>{
 const s=await create(),c=await claim();const first=await checkpoint(s.id,c.claim_token);assert.equal(first.revision,1);
 assert.deepEqual(await checkpoint(s.id,c.claim_token),first);
 const next=await checkpoint(s.id,c.claim_token,'evidence',unverified);assert.equal(next.revision,2);
 assert.equal(await scalar('select count(*)::int from public.alur_machine_memory where session_id=$1',[s.id]),2);
 const visible=await as(owner,()=>detail(s.id));assert.equal(visible.memory[0].revision,2);assert.equal(visible.memory[0].status,'UNVERIFIED');
 assert.equal(await scalar('select summary from public.alur_machine_memory where session_id=$1 and revision=1',[s.id]),documented.summary);
});

test('structured memory rejects fabricated documented facts and local source URLs',async()=>{
 const s=await create(),c=await claim();
 for(const bad of [{...documented,sources:[]},{...documented,open_questions:['unknown']},{...documented,decisions:[{text:'Estimate',evidence_status:'ESTIMATED',source_ids:[]}]},{...documented,sources:[{...documented.sources[0],url:'file:///secret/manual.pdf'}]},{...documented,decisions:[{...documented.decisions[0],source_ids:['missing-source']}]},{...unverified,open_questions:[]},{...documented,sources:null},{...documented,summary:''}])await assert.rejects(checkpoint(s.id,c.claim_token,'evidence',bad),/Invalid structured checkpoint/);
 assert.equal((await checkpoint(s.id,c.claim_token,'evidence',unverified)).status,'UNVERIFIED');
});

test('review requires all ten roles and strictly tenant scoped HTTPS URL',async()=>{
 const s=await create(),c=await claim();await checkpoint(s.id,c.claim_token);
 await assert.rejects(finish(s.id,c.claim_token),/ten roles/);
 for(const role of roles.filter(role=>role!=='evidence'&&role!=='qa'))await checkpoint(s.id,c.claim_token,role);
 await assert.rejects(finish(s.id,c.claim_token),/ten roles/);
 await checkpoint(s.id,c.claim_token,'qa');
 for(const url of [null,'https://other.chatgpt.site','https://tenant.violetblackbird16.chatgpt.site.evil.test','http://x.violetblackbird16.chatgpt.site','https://name:pw@x.violetblackbird16.chatgpt.site','https://x.violetblackbird16.chatgpt.site:443','https://x.violetblackbird16.chatgpt.site/?secret=x','file:///tmp/review.html'])await assert.rejects(finish(s.id,c.claim_token,'review',url),/private review URL/);
 const done=await finish(s.id,c.claim_token);assert.equal(done.status,'review');assert.deepEqual(await finish(s.id,c.claim_token),done);
 await assert.rejects(checkpoint(s.id,c.claim_token),/Lease lost/);await assert.rejects(finish(s.id,c.claim_token,'failed',null),/Lease lost/);
 await as(owner,()=>assert.rejects(scalar('select public.alur_save_source_leads($1,$2::jsonb)',[s.id,JSON.stringify(leads)]),/immutable/));
});

test('needs_evidence saves missing evidence and retry creates a new immutable session',async()=>{
 const s=await create(),c=await claim();await assert.rejects(finish(s.id,c.claim_token,'needs_evidence',null),/open question/);
 await checkpoint(s.id,c.claim_token,'evidence',unverified);await finish(s.id,c.claim_token,'needs_evidence',null);
 const retry=await create();assert.notEqual(retry.id,s.id);
 const view=await as(owner,()=>detail(retry.id));assert.equal(view.previous_memory[0].status,'UNVERIFIED');assert.deepEqual(view.previous_memory[0].open_questions,unverified.open_questions);
 await assert.rejects(checkpoint(s.id,c.claim_token),/Lease lost/);
});

test('canonical completed facts survive later estimates; no account or sibling machine memory leaks',async()=>{
 const first=await complete();await complete(other,'YANMAR','6AYM-WET',{...documented,summary:'OTHER ACCOUNT SECRET'});
 await complete(owner,'YANMAR','6AYM WET',{...documented,summary:'SIBLING MODEL SECRET'});
 const revision=await create(),c=await claim();assert.equal(c.session.id,revision.id);
 await checkpoint(revision.id,c.claim_token,'evidence',unverified);await finish(revision.id,c.claim_token,'needs_evidence',null);
 const current=await create(owner,'yanmar','6aym-wet');const view=await as(owner,()=>detail(current.id));
 assert.equal(view.account_id,owner);assert.equal(view.canonical_memory.length,10);assert.ok(view.canonical_memory.every(m=>m.session_id===first.session.id));
 assert.equal(view.previous_memory.find(m=>m.role==='evidence').session_id,revision.id);
 assert.equal(JSON.stringify(view).includes('SECRET'),false);assert.equal(view.previous_sessions.length,2);
 assert.deepEqual(await scalar('select alur_machine_private.read_prior_memory($1)',[current.id]),view);
 const prior=await as(owner,()=>detail(first.session.id));assert.equal(prior.previous_memory.length,0);assert.equal(prior.previous_sessions.length,0);
});

test('read RPC and direct memory RLS are isolated even when machine names match',async()=>{
 const s=await create(),c=await claim();await checkpoint(s.id,c.claim_token);
 await as(other,async()=>{assert.equal(await scalar('select count(*)::int from public.alur_machine_memory'),0);assert.equal(await scalar('select count(*)::int from public.alur_machine_sessions'),0);await assert.rejects(detail(s.id),/unavailable/);const list=await scalar('select public.alur_list_machine_sessions()');assert.equal(list.account_id,other);assert.deepEqual(list.sessions,[]);});
 await as(owner,async()=>{assert.equal(await scalar('select count(*)::int from public.alur_machine_memory'),1);await assert.rejects(db.query("update public.alur_machine_memory set summary='overwrite'"),/permission denied/);await assert.rejects(db.query('delete from public.alur_machine_memory'),/permission denied/);await assert.rejects(scalar('select alur_machine_private.claim_session($1,$2)',[owner,randomUUID()]),/permission denied/);await assert.rejects(scalar('select alur_machine_private.read_prior_memory($1)',[s.id]),/permission denied/);});
});

test('worker owner validation and lease bounds reject strangers and malformed calls',async()=>{
 await assert.rejects(claim(stranger),/Owner access required/);await assert.rejects(claim(null),/Owner access required/);
 for(const seconds of [null,0,29,3601])await assert.rejects(claim(owner,randomUUID(),seconds),/Invalid lease/);
 const s=await create(),c=await claim();await assert.rejects(checkpoint(s.id,randomUUID()),/Lease lost/);
 await db.query('delete from public.admins where user_id=$1',[owner]);
 try{await assert.rejects(checkpoint(s.id,c.claim_token),/unavailable/);await as(owner,()=>assert.rejects(enqueue('MAN','L23/30H'),/Owner access required/));await as(owner,()=>assert.rejects(detail(s.id),{code:'42501'}));}finally{await db.query('insert into public.admins values($1)',[owner]);}
});

// Latest per-session checkpoint is authoritative about evidence status: a superseded
// documented draft must not be resurrected by filtering statuses before revisions.
test('canonical memory does not resurrect retracted checkpoint within a reviewed session',async()=>{
 const baseline=await complete();
 const later=await create(),claimLater=await claim();
 for(const role of roles)await checkpoint(later.id,claimLater.claim_token,role,{...documented,summary:'Later draft fact'});
 await checkpoint(later.id,claimLater.claim_token,'evidence',unverified);
 await finish(later.id,claimLater.claim_token);
 const next=await create(),view=await as(owner,()=>detail(next.id));
 assert.equal(view.previous_memory.find(m=>m.role==='evidence').revision,2);
 assert.equal(view.canonical_memory.find(m=>m.role==='evidence').session_id,baseline.session.id);
 assert.equal(view.canonical_memory.find(m=>m.role==='qa').session_id,later.id);
 assert.equal(await scalar('select count(*)::int from public.alur_machine_memory where session_id=$1 and role=$2',[later.id,'evidence']),2);
});

test('catalog revision deduplicates by request and machine, keeps the brief on the worker claim', async () => {
 const request = randomUUID();
 const revise = (product, brief) => scalar('select public.alur_enqueue_machine_revision($1,$2,$3)', [product, brief, request]);
 await as(stranger, () => assert.rejects(revise('tanabe-h74', 'Cek panel'), /access required/));
 await as(owner, () => assert.rejects(revise('unknown', 'Cek panel'), /Invalid revision/));
 await as(owner, () => assert.rejects(revise('tanabe-h74', '   '), /Invalid revision/));
 const session = await as(owner, () => revise('tanabe-h74', 'Cek panel'));
 assert.equal(session.model, 'H-74');
 assert.deepEqual(session, await as(owner, () => revise('tanabe-h74', 'Cek panel')));
 await as(owner, () => assert.rejects(revise('tanabe-h74', 'Cek rakitan'), /mismatch/));
 await as(owner, () => assert.rejects(enqueue('Tanabe','H-74'), /active session/));
 await as(other, () => assert.rejects(detail(session.id), /unavailable/));
 const claimed = await claim();
 assert.equal(claimed.session.id, session.id);
 assert.equal(claimed.session.source_product, 'tanabe-h74');
 assert.equal(claimed.session.revision_brief, 'Cek panel');
});

test('owner deletes own sessions with memory and leases; live agent work and other owners are untouched', async () => {
 const del = ids => scalar('select public.alur_delete_machine_sessions($1::uuid[])', [ids]);
 const {session: done} = await complete(owner, 'MAN', 'L23/30H'), queued = await create();
 const live = await create(owner, 'Tanabe', 'H-74');
 const running = await claim(owner); assert.equal(running.session.id, queued.id); // oldest queued is claimed first
 await checkpoint(running.session.id, running.claim_token, 'fuel', unverified);
 const foreign = await create(other, 'Alfa Laval', 'MAB 206S-24');
 // Stranger (non-admin) and anonymous callers cannot delete.
 await as(stranger, () => assert.rejects(del([done.id]), /Owner access required/));
 await db.exec('set role anon'); try { await assert.rejects(del([done.id]), /permission denied/); } finally { await db.exec('reset role'); }
 for (const bad of [[], Array.from({length: 51}, () => randomUUID()), [done.id, null]])
  await as(owner, () => assert.rejects(del(bad), /Invalid session list/));
 const result = await as(owner, () => del([done.id, live.id, running.session.id, foreign.id, randomUUID()]));
 assert.deepEqual(result.deleted.sort(), [done.id, live.id].sort());
 assert.deepEqual(result.busy, [running.session.id]);
 assert.equal(await scalar('select count(*)::int from public.alur_machine_sessions where id=any($1::uuid[])', [[done.id, live.id]]), 0);
 assert.equal(await scalar('select count(*)::int from public.alur_machine_memory where session_id=$1', [done.id]), 0);
 assert.equal(await scalar('select count(*)::int from public.alur_machine_sessions where id=$1', [foreign.id]), 1);
 // The agent can still finish the busy session; after its lease expires it can be deleted.
 await checkpoint(running.session.id, running.claim_token, 'qa', unverified);
 await db.query('update alur_machine_private.leases set expires_at=clock_timestamp()-interval \'1 second\' where claim_token=$1', [running.claim_token]);
 assert.deepEqual((await as(owner, () => del([running.session.id]))).deleted, [running.session.id]);
 assert.equal(await scalar('select count(*)::int from alur_machine_private.leases where session_id=$1', [running.session.id]), 0);
 await assert.rejects(checkpoint(running.session.id, running.claim_token, 'qa', unverified), /Session unavailable/);
 // A deleted request id can be reused to queue the machine again.
 assert.equal((await as(owner, () => enqueue('MAN', 'L23/30H', done.request_id))).status, 'queued');
});

test('Codex and Claude share the queue: worker is recorded and an expired worker is taken over with its memory', async () => {
 const claimAs = (worker, token = randomUUID()) => scalar('select alur_machine_private.claim_session_as($1,$2,900,$3)', [owner, token, worker]);
 await assert.rejects(claimAs('gemini'), /Invalid worker/);
 await assert.rejects(claimAs(null), /Invalid worker/);
 assert.equal(await claimAs('codex'), null); // empty queue ends the tick
 assert.equal(await scalar("select has_function_privilege('authenticated','alur_machine_private.claim_session_as(uuid,uuid,integer,text)','EXECUTE')"), false);
 const s = await create(owner, 'Caterpillar', '3512C');
 const codex = await claimAs('codex');
 assert.equal(codex.session.id, s.id); assert.equal(codex.session.worker, 'codex');
 assert.equal((await as(owner, () => detail(s.id))).session.worker, 'codex');
 await checkpoint(s.id, codex.claim_token, 'evidence', documented);
 // Codex runs out of tokens: no heartbeat, the lease lapses. Claude takes over the same session.
 assert.equal(await claimAs('claude'), null); // still leased to Codex
 await db.query("update alur_machine_private.leases set expires_at=clock_timestamp()-interval '1 second' where claim_token=$1", [codex.claim_token]);
 const claude = await claimAs('claude');
 assert.equal(claude.session.id, s.id); assert.equal(claude.session.worker, 'claude');
 const history = await scalar('select alur_machine_private.read_prior_memory($1)', [s.id]);
 assert.deepEqual(history.memory.map(m => m.role), ['evidence']); // Claude resumes from Codex's checkpoint
 await assert.rejects(checkpoint(s.id, codex.claim_token, 'fuel', documented), /Lease lost/);
 for (const role of roles.slice(1)) await checkpoint(s.id, claude.claim_token, role, documented);
 await assert.rejects(finish(s.id, claude.claim_token, 'review', 'https://claude.ai/artifact/../x'), /private review URL/);
 const done = await finish(s.id, claude.claim_token, 'review', 'https://claude.ai/artifact/Q1xgxx4NT7hooorJt3G1BB');
 assert.equal(done.status, 'review'); assert.equal(done.result_url, 'https://claude.ai/artifact/Q1xgxx4NT7hooorJt3G1BB');
 // The legacy claim stays valid and clears a stale worker label.
 await create(owner, 'Tanabe', 'H-74');
 assert.equal((await claim(owner)).session.worker, null);
});

test('No waiting turn: any enabled worker takes queued work at once and rescues abandoned work', async () => {
 const claimAs = (worker, token = randomUUID()) => scalar('select alur_machine_private.claim_session_as($1,$2,900,$3)', [owner, token, worker]);
 const expire = token => db.query("update alur_machine_private.leases set expires_at=clock_timestamp()-interval '1 second' where claim_token=$1", [token]);
 await db.exec('truncate alur_machine_private.worker_checkins');
 // No Claude check-in yet (e.g. Claude quota exhausted since setup): Codex may work.
 const first = await create(owner, 'Yanmar', '6AYM-WET');
 const codexFirst = await claimAs('codex'); assert.equal(codexFirst.session.id, first.id);
 // Claude checks in (its claim on an empty-for-it queue still records presence).
 assert.equal(await claimAs('claude'), null);
 assert.equal(await scalar("select count(*)::int from alur_machine_private.worker_checkins where worker='claude'"), 1);
 // Claude is alive and primary, but the backup no longer waits: whoever runs first takes new work.
 const second = await create(owner, 'Caterpillar', '3512C');
 const claude = await claimAs('claude'); assert.equal(claude.session.id, second.id); assert.equal(claude.session.worker, 'claude');
 const third = await create(owner, 'Tanabe', 'H-74');
 const codexThird = await claimAs('codex'); assert.equal(codexThird.session.id, third.id); assert.equal(codexThird.session.worker, 'codex');
 // A live lease still keeps the other worker off the same session.
 assert.equal(await claimAs('codex'), null);
 // Claude stops mid-run (quota ran out): its lease lapses and Codex takes over that session.
 await checkpoint(second.id, claude.claim_token, 'evidence', documented);
 await expire(claude.claim_token);
 const rescue = await claimAs('codex'); assert.equal(rescue.session.id, second.id); assert.equal(rescue.session.worker, 'codex');
 const fourth = await create(owner, 'Shinko', 'GJ 80-25');
 assert.equal((await claimAs('claude')).session.id, fourth.id);
 assert.equal(await claimAs('codex'), null);
 assert.equal(await scalar("select has_table_privilege('authenticated','alur_machine_private.worker_checkins','SELECT')"), false);
});

test('Pengaturan: owner switches primary worker, pauses workers and sets takeover time', async () => {
 const claimAs = (worker, token = randomUUID()) => scalar('select alur_machine_private.claim_session_as($1,$2,900,$3)', [owner, token, worker]);
 const save = (...a) => scalar('select public.alur_save_production_settings($1,$2,$3,$4)', a);
 const get = () => scalar('select public.alur_get_production_settings()');
 await db.exec('truncate alur_machine_private.worker_checkins');
 await as(owner, () => save('claude', true, true, 75));
 await as(stranger, () => assert.rejects(get(), /Owner access required/));
 await as(stranger, () => assert.rejects(save('codex', true, true, 60), /Owner access required/));
 await db.exec('set role anon'); try { await assert.rejects(get(), /permission denied/); } finally { await db.exec('reset role'); }
 for (const bad of [['gemini', true, true, 60], ['codex', null, true, 60], ['codex', true, true, 14], ['codex', true, true, 1441]])
  await as(owner, () => assert.rejects(save(...bad), /Invalid settings/));
 assert.equal(await scalar("select has_table_privilege('authenticated','alur_machine_private.worker_settings','SELECT')"), false);
 // Codex primary: Claude is the backup, but any enabled worker takes queued work at once (no waiting turn).
 let view = await as(owner, () => save('codex', true, true, 30));
 assert.deepEqual([view.settings.primary_worker, view.settings.takeover_minutes], ['codex', 30]);
 const a = await create(owner, 'Yanmar', '6AYM-WET');
 assert.equal((await claimAs('codex')).session.id, a.id);
 const b = await create(owner, 'Tanabe', 'H-74');
 assert.equal((await claimAs('claude')).session.id, b.id);
 assert.equal(await claimAs('claude'), null);
 // Pausing a worker: it gets nothing; pausing the primary lets the backup take queued work at once.
 const c = await create(owner, 'Shinko', 'GJ 80-25');
 await as(owner, () => save('codex', true, false, 30));
 await claimAs('codex'); // check-in only
 assert.equal(await claimAs('codex'), null);
 assert.equal((await claimAs('claude')).session.id, c.id);
 await as(owner, () => save('claude', false, true, 75));
 await create(owner, 'MAN', 'L23/30H');
 assert.equal(await claimAs('claude'), null);
 view = await as(owner, get);
 assert.equal(view.settings.claude_enabled, false); assert.equal(view.primary_alive, false);
 assert.equal(view.queue.queued, 1); assert.equal(view.queue.running, 3);
 assert.equal(view.active.length, 3); assert.ok(view.workers.claude && view.workers.codex);
 assert.equal((await claimAs('codex')).session.brand, 'MAN');
 await as(owner, () => save('claude', true, true, 75));
});

test('aktivitas langsung: hanya pemegang lease menulis, pemilik membaca, aman dan terbatas', async () => {
 const s=await create(),c=await claim(owner);
 const log=(token,kind,message,url=null)=>scalar('select alur_machine_private.log_activity($1,$2,$3,$4,$5)',[s.id,token,kind,message,url]);
 const read=(after=0)=>scalar('select public.alur_get_machine_activity($1,$2)',[s.id,after]);
 const first=await log(c.claim_token,'search','Mencari manual YANMAR 6AYM-WET');
 await log(c.claim_token,'open','Membuka halaman produk','https://www.yanmar.com/marine/6aym');
 for(const [kind,message,url] of [['hack','x',null],['open','',null],['open','x'.repeat(201),null],['open','x','http://insecure.example'],['open','x','javascript:alert(1)'],['open','x','https://a.example/<script>']])
  await assert.rejects(log(c.claim_token,kind,message,url),/Invalid activity/);
 await assert.rejects(log(randomUUID(),'info','Bukan pemegang lease'),/Lease lost/);
 assert.equal(await scalar("select has_function_privilege('authenticated','alur_machine_private.log_activity(uuid,uuid,text,text,text)','EXECUTE')"),false);
 assert.equal(await scalar("select has_table_privilege('authenticated','alur_machine_private.activity','SELECT')"),false);
 await as(owner,async()=>{
  const all=await read();assert.deepEqual(all.items.map(i=>i.kind),['open','search']);assert.equal(all.items[1].message,'Mencari manual YANMAR 6AYM-WET');
  assert.equal(all.items[0].url,'https://www.yanmar.com/marine/6aym');
  assert.deepEqual((await read(first.id)).items.map(i=>i.kind),['open']);
 });
 await as(other,()=>assert.rejects(read(),/Session unavailable/));
 await as(stranger,()=>assert.rejects(read(),/Owner access required/));
 for(let i=0;i<310;i++)await log(c.claim_token,'info','Langkah '+i);
 assert.equal(await scalar('select count(*)::int from alur_machine_private.activity where session_id=$1',[s.id]),300);
 await as(owner,async()=>assert.equal((await read()).items.length,50));
 await db.query('delete from public.alur_machine_sessions where id=$1',[s.id]);
 assert.equal(await scalar('select count(*)::int from alur_machine_private.activity'),0);
});

test('brief bagan: hanya pemilik mengirim, isi privat, dibaca pemegang lease per bagian dengan digest server', async () => {
 const {createHash} = await import('node:crypto');
 const sha = s => createHash('sha256').update(s, 'utf8').digest('hex');
 const tasks = Array.from({length: 1500}, (_, i) => ({task: `Periksa komponen nomor ${i} — kepala silinder ✓ ${'ä'.repeat(20)}`, agents: ['Modeler']}));
 const brief = {version: 1, flow_id: 'f1', flow_name: 'Bagan DRCE', prompt: 'Standar DRCE ' + 'é'.repeat(30000), tasks, rules: ['Jangan menebak dimensi'], unmatched: ['Tugas tanpa agent']};
 const send = (b, request = randomUUID()) => scalar('select public.alur_enqueue_machine_flow($1,$2,$3,$4::jsonb)', ['Caterpillar', '3512C', request, JSON.stringify(b)]);
 await as(stranger, () => assert.rejects(send(brief), /Owner access required/));
 for (const bad of [{...brief, flow_name: '\t'}, {...brief, flow_name: 'x'.repeat(121)}, {...brief, tasks: []}, {...brief, extra: 1}, {...brief, rules: [' ']}])
  await as(owner, () => assert.rejects(send(bad), /Invalid flow brief/));
 const request = randomUUID();
 const s = await as(owner, () => send(brief, request));
 assert.equal('flow_brief' in s, false);
 assert.equal(s.flow_brief_info.flow_name, 'Bagan DRCE'); assert.equal(s.flow_brief_info.tasks, 1500); assert.equal(s.flow_brief_info.rules, 1);
 assert.match(s.flow_brief_info.sha256, /^[0-9a-f]{64}$/); assert.ok(s.flow_brief_info.parts > 1);
 assert.equal((await as(owner, () => send(brief, request))).id, s.id);
 await as(owner, () => assert.rejects(send({...brief, rules: []}, request), /identity mismatch/));
 // Isi brief tidak terjangkau browser, baik lewat tabel maupun fungsi baca.
 assert.equal(await scalar("select has_table_privilege('authenticated','alur_machine_private.flow_briefs','SELECT')"), false);
 assert.equal(await scalar("select has_function_privilege('authenticated','alur_machine_private.read_flow_brief(uuid,uuid,integer)','EXECUTE')"), false);
 const c = await claim();
 assert.deepEqual(c.session.flow_brief_info, s.flow_brief_info);
 const history = await scalar('select alur_machine_private.read_prior_memory($1)', [s.id]);
 assert.deepEqual(history.session.flow_brief_info, s.flow_brief_info); assert.equal('flow_brief' in history.session, false);
 const read = (part, token = c.claim_token) => scalar('select alur_machine_private.read_flow_brief($1,$2,$3)', [s.id, token, part]);
 await assert.rejects(read(0, randomUUID()), /Lease lost/);
 await assert.rejects(read(s.flow_brief_info.parts), /out of range/);
 let text = '';
 for (let i = 0; i < s.flow_brief_info.parts; i++) {
  const part = await read(i);
  assert.equal(part.parts, s.flow_brief_info.parts); assert.equal(part.sha256, s.flow_brief_info.sha256); assert.equal(part.part_sha256, sha(part.text));
  text += part.text;
 }
 assert.equal(sha(text), s.flow_brief_info.sha256);
 assert.deepEqual(JSON.parse(text), brief);
 // Heartbeat tidak memeriksa ulang brief; hapus sesi ikut menghapus brief.
 await scalar('select alur_machine_private.heartbeat_session($1,$2,900)', [s.id, c.claim_token]);
 await db.query('delete from public.alur_machine_sessions where id=$1', [s.id]);
 assert.equal(await scalar('select count(*)::int from alur_machine_private.flow_briefs'), 0);
});

test('Agent produksi: pemilik menyetel model AI dan batas biaya selama antrean; pekerja membacanya saat klaim', async () => {
 const set=(id,model,budget)=>scalar('select public.alur_set_machine_options($1,$2,$3)',[id,model,budget]);
 const s=await create();
 assert.equal(s.ai_model,null);assert.equal(s.budget_usd,null);
 await as(other,()=>assert.rejects(set(s.id,'claude-opus-5-5',40),/unavailable/));
 await as(stranger,()=>assert.rejects(set(s.id,'claude-opus-5-5',40),/Owner access required/));
 await db.exec('set role anon');try{await assert.rejects(set(s.id,'claude-opus-5-5',40),/permission denied/);}finally{await db.exec('reset role');}
 await as(owner,async()=>{
  for(const [m,b] of [['gpt-5',40],['claude-opus-5-5',0],['claude-opus-5-5',501],[null,40],['claude-opus-5-5',null]])await assert.rejects(set(s.id,m,b));
  const r=await set(s.id,'claude-sonnet-5-5',25);assert.equal(r.ai_model,'claude-sonnet-5-5');assert.equal(r.budget_usd,25);assert.equal('owner_id' in r,false);
  assert.equal((await set(s.id,'claude-opus-5-5',40)).ai_model,'claude-opus-5-5');
 });
 const c=await claim(owner);
 assert.equal(c.session.id,s.id);assert.equal(c.session.ai_model,'claude-opus-5-5');assert.equal(c.session.budget_usd,40);
 await as(owner,async()=>{
  assert.equal((await set(s.id,'claude-opus-5-5',40)).budget_usd,40,'kirim ulang nilai sama setelah mulai tidak gagal');
  await assert.rejects(set(s.id,'claude-haiku-5-5',40),/already started/);
 });
});

// Upgrade dari constraint empat model yang telah terpasang di produksi.
test('upgrade database menerima seluruh GPT dan meneruskannya ke pekerja tanpa menghapus opsi lama', async () => {
 await db.exec("alter table public.alur_machine_sessions drop constraint alur_machine_ai_model; alter table public.alur_machine_sessions add constraint alur_machine_ai_model check (ai_model is null or ai_model in ('claude-opus-5-5','claude-fable-5-2','claude-sonnet-5-5','claude-haiku-5-5'))");
 const old = await create(owner,'Fixture','Claude');
 await as(owner,()=>scalar('select public.alur_set_machine_options($1,$2,$3)',[old.id,'claude-opus-5-5',40]));
 await db.exec(migration);
 assert.equal((await as(owner,()=>detail(old.id))).session.ai_model,'claude-opus-5-5');
 await db.query('delete from public.alur_machine_sessions where id=$1',[old.id]);
 for (const model of ['gpt-6.2-sol','gpt-6.2-astra','gpt-6.1-terra','gpt-6-luna']) {
  const s=await create(owner,'Fixture',model);
  await as(owner,()=>scalar('select public.alur_set_machine_options($1,$2,$3)',[s.id,model,25]));
  const claimed=await scalar('select alur_machine_private.claim_session_as($1,$2,900,$3)',[owner,randomUUID(),'codex']);
  assert.equal(claimed.session.id,s.id);assert.equal(claimed.session.ai_model,model);assert.equal(claimed.session.budget_usd,25);
  await as(owner,()=>assert.rejects(scalar('select public.alur_set_machine_options($1,$2,$3)',[s.id,'gpt-6.2-astra',50]),/already started/));
 }
});
