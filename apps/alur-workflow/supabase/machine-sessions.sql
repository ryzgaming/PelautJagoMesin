-- Additive owner-only hosted machine workflow. Apply deliberately after review.
-- alur_machine_private MUST NOT be a Data API exposed schema.
-- Worker SQL functions are executable only by their migration owner (trusted connector).
begin;
create schema if not exists alur_machine_private;
revoke all on schema alur_machine_private from public,anon,authenticated,service_role;
grant usage on schema alur_machine_private to authenticated;

create or replace function alur_machine_private.normalized_name(p_name text)
returns text language sql immutable set search_path='' as $$
 select pg_catalog.btrim(pg_catalog.regexp_replace(p_name,'[[:space:]]+',' ','g'));
$$;
-- URL scope is necessary, not proof of access control or model quality. The trusted
-- worker must verify the actual owner-private artifact and QA before finish_session.
create or replace function alur_machine_private.valid_result_url(p_url text)
returns boolean language sql immutable set search_path='' as $$
 select p_url is not null and pg_catalog.char_length(p_url)<=1000
   and (p_url ~ '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?\.violetblackbird16\.chatgpt\.site(/[A-Za-z0-9_./~-]*)?$'
    -- Claude worker: owner-private artifact page published from the scheduled Claude session.
    or p_url ~ '^https://claude\.ai/artifact/[A-Za-z0-9_-]{8,64}$');
$$;
create or replace function alur_machine_private.valid_leads(p_leads jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare v_item jsonb;
begin
 if p_leads is null or pg_catalog.jsonb_typeof(p_leads)<>'object' then return false; end if;
 if (select count(*) from pg_catalog.jsonb_object_keys(p_leads))<>3
   or p_leads->>'provider' is distinct from 'Internet Archive'
   or p_leads->>'status' is null or p_leads->>'status' not in ('found','empty','unavailable')
   or pg_catalog.jsonb_typeof(p_leads->'items') is distinct from 'array' then return false; end if;
 if pg_catalog.jsonb_array_length(p_leads->'items')>4
   or (p_leads->>'status'='found' and pg_catalog.jsonb_array_length(p_leads->'items')=0)
   or (p_leads->>'status'<>'found' and pg_catalog.jsonb_array_length(p_leads->'items')<>0) then return false; end if;
 for v_item in select * from pg_catalog.jsonb_array_elements(p_leads->'items') loop
   if pg_catalog.jsonb_typeof(v_item)<>'object' then return false; end if;
   if (select count(*) from pg_catalog.jsonb_object_keys(v_item))<>2
     or pg_catalog.jsonb_typeof(v_item->'url') is distinct from 'string'
     or v_item->>'url' !~ '^https://archive\.org/details/[A-Za-z0-9._-]+$'
     or v_item->>'url' in ('https://archive.org/details/.','https://archive.org/details/..')
     or pg_catalog.char_length(v_item->>'url')>1000
     or pg_catalog.jsonb_typeof(v_item->'title') is distinct from 'string'
     or pg_catalog.char_length(pg_catalog.btrim(v_item->>'title')) not between 1 and 220 then return false; end if;
 end loop;
 return true;
end $$;

create table if not exists public.alur_machine_sessions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 request_id uuid not null,
 brand text not null check(char_length(brand) between 1 and 80),
 model text not null check(char_length(model) between 1 and 120),
 machine_key text not null,
 status text not null default 'queued' check(status in ('queued','running','review','needs_evidence','failed')),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 result_url text check(result_url is null or alur_machine_private.valid_result_url(result_url)),
 source_leads jsonb default null check(source_leads is null or alur_machine_private.valid_leads(source_leads)),
 unique(owner_id,request_id)
);
create unique index if not exists alur_machine_one_active
 on public.alur_machine_sessions(owner_id,machine_key) where status in ('queued','running');
create index if not exists alur_machine_history on public.alur_machine_sessions(owner_id,machine_key,created_at desc,id desc);
alter table public.alur_machine_sessions enable row level security;
revoke all on public.alur_machine_sessions from public,anon,authenticated,service_role;
grant select on public.alur_machine_sessions to authenticated;
drop policy if exists alur_machine_read_own on public.alur_machine_sessions;
create policy alur_machine_read_own on public.alur_machine_sessions for select to authenticated using(owner_id=(select auth.uid()));

