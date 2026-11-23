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
 await db.query('insert into auth.users values($1),($2),($3)',[owner,other,stranger]);await db.query('insert into public.admins values($1),($2)',[owner,other]);await db.exec(migration);
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
 try{await assert.rejects(checkpoint(s.id,c.claim_token),/unavailable/);await as(owner,()=>assert.rejects(enqueue('MAN','L23/30H'),/Owner access required/));assert.equal((await as(owner,()=>detail(s.id))).session.id,s.id);}finally{await db.query('insert into public.admins values($1)',[owner]);}
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
