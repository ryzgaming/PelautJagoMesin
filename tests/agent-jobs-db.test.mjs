// Real PostgreSQL semantics in PGlite; synthetic identities, no remote database.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

let db;
const uid = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const roles = ['evidence','exterior','internals','integrator','qa','fuel','freshwater','seawater','lubrication','intake-exhaust'];
const progress = (status = 'pending') => Object.fromEntries(roles.map(role => [role,status]));
const migration = await readFile(new URL('../apps/alur-workflow/supabase/agent-jobs.sql', import.meta.url), 'utf8');
const scalar = async (q, values = []) => Object.values((await db.query(q,values)).rows[0])[0];
const enqueue = (key='tanabe-h74', request=randomUUID()) => scalar('select public.alur_enqueue_agent_job($1,$2)',[key,request]);
const claim = (key,token) => scalar('select public.alur_claim_agent_job($1,$2)',[key,token]);
const update = (id,token,status,p,note) => scalar('select public.alur_update_agent_job($1,$2,$3,$4::jsonb,$5)',[id,token,status,JSON.stringify(p),note]);
const as = async (user,fn) => {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user ?? '']);
  await db.exec('set role authenticated');
  try { return await fn(); } finally { await db.exec('reset role'); }
};

before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;`);
  await db.query('insert into auth.users values($1),($2)',[uid,other]);
  await db.exec(migration);
});
beforeEach(async () => { await db.exec('reset role; truncate public.alur_agent_jobs cascade;'); });
after(async () => { await db.close(); });

test('agent-job migration reapplies without weakening grants or leaking claims', async () => {
  await db.exec(migration);
  assert.equal(await scalar("select has_table_privilege('authenticated','public.alur_agent_jobs','SELECT')"),true);
  for (const permission of ['INSERT','UPDATE','DELETE','TRUNCATE']) {
    assert.equal(await scalar("select has_table_privilege('authenticated','public.alur_agent_jobs',$1)",[permission]),false);
  }
  assert.equal(await scalar("select has_table_privilege('authenticated','alur_agent_private.claims','SELECT')"),false);
  assert.equal(await scalar("select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'alur_%agent_job' and p.prosecdef"),0);
});

test('enqueue returns safe exact metadata object and is idempotent per owner request', async () => {
  await as(uid,async()=>{
    const request=randomUUID(); const job=await enqueue('tanabe-h74',request);
    assert.deepEqual(Object.keys(job).sort(),['id','project_key','request_id','status','created_at','updated_at','progress','note'].sort());
    assert.equal(job.status,'queued'); assert.deepEqual(job.progress,progress()); assert.equal(job.note,'queued');
    assert.deepEqual(await enqueue('tanabe-h74',request),job);
    await assert.rejects(enqueue('another-project',request),/already belongs/);
    await assert.rejects(enqueue('tanabe-h74'),/active job/);
    assert.equal(await scalar('select count(*)::int from public.alur_agent_jobs'),1);
  });
});

test('owner RLS and every mutation isolate the same owner', async () => {
  const token=randomUUID(); const job=await as(uid,()=>enqueue());
  await as(uid,()=>claim(job.project_key,token));
  await as(other,async()=>{
    assert.equal(await scalar('select count(*)::int from public.alur_agent_jobs'),0);
    assert.equal(await claim(job.project_key,randomUUID()),null);
    await assert.rejects(update(job.id,token,'failed',progress(),'runner_failed'),/claim unavailable/);
    const own=await enqueue(job.project_key,job.request_id); assert.notEqual(own.id,job.id);
    assert.equal(await scalar('select count(*)::int from public.alur_agent_jobs'),1);
  });
});

test('authenticated cannot write raw rows or read private claim tokens', async () => {
  const job=await as(uid,()=>enqueue());
  await as(uid,async()=>{
    await assert.rejects(db.query('update public.alur_agent_jobs set status=$1 where id=$2',['review',job.id]),/permission denied/);
    await assert.rejects(db.query('delete from public.alur_agent_jobs'),/permission denied/);
    await assert.rejects(db.query('insert into public.alur_agent_jobs(project_key,request_id) values($1,$2)',['other-project',randomUUID()]),/permission denied/);
    await assert.rejects(db.query('select * from alur_agent_private.claims'),/permission denied/);
  });
});

test('anon and authenticated without uid cannot invoke job mutation', async () => {
  await db.exec('set role anon');
  try { await assert.rejects(enqueue(),/permission denied/); await assert.rejects(db.query('select * from public.alur_agent_jobs'),/permission denied/); }
  finally { await db.exec('reset role'); }
  await as(null,()=>assert.rejects(enqueue(),/Authentication required/));
});

test('claim is scoped and exclusive; same token safely recovers lost response', async () => {
  await as(uid,async()=>{
    const job=await enqueue(); const token=randomUUID();
    assert.equal(await claim('wrong-project',token),null);
    const claimed=await claim(job.project_key,token);
    assert.equal(claimed.id,job.id); assert.equal(claimed.status,'running'); assert.equal(claimed.note,'runner_claimed');
    assert.deepEqual(await claim(job.project_key,token),claimed);
    assert.equal(await claim(job.project_key,randomUUID()),null);
    await assert.rejects(claim('wrong-project',token),/already used/);
    await assert.rejects(update(job.id,randomUUID(),'failed',progress(),'runner_failed'),/claim unavailable/);
  });
});

test('runner update sanitizes progress and note; no paths/logs/extra fields survive', async () => {
  await as(uid,async()=>{
    const job=await enqueue(),token=randomUUID(); await claim(job.project_key,token);
    for (const p of [null,[],{}, {...progress(),path:'/secret/manual.pdf'}, {...progress(),fuel:'some raw log'}, {...progress(),fuel:{state:'running'}}]) {
      await assert.rejects(update(job.id,token,'running',p,'running'),/Invalid sanitized/);
    }
    await assert.rejects(update(job.id,token,'running',progress(),'/home/user/manual.pdf'),/Invalid sanitized/);
    await assert.rejects(update(job.id,token,'review',progress(),'review_ready'),/requires all roles/);
    const p={...progress(),evidence:'running'};
    const result=await update(job.id,token,'running',p,'running'); assert.deepEqual(result.progress,p);
  });
});

test('review with gaps is honest review metadata; terminal writes are immutable and retry-safe', async () => {
  await as(uid,async()=>{
    const job=await enqueue(),token=randomUUID(); await claim(job.project_key,token);
    const p=progress('review'); p.seawater='not_applicable';
    const reviewed=await update(job.id,token,'review',p,'review_with_gaps');
    assert.equal(reviewed.note,'review_with_gaps');
    assert.deepEqual(await update(job.id,token,'review',p,'review_with_gaps'),reviewed);
    await assert.rejects(update(job.id,token,'running',progress(),'running'),/no longer running/);
    await assert.rejects(update(job.id,token,'failed',p,'runner_failed'),/no longer running/);
    assert.equal(await claim(job.project_key,token),null);
    const next=await enqueue(job.project_key); assert.notEqual(next.id,job.id);
    assert.deepEqual(await enqueue(job.project_key,job.request_id),reviewed);
  });
});

test('running role cannot regress and finished role cannot be overwritten', async () => {
  await as(uid,async()=>{
    const job=await enqueue(),token=randomUUID(); await claim(job.project_key,token);
    await update(job.id,token,'running',{...progress(),evidence:'running'},'running');
    await assert.rejects(update(job.id,token,'running',progress(),'running'),/cannot regress/);
    await update(job.id,token,'running',{...progress(),evidence:'review'},'running');
    await assert.rejects(update(job.id,token,'running',{...progress(),evidence:'failed'},'running'),/cannot be overwritten/);
  });
});

test('crashed old running job stays claimed; another runner never auto-requeues', async () => {
  const token=randomUUID(); const job=await as(uid,()=>enqueue()); await as(uid,()=>claim(job.project_key,token));
  await db.query("update public.alur_agent_jobs set updated_at=now()-interval '8 days' where id=$1",[job.id]);
  await as(uid,async()=>{
    assert.equal(await claim(job.project_key,randomUUID()),null);
    assert.equal(await scalar('select status from public.alur_agent_jobs where id=$1',[job.id]),'running');
    await assert.rejects(enqueue(job.project_key),/active job/);
  });
});

test('failure retains local-only details and allows a new request after terminal status', async () => {
  await as(uid,async()=>{
    const job=await enqueue(),token=randomUUID(); await claim(job.project_key,token);
    const failed=await update(job.id,token,'failed',{...progress(),evidence:'failed'},'runner_failed');
    assert.equal(failed.status,'failed'); assert.equal(failed.note,'runner_failed');
    assert.notEqual((await enqueue(job.project_key)).id,job.id);
  });
});

test('slug validation and null parameters fail closed', async () => {
  await as(uid,async()=>{
    for(const key of [null,'','../secret','UPPER','a_thing','a--b','a'.repeat(65),'name\n']) await assert.rejects(enqueue(key),/Invalid project/);
    await assert.rejects(enqueue('valid',null),/Invalid project/);
    await assert.rejects(claim('valid',null),/Invalid project/);
  });
});