create table if not exists public.alur_machine_memory (
 session_id uuid not null references public.alur_machine_sessions(id) on delete cascade,
 role text not null check(role in ('evidence','exterior','internals','integrator','qa','fuel','freshwater','seawater','lubrication','intake-exhaust')),
 revision integer not null check(revision>0),
 summary text not null check(char_length(btrim(summary)) between 1 and 2000),
 sources jsonb not null,
 decisions jsonb not null,
 open_questions jsonb not null,
 status text not null check(status in ('DOCUMENTED','PARTIAL','UNVERIFIED','NOT_APPLICABLE')),
 written_at timestamptz not null default clock_timestamp(),
 primary key(session_id,role,revision)
);
alter table public.alur_machine_memory enable row level security;
revoke all on public.alur_machine_memory from public,anon,authenticated,service_role;
grant select on public.alur_machine_memory to authenticated;
drop policy if exists alur_machine_memory_read_own on public.alur_machine_memory;
create policy alur_machine_memory_read_own on public.alur_machine_memory for select to authenticated
 using(exists(select 1 from public.alur_machine_sessions s where s.id=session_id and s.owner_id=(select auth.uid())));

create table if not exists alur_machine_private.leases (
 claim_token uuid primary key,
 session_id uuid not null references public.alur_machine_sessions(id) on delete cascade,
 expires_at timestamptz not null,
 revoked_at timestamptz
);
create unique index if not exists alur_machine_current_lease on alur_machine_private.leases(session_id) where revoked_at is null;
alter table alur_machine_private.leases enable row level security;
revoke all on alur_machine_private.leases from public,anon,authenticated,service_role;

-- One bounded metadata envelope; no private token, local path, credential or file bytes.
create or replace function alur_machine_private.safe_session(p_session public.alur_machine_sessions)
returns jsonb language sql immutable set search_path='' as $$ select pg_catalog.to_jsonb(p_session)-'owner_id'; $$;

