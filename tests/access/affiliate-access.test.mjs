import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

test('verified logins accrue once, privately; only admin sets rates; earlier credits retain their rate',async t=>{
 const db=new PGlite();
 t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,last_sign_in_at timestamptz);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;
 create table public.admins(user_id uuid primary key);
 create table public.profiles(id uuid primary key,email text,blocked boolean default false);`);
 for(const file of ['apps/alur-workflow/supabase/admin-access.sql','supabase/migrations/202611240001_affiliates.sql'])await db.exec(await readFile(file,'utf8'));
 const [admin,partner,member,later,unconfirmed]=Array.from({length:5},()=>randomUUID());
 for(const id of [admin,partner,member,later,unconfirmed]){
  await db.query('insert into auth.users values($1,now(),now())',[id]);
  await db.query("insert into public.profiles(id,email) values($1,'example')",[id]);
 }
 await db.query('update auth.users set email_confirmed_at=null where id=$1',[unconfirmed]);
 await db.query('insert into public.admins values($1)',[admin]);
 const run=async(id,sql,args=[])=>{
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');
  try {return (await db.query(sql,args)).rows[0]?.result;} finally {await db.exec('reset role');}
 };
 const dashboard=(id,join=false)=>run(id,'select public.affiliate_dashboard($1) result',[join]);
 const setRate=(id,rate)=>run(id,'select public.affiliate_admin($1) result',[rate]);
 const code=(await dashboard(partner,true)).code;
 const redeem=(id)=>run(id,'select public.affiliate_redeem($1) result',[code.toLowerCase()]);
 assert.match(code,/^[A-F0-9]{12}$/);
 assert.equal((await dashboard(partner,true)).code,code);
 assert.equal(await redeem(partner),'self');
 await assert.rejects(redeem(unconfirmed),{code:'42501'});
 assert.equal(await redeem(member),'credited');
 assert.equal(await redeem(member),'already_linked');
 assert.equal((await dashboard(partner)).pending,1);
 assert.equal((await dashboard(later)).referrals,0);
 await assert.rejects(setRate(partner,9999),{code:'42501'});
 await assert.rejects(run(member,'select * from affiliate_private.referrals'),{code:'42501'});
 await setRate(admin,1000);
 assert.equal((await dashboard(partner)).earned_idr,1000);
 await setRate(admin,2000);
 assert.equal(await redeem(later),'credited');
 assert.equal((await dashboard(partner)).earned_idr,3000);
 assert.equal((await setRate(admin,null)).accounts.length,1);
 await db.query('update public.profiles set blocked=true where id=$1',[admin]);
 await assert.rejects(setRate(admin,3000),{code:'42501'});
 await db.exec('set role anon');
 await assert.rejects(db.exec('select public.affiliate_dashboard(false)'),{code:'42501'});
});