create or replace function alur_machine_private.memory_valid(p_sources jsonb,p_decisions jsonb,p_questions jsonb,p_status text)
returns boolean language plpgsql immutable set search_path='' as $$
declare v_source jsonb; v_decision jsonb; v_ref jsonb; v_question jsonb; v_ids text[]:='{}'; v_verified text[]:='{}';
begin
 if p_status is null or p_status not in ('DOCUMENTED','PARTIAL','UNVERIFIED','NOT_APPLICABLE')
  or pg_catalog.jsonb_typeof(p_sources) is distinct from 'array'
  or pg_catalog.jsonb_typeof(p_decisions) is distinct from 'array'
  or pg_catalog.jsonb_typeof(p_questions) is distinct from 'array' then return false; end if;
 if pg_catalog.jsonb_array_length(p_sources)>12 or pg_catalog.jsonb_array_length(p_decisions)>16
  or pg_catalog.jsonb_array_length(p_questions)>12 then return false; end if;
 for v_source in select * from pg_catalog.jsonb_array_elements(p_sources) loop
  if pg_catalog.jsonb_typeof(v_source)<>'object' then return false; end if;
  if (select count(*) from pg_catalog.jsonb_object_keys(v_source))<>5
   or pg_catalog.jsonb_typeof(v_source->'id') is distinct from 'string'
   or pg_catalog.char_length(pg_catalog.btrim(v_source->>'id')) not between 1 and 80
   or (v_source->>'id')=any(v_ids)
   or pg_catalog.jsonb_typeof(v_source->'title') is distinct from 'string'
   or pg_catalog.char_length(pg_catalog.btrim(v_source->>'title')) not between 1 and 160
   or pg_catalog.jsonb_typeof(v_source->'locator') is distinct from 'string'
   or pg_catalog.char_length(pg_catalog.btrim(v_source->>'locator')) not between 1 and 240
   or pg_catalog.jsonb_typeof(v_source->'evidence_status') is distinct from 'string'
   or v_source->>'evidence_status' not in ('DOCUMENTED','OBSERVED','ESTIMATED','UNKNOWN')
   or not (v_source ? 'url') then return false; end if;
  if v_source->'url'<>'null'::jsonb and
   (pg_catalog.jsonb_typeof(v_source->'url')<>'string' or pg_catalog.char_length(v_source->>'url')>1000
    or v_source->>'url' !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9](/[^[:space:]<>]*)?$') then return false; end if;
  v_ids:=pg_catalog.array_append(v_ids,v_source->>'id');
  if v_source->>'evidence_status' in ('DOCUMENTED','OBSERVED') then v_verified:=pg_catalog.array_append(v_verified,v_source->>'id'); end if;
 end loop;
 for v_decision in select * from pg_catalog.jsonb_array_elements(p_decisions) loop
  if pg_catalog.jsonb_typeof(v_decision)<>'object' then return false; end if;
  if (select count(*) from pg_catalog.jsonb_object_keys(v_decision))<>3
   or pg_catalog.jsonb_typeof(v_decision->'text') is distinct from 'string'
   or pg_catalog.char_length(pg_catalog.btrim(v_decision->>'text')) not between 1 and 600
   or pg_catalog.jsonb_typeof(v_decision->'evidence_status') is distinct from 'string'
   or v_decision->>'evidence_status' not in ('DOCUMENTED','OBSERVED','ESTIMATED','UNKNOWN')
   or pg_catalog.jsonb_typeof(v_decision->'source_ids') is distinct from 'array' then return false; end if;
  if pg_catalog.jsonb_array_length(v_decision->'source_ids')>12 then return false; end if;
  for v_ref in select * from pg_catalog.jsonb_array_elements(v_decision->'source_ids') loop
   if pg_catalog.jsonb_typeof(v_ref)<>'string' or not ((v_ref#>>'{}')=any(v_ids)) then return false; end if;
  end loop;
  if v_decision->>'evidence_status' in ('DOCUMENTED','OBSERVED') and not exists(
    select 1 from pg_catalog.jsonb_array_elements_text(v_decision->'source_ids') r where r=any(v_verified)) then return false; end if;
  if p_status in ('DOCUMENTED','NOT_APPLICABLE') and v_decision->>'evidence_status' not in ('DOCUMENTED','OBSERVED') then return false; end if;
 end loop;
 for v_question in select * from pg_catalog.jsonb_array_elements(p_questions) loop
  if pg_catalog.jsonb_typeof(v_question)<>'string' or pg_catalog.char_length(pg_catalog.btrim(v_question#>>'{}')) not between 1 and 300 then return false; end if;
 end loop;
 if p_status in ('DOCUMENTED','NOT_APPLICABLE') and
   (pg_catalog.cardinality(v_verified)=0 or pg_catalog.jsonb_array_length(p_questions)<>0) then return false; end if;
 if p_status in ('PARTIAL','UNVERIFIED') and pg_catalog.jsonb_array_length(p_questions)=0 then return false; end if;
 return true;
end $$;

-- Catalog revisions share the existing queue, ownership, leases and session history.
alter table public.alur_machine_sessions
 add column if not exists source_product text,
 add column if not exists revision_brief text constraint alur_machine_revision_pair check (
  (source_product is null and revision_brief is null) or
  (source_product is not null and revision_brief is not null and char_length(trim(revision_brief)) between 1 and 1200)
 );

-- Which hosted worker holds (or last held) the session: Codex automation or Claude scheduled task.
-- Both poll the same queue; when one stops (e.g. out of tokens) its lease expires and the other resumes.
alter table public.alur_machine_sessions
 add column if not exists worker text constraint alur_machine_worker check (worker is null or worker in ('codex','claude'));

create or replace function alur_machine_private.enqueue_task(p_brand text,p_model text,p_request_id uuid,p_product text,p_brief text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_brand text:=alur_machine_private.normalized_name(p_brand);
 v_model text:=alur_machine_private.normalized_name(p_model); v_key text; v_session public.alur_machine_sessions%rowtype;
begin
 if not alur_access_private.is_admin() then
  raise exception 'Owner access required' using errcode='42501'; end if;
 if p_product is not null then
  select c.brand, c.model into v_brand, v_model from (values
   ('shinko-gj-sim','Shinko','GJ 80-25'), ('man-l2330h','MAN','L23/30H Mk3'),
   ('tanabe-h74','Tanabe','H-74'), ('alfa-laval-mab206s','Alfa Laval','MAB 206S-24')
  ) as c(product,brand,model) where c.product=p_product;
  if v_brand is null or p_brief is null or char_length(trim(p_brief)) not between 1 and 1200
   or p_brief ~ '^[[:space:]]*$' then raise exception 'Invalid revision' using errcode='22023'; end if;
 elsif p_brief is not null then raise exception 'Missing source product' using errcode='22023'; end if;
 if v_brand is null or pg_catalog.char_length(v_brand) not between 1 and 80
  or v_model is null or pg_catalog.char_length(v_model) not between 1 and 120 or p_request_id is null
  or v_brand ~ '[[:cntrl:]]' or v_model ~ '[[:cntrl:]]' then raise exception 'Invalid machine identity' using errcode='22023'; end if;
 v_key:=pg_catalog.jsonb_build_array(pg_catalog.lower(v_brand),pg_catalog.lower(v_model))::text;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':machine-request:'||p_request_id::text,0));
 select * into v_session from public.alur_machine_sessions where owner_id=v_owner and request_id=p_request_id;
 if found then
  if v_session.machine_key<>v_key or v_session.source_product is distinct from p_product
   or v_session.revision_brief is distinct from trim(p_brief) then raise exception 'Request identity mismatch' using errcode='22023'; end if;
  return alur_machine_private.safe_session(v_session);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':machine:'||v_key,0));
 if exists(select 1 from public.alur_machine_sessions where owner_id=v_owner and machine_key=v_key and status in ('queued','running')) then
  raise exception 'Machine already has an active session' using errcode='23505'; end if;
 insert into public.alur_machine_sessions(owner_id,request_id,brand,model,machine_key,source_product,revision_brief)
  values(v_owner,p_request_id,v_brand,v_model,v_key,p_product,trim(p_brief)) returning * into v_session;
 return alur_machine_private.safe_session(v_session);
end $$;

create or replace function alur_machine_private.enqueue_session(p_brand text,p_model text,p_request_id uuid)
returns jsonb language sql security definer set search_path='' as $$
 select alur_machine_private.enqueue_task(p_brand,p_model,p_request_id,null,null);
$$;

create or replace function public.alur_enqueue_machine_revision(p_product text,p_brief text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select alur_machine_private.enqueue_task(null,null,p_request_id,p_product,p_brief);
$$;
create or replace function alur_machine_private.save_source_leads(p_session_id uuid,p_leads jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_session public.alur_machine_sessions%rowtype;
begin
 if not alur_access_private.is_admin() then raise exception 'Owner access required' using errcode='42501'; end if;
 if not alur_machine_private.valid_leads(p_leads) then raise exception 'Invalid source leads' using errcode='22023'; end if;
 select * into v_session from public.alur_machine_sessions where id=p_session_id and owner_id=v_owner for update;
 if not found then raise exception 'Session unavailable' using errcode='42501'; end if;
 if v_session.status not in ('queued','running') then raise exception 'Session is immutable' using errcode='40001'; end if;
 if v_session.source_leads is not null then
  if v_session.source_leads=p_leads then return alur_machine_private.safe_session(v_session); end if;
  raise exception 'Source leads already recorded' using errcode='40001';
 end if;
 update public.alur_machine_sessions set source_leads=p_leads,updated_at=clock_timestamp() where id=p_session_id returning * into v_session;
 return alur_machine_private.safe_session(v_session);
end $$;

-- Deterministic chronological snapshots. No other owner, sibling identity or future session.
create or replace function alur_machine_private.memory_envelope(p_session public.alur_machine_sessions)
returns jsonb language sql stable set search_path='' as $$
 select pg_catalog.jsonb_build_object(
  'account_id',p_session.owner_id,'session',alur_machine_private.safe_session(p_session),
  'memory',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.role) from
    (select distinct on(role) * from public.alur_machine_memory where session_id=p_session.id order by role,revision desc) x),'[]'::jsonb),
  'previous_sessions',coalesce((select pg_catalog.jsonb_agg(alur_machine_private.safe_session(x) order by x.created_at desc,x.id desc) from
    (select s.* from public.alur_machine_sessions s where s.owner_id=p_session.owner_id and s.machine_key=p_session.machine_key
     and (s.created_at,s.id)<(p_session.created_at,p_session.id) order by s.created_at desc,s.id desc limit 20) x),'[]'::jsonb),
  'previous_memory',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.role) from
    (select distinct on(m.role) m.* from public.alur_machine_memory m join public.alur_machine_sessions s on s.id=m.session_id
     where s.owner_id=p_session.owner_id and s.machine_key=p_session.machine_key and s.status in ('review','needs_evidence','failed')
     and (s.created_at,s.id)<(p_session.created_at,p_session.id) order by m.role,s.created_at desc,s.id desc,m.revision desc) x),'[]'::jsonb),
  'canonical_memory',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.role) from
    (select distinct on(m.role) m.* from public.alur_machine_sessions s cross join lateral
       (select distinct on(role) * from public.alur_machine_memory where session_id=s.id order by role,revision desc) m
     where s.owner_id=p_session.owner_id and s.machine_key=p_session.machine_key and s.status='review'
      and m.status in ('DOCUMENTED','NOT_APPLICABLE') and (s.created_at,s.id)<(p_session.created_at,p_session.id)
     order by m.role,s.created_at desc,s.id desc,m.revision desc) x),'[]'::jsonb));
$$;
create or replace function alur_machine_private.list_sessions()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_sessions jsonb;
begin
 if not alur_access_private.is_admin() then raise exception 'Authentication required' using errcode='42501'; end if;
 select coalesce(pg_catalog.jsonb_agg(alur_machine_private.safe_session(x) order by x.created_at desc,x.id desc),'[]'::jsonb)
 into v_sessions from (select * from public.alur_machine_sessions where owner_id=v_owner order by created_at desc,id desc limit 50) x;
 return pg_catalog.jsonb_build_object('account_id',v_owner,'sessions',v_sessions);
end $$;
create or replace function alur_machine_private.get_session(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_session public.alur_machine_sessions%rowtype;
begin
 if not alur_access_private.is_admin() then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_session from public.alur_machine_sessions where id=p_session_id and owner_id=auth.uid();
 if not found then raise exception 'Session unavailable' using errcode='42501'; end if;
 return alur_machine_private.memory_envelope(v_session);
end $$;

-- TRUSTED CONNECTOR ONLY. No authenticated/anonymous/service-role EXECUTE grant.
create or replace function alur_machine_private.claim_session(p_owner_id uuid,p_claim_token uuid,p_lease_seconds integer default 900)
returns jsonb language plpgsql set search_path='' as $$
declare v_session public.alur_machine_sessions%rowtype; v_lease alur_machine_private.leases%rowtype;
begin
 if p_owner_id is null or not exists(select 1 from public.admins where user_id=p_owner_id) then raise exception 'Owner access required' using errcode='42501'; end if;
 if p_claim_token is null or p_lease_seconds is null or p_lease_seconds not between 30 and 3600 then raise exception 'Invalid lease' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('machine-token:'||p_claim_token::text,0));
 -- A token is never reassigned. Old tokens remain revoked/expired in private history.
 select * into v_lease from alur_machine_private.leases where claim_token=p_claim_token;
 if found then
  select * into v_session from public.alur_machine_sessions where id=v_lease.session_id and owner_id=p_owner_id;
  if found and v_session.status='running' and v_lease.revoked_at is null and v_lease.expires_at>clock_timestamp() then
   return pg_catalog.jsonb_build_object('session',alur_machine_private.safe_session(v_session),'claim_token',p_claim_token,'lease_expires_at',v_lease.expires_at);
  end if;
  raise exception 'Claim token expired or already used' using errcode='40001';
 end if;
 select s.* into v_session from public.alur_machine_sessions s where s.owner_id=p_owner_id and
  (s.status='queued' or (s.status='running' and not exists(select 1 from alur_machine_private.leases l
    where l.session_id=s.id and l.revoked_at is null and l.expires_at>clock_timestamp())))
  order by s.created_at,s.id limit 1 for update of s skip locked;
 if not found then return null; end if;
 -- Recheck after the row lock under a fresh READ COMMITTED statement snapshot.
 -- A contender may have replaced an expired lease between candidate scan and lock.
 if v_session.status='running' and exists(select 1 from alur_machine_private.leases where session_id=v_session.id
   and revoked_at is null and expires_at>clock_timestamp()) then return null; end if;
 update alur_machine_private.leases set revoked_at=clock_timestamp() where session_id=v_session.id and revoked_at is null;
 insert into alur_machine_private.leases(claim_token,session_id,expires_at)
  values(p_claim_token,v_session.id,clock_timestamp()+pg_catalog.make_interval(secs=>p_lease_seconds)) returning * into v_lease;
 update public.alur_machine_sessions set status='running',worker=null,updated_at=clock_timestamp() where id=v_session.id returning * into v_session;
 return pg_catalog.jsonb_build_object('session',alur_machine_private.safe_session(v_session),'claim_token',p_claim_token,'lease_expires_at',v_lease.expires_at);
end $$;

-- TRUSTED CONNECTOR ONLY. Same claim, recording which worker took it.
create or replace function alur_machine_private.claim_session_as(p_owner_id uuid,p_claim_token uuid,p_lease_seconds integer,p_worker text)
returns jsonb language plpgsql set search_path='' as $$
declare v_result jsonb; v_session public.alur_machine_sessions%rowtype;
begin
 if p_worker is null or p_worker not in ('codex','claude') then raise exception 'Invalid worker' using errcode='22023'; end if;
 v_result:=alur_machine_private.claim_session(p_owner_id,p_claim_token,p_lease_seconds);
 if v_result is null then return null; end if;
 update public.alur_machine_sessions set worker=p_worker where id=(v_result->'session'->>'id')::uuid returning * into v_session;
 return pg_catalog.jsonb_set(v_result,'{session}',alur_machine_private.safe_session(v_session));
end $$;

-- Locks the session before checking lease, serializing checkpoints, heartbeat and finish.
create or replace function alur_machine_private.lock_claim(p_session_id uuid,p_claim_token uuid)
returns public.alur_machine_sessions language plpgsql set search_path='' as $$
declare v_session public.alur_machine_sessions%rowtype;
begin
 select * into v_session from public.alur_machine_sessions where id=p_session_id for update;
 if not found or not exists(select 1 from public.admins where user_id=v_session.owner_id) then raise exception 'Session unavailable' using errcode='42501'; end if;
 if v_session.status<>'running' or not exists(select 1 from alur_machine_private.leases where session_id=p_session_id
  and claim_token=p_claim_token and revoked_at is null and expires_at>clock_timestamp()) then raise exception 'Lease lost or expired' using errcode='40001'; end if;
 return v_session;
end $$;
create or replace function alur_machine_private.heartbeat_session(p_session_id uuid,p_claim_token uuid,p_lease_seconds integer default 900)
returns jsonb language plpgsql set search_path='' as $$
declare v_session public.alur_machine_sessions%rowtype; v_expiry timestamptz;
begin
 if p_lease_seconds is null or p_lease_seconds not between 30 and 3600 then raise exception 'Invalid lease' using errcode='22023'; end if;
 v_session:=alur_machine_private.lock_claim(p_session_id,p_claim_token);
 update alur_machine_private.leases set expires_at=clock_timestamp()+pg_catalog.make_interval(secs=>p_lease_seconds)
  where claim_token=p_claim_token returning expires_at into v_expiry;
 update public.alur_machine_sessions set updated_at=clock_timestamp() where id=p_session_id returning * into v_session;
 return pg_catalog.jsonb_build_object('session',alur_machine_private.safe_session(v_session),'claim_token',p_claim_token,'lease_expires_at',v_expiry);
end $$;
create or replace function alur_machine_private.read_prior_memory(p_session_id uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare v_session public.alur_machine_sessions%rowtype;
begin
 select * into v_session from public.alur_machine_sessions where id=p_session_id;
 if not found or not exists(select 1 from public.admins where user_id=v_session.owner_id) then raise exception 'Session unavailable' using errcode='42501'; end if;
 return alur_machine_private.memory_envelope(v_session);
end $$;
create or replace function alur_machine_private.write_checkpoint(p_session_id uuid,p_claim_token uuid,p_role text,p_summary text,
 p_sources jsonb,p_decisions jsonb,p_open_questions jsonb,p_status text)
returns jsonb language plpgsql set search_path='' as $$
declare v_session public.alur_machine_sessions%rowtype; v_memory public.alur_machine_memory%rowtype; v_revision integer;
begin
 v_session:=alur_machine_private.lock_claim(p_session_id,p_claim_token);
 if p_role is null or p_role not in ('evidence','exterior','internals','integrator','qa','fuel','freshwater','seawater','lubrication','intake-exhaust')
  or p_summary is null or pg_catalog.char_length(pg_catalog.btrim(p_summary)) not between 1 and 2000
  or not alur_machine_private.memory_valid(p_sources,p_decisions,p_open_questions,p_status) then
  raise exception 'Invalid structured checkpoint' using errcode='22023'; end if;
 -- Exact network retry does not manufacture a revision; changed checkpoints append only.
 select * into v_memory from public.alur_machine_memory where session_id=p_session_id and role=p_role order by revision desc limit 1;
 if found and v_memory.summary=p_summary and v_memory.sources=p_sources and v_memory.decisions=p_decisions
   and v_memory.open_questions=p_open_questions and v_memory.status=p_status then return pg_catalog.to_jsonb(v_memory); end if;
 v_revision:=coalesce(v_memory.revision,0)+1;
 insert into public.alur_machine_memory(session_id,role,revision,summary,sources,decisions,open_questions,status)
  values(p_session_id,p_role,v_revision,p_summary,p_sources,p_decisions,p_open_questions,p_status) returning * into v_memory;
 update public.alur_machine_sessions set updated_at=clock_timestamp() where id=p_session_id;
 return pg_catalog.to_jsonb(v_memory);
end $$;
create or replace function alur_machine_private.finish_session(p_session_id uuid,p_claim_token uuid,p_status text,p_result_url text default null)
returns jsonb language plpgsql set search_path='' as $$
declare v_session public.alur_machine_sessions%rowtype; v_count integer;
begin
 -- Exact terminal retry permitted only for the same latest claim, never another token.
 select * into v_session from public.alur_machine_sessions where id=p_session_id for update;
 if not found or not exists(select 1 from public.admins where user_id=v_session.owner_id) then raise exception 'Session unavailable' using errcode='42501'; end if;
 if v_session.status in ('review','needs_evidence','failed') and v_session.status=p_status and v_session.result_url is not distinct from p_result_url
  and exists(select 1 from alur_machine_private.leases where session_id=p_session_id and claim_token=p_claim_token and revoked_at is null) then
  return alur_machine_private.safe_session(v_session); end if;
 v_session:=alur_machine_private.lock_claim(p_session_id,p_claim_token);
 if p_status is null or p_status not in ('review','needs_evidence','failed') then raise exception 'Invalid final status' using errcode='22023'; end if;
 if p_status='review' then
  select count(distinct role) into v_count from public.alur_machine_memory where session_id=p_session_id;
  if v_count<>10 or not alur_machine_private.valid_result_url(p_result_url) then raise exception 'Review requires ten roles and a private review URL' using errcode='22023'; end if;
 else
  if p_result_url is not null then raise exception 'Incomplete session cannot publish a review URL' using errcode='22023'; end if;
  if p_status='needs_evidence' and not exists(select 1 from
    (select distinct on(role) open_questions from public.alur_machine_memory where session_id=p_session_id order by role,revision desc) m
    where pg_catalog.jsonb_array_length(m.open_questions)>0) then raise exception 'Needs evidence requires an open question checkpoint' using errcode='22023'; end if;
 end if;
 update public.alur_machine_sessions set status=p_status,result_url=p_result_url,updated_at=clock_timestamp()
  where id=p_session_id returning * into v_session;
 return alur_machine_private.safe_session(v_session);
end $$;

-- Revoke every function in this new, dedicated schema; regrant only browser entry helpers.
revoke all on all functions in schema alur_machine_private from public,anon,authenticated,service_role;
grant execute on function alur_machine_private.enqueue_session(text,text,uuid),alur_machine_private.save_source_leads(uuid,jsonb),
 alur_machine_private.list_sessions(),alur_machine_private.get_session(uuid) to authenticated;
create or replace function public.alur_enqueue_machine_session(p_brand text,p_model text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select alur_machine_private.enqueue_session(p_brand,p_model,p_request_id); $$;
create or replace function public.alur_save_source_leads(p_session_id uuid,p_leads jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select alur_machine_private.save_source_leads(p_session_id,p_leads); $$;
create or replace function public.alur_list_machine_sessions()
returns jsonb language sql stable security invoker set search_path='' as $$ select alur_machine_private.list_sessions(); $$;
create or replace function public.alur_get_machine_session(p_session_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$ select alur_machine_private.get_session(p_session_id); $$;
revoke all on function public.alur_enqueue_machine_session(text,text,uuid),public.alur_save_source_leads(uuid,jsonb),
 public.alur_list_machine_sessions(),public.alur_get_machine_session(uuid) from public,anon,authenticated,service_role;
grant execute on function public.alur_enqueue_machine_session(text,text,uuid),public.alur_save_source_leads(uuid,jsonb),
 public.alur_list_machine_sessions(),public.alur_get_machine_session(uuid) to authenticated;
revoke all on function alur_machine_private.enqueue_task(text,text,uuid,text,text),
 public.alur_enqueue_machine_revision(text,text,uuid) from public,anon,service_role;
grant execute on function alur_machine_private.enqueue_task(text,text,uuid,text,text),
 public.alur_enqueue_machine_revision(text,text,uuid) to authenticated;

drop policy if exists alur_admin_required on public.alur_machine_sessions;
create policy alur_admin_required on public.alur_machine_sessions as restrictive for all to authenticated
 using ((select alur_access_private.is_admin())) with check ((select alur_access_private.is_admin()));
drop policy if exists alur_admin_required on public.alur_machine_memory;
create policy alur_admin_required on public.alur_machine_memory as restrictive for all to authenticated
 using ((select alur_access_private.is_admin())) with check ((select alur_access_private.is_admin()));

-- Owner deletes own sessions (memory, leases cascade). A session an agent is actively
-- working on (running with a live lease) is reported busy and kept, never yanked mid-lease.
create or replace function alur_machine_private.delete_sessions(p_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_busy uuid[]; v_deleted uuid[];
begin
 if not alur_access_private.is_admin() then raise exception 'Owner access required' using errcode='42501'; end if;
 if p_ids is null or pg_catalog.cardinality(p_ids) not between 1 and 50 or pg_catalog.array_position(p_ids,null) is not null
  then raise exception 'Invalid session list' using errcode='22023'; end if;
 -- Same row lock the worker takes in lock_claim/claim_session; id order avoids deadlocks.
 perform 1 from public.alur_machine_sessions where owner_id=v_owner and id=any(p_ids) order by id for update;
 select coalesce(pg_catalog.array_agg(s.id order by s.id),'{}') into v_busy from public.alur_machine_sessions s
  where s.owner_id=v_owner and s.id=any(p_ids) and s.status='running' and exists(select 1 from alur_machine_private.leases l
   where l.session_id=s.id and l.revoked_at is null and l.expires_at>clock_timestamp());
 with gone as (delete from public.alur_machine_sessions s where s.owner_id=v_owner and s.id=any(p_ids)
   and not (s.id=any(v_busy)) returning s.id)
 select coalesce(pg_catalog.array_agg(id order by id),'{}') into v_deleted from gone;
 return pg_catalog.jsonb_build_object('deleted',pg_catalog.to_jsonb(v_deleted),'busy',pg_catalog.to_jsonb(v_busy));
end $$;
create or replace function public.alur_delete_machine_sessions(p_ids uuid[])
returns jsonb language sql security invoker set search_path='' as $$ select alur_machine_private.delete_sessions(p_ids); $$;
revoke all on function alur_machine_private.delete_sessions(uuid[]),public.alur_delete_machine_sessions(uuid[])
 from public,anon,authenticated,service_role;
grant execute on function alur_machine_private.delete_sessions(uuid[]),public.alur_delete_machine_sessions(uuid[]) to authenticated;
commit;
