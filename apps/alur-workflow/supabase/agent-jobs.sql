-- Local preparation only: apply deliberately to Supabase after review.
-- Keep alur_agent_private OUT of the Data API exposed schemas.
-- Only project slug/status metadata is synced. Manuals, paths, logs and outputs stay local.
begin;
create schema if not exists alur_agent_private;
revoke all on schema alur_agent_private from public, anon, authenticated;
grant usage on schema alur_agent_private to authenticated;

create or replace function alur_agent_private.valid_progress(p_value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_key text; v_value jsonb;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) <> 'object' then return false; end if;
  if (select count(*) from pg_catalog.jsonb_object_keys(p_value)) <> 10 then return false; end if;
  for v_key, v_value in select * from pg_catalog.jsonb_each(p_value) loop
    if v_key not in ('evidence','exterior','internals','integrator','qa','fuel','freshwater','seawater','lubrication','intake-exhaust')
      or pg_catalog.jsonb_typeof(v_value) <> 'string'
      or (v_value #>> '{}') not in ('pending','running','review','failed','not_applicable') then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function alur_agent_private.valid_progress(jsonb) from public, anon, authenticated;

create table if not exists public.alur_agent_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_key text not null check (char_length(project_key) between 1 and 64 and project_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  request_id uuid not null,
  status text not null default 'queued' check (status in ('queued','running','review','failed')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  progress jsonb not null default '{"evidence":"pending","exterior":"pending","internals":"pending","integrator":"pending","qa":"pending","fuel":"pending","freshwater":"pending","seawater":"pending","lubrication":"pending","intake-exhaust":"pending"}'::jsonb
    check (alur_agent_private.valid_progress(progress)),
  note text not null default 'queued' check (note in ('queued','runner_claimed','running','review_ready','review_with_gaps','runner_failed')),
  unique (owner_id, request_id)
);
create unique index if not exists alur_agent_jobs_one_active_project
  on public.alur_agent_jobs(owner_id, project_key) where status in ('queued','running');
create index if not exists alur_agent_jobs_history on public.alur_agent_jobs(owner_id, created_at desc);
alter table public.alur_agent_jobs enable row level security;
revoke all on public.alur_agent_jobs from public, anon, authenticated;
grant select on public.alur_agent_jobs to authenticated;
drop policy if exists alur_agent_jobs_read_own on public.alur_agent_jobs;
create policy alur_agent_jobs_read_own on public.alur_agent_jobs
  for select to authenticated using (owner_id = (select auth.uid()));

-- Tokens never appear in the public table, RPC results, or realtime metadata.
create table if not exists alur_agent_private.claims (
  job_id uuid primary key references public.alur_agent_jobs(id) on delete cascade,
  claim_token uuid not null unique
);
alter table alur_agent_private.claims enable row level security;
revoke all on alur_agent_private.claims from public, anon, authenticated;

-- Definer functions are deliberately isolated; wrappers below are SECURITY INVOKER.
-- All privileged operations authenticate auth.uid(), filter owner, and pin search_path.
create or replace function alur_agent_private.enqueue_job(p_project_key text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_job public.alur_agent_jobs%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_project_key is null or char_length(p_project_key) not between 1 and 64
     or p_project_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or p_request_id is null then
    raise exception 'Invalid project key or request ID' using errcode = '22023';
  end if;
  -- Stable lock ordering: request first, then project. Idempotency covers response loss.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':request:' || p_request_id::text, 0));
  select * into v_job from public.alur_agent_jobs where owner_id = v_owner and request_id = p_request_id;
  if found then
    if v_job.project_key <> p_project_key then raise exception 'Request ID already belongs to another project' using errcode = '22023'; end if;
    return pg_catalog.to_jsonb(v_job) - 'owner_id';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':project:' || p_project_key, 0));
  if exists (select 1 from public.alur_agent_jobs where owner_id = v_owner and project_key = p_project_key and status in ('queued','running')) then
    raise exception 'Project already has an active job' using errcode = '23505';
  end if;
  insert into public.alur_agent_jobs(owner_id,project_key,request_id) values(v_owner,p_project_key,p_request_id) returning * into v_job;
  return pg_catalog.to_jsonb(v_job) - 'owner_id';
end $$;

create or replace function alur_agent_private.claim_job(p_project_key text, p_claim_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_job public.alur_agent_jobs%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_project_key is null or char_length(p_project_key) not between 1 and 64
    or p_project_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or p_claim_token is null then
    raise exception 'Invalid project key or claim token' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':project:' || p_project_key, 0));
  -- A lost network response can be retried with the SAME caller-generated token.
  select j.* into v_job from public.alur_agent_jobs j join alur_agent_private.claims c on c.job_id = j.id
    where j.owner_id = v_owner and c.claim_token = p_claim_token;
  if found then
    if v_job.project_key <> p_project_key then raise exception 'Claim token already used' using errcode = '22023'; end if;
    if v_job.status = 'running' then return pg_catalog.to_jsonb(v_job) - 'owner_id'; end if;
    return null;
  end if;
  select * into v_job from public.alur_agent_jobs
    where owner_id = v_owner and project_key = p_project_key and status = 'queued'
    order by created_at, id limit 1 for update;
  if not found then return null; end if;
  insert into alur_agent_private.claims(job_id,claim_token) values(v_job.id,p_claim_token);
  update public.alur_agent_jobs set status = 'running', note = 'runner_claimed', updated_at = clock_timestamp()
    where id = v_job.id and owner_id = v_owner returning * into v_job;
  return pg_catalog.to_jsonb(v_job) - 'owner_id';
end $$;

create or replace function alur_agent_private.update_job(p_job_id uuid, p_claim_token uuid, p_status text, p_progress jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_job public.alur_agent_jobs%rowtype; v_key text; v_value jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_job_id is null or p_claim_token is null or p_status is null or p_status not in ('running','review','failed')
    or not alur_agent_private.valid_progress(p_progress) or p_note is null
    or (p_status = 'running' and p_note not in ('running','runner_claimed'))
    or (p_status = 'review' and p_note not in ('review_ready','review_with_gaps'))
    or (p_status = 'failed' and p_note <> 'runner_failed') then
    raise exception 'Invalid sanitized job update' using errcode = '22023';
  end if;
  select * into v_job from public.alur_agent_jobs where id = p_job_id and owner_id = v_owner for update;
  if not found or not exists(select 1 from alur_agent_private.claims where job_id = p_job_id and claim_token = p_claim_token) then
    raise exception 'Job claim unavailable' using errcode = '42501';
  end if;
  if v_job.status in ('review','failed') and v_job.status = p_status and v_job.progress = p_progress and v_job.note = p_note then
    return pg_catalog.to_jsonb(v_job) - 'owner_id';
  end if;
  if v_job.status <> 'running' then raise exception 'Claim is no longer running' using errcode = '40001'; end if;
  for v_key, v_value in select * from pg_catalog.jsonb_each(p_progress) loop
    if (v_job.progress ->> v_key) in ('review','failed','not_applicable') and v_value <> (v_job.progress -> v_key) then
      raise exception 'Finished role cannot be overwritten' using errcode = '22023';
    end if;
    if (v_job.progress ->> v_key) = 'running' and v_value = '"pending"'::jsonb then
      raise exception 'Role progress cannot regress' using errcode = '22023';
    end if;
    if p_status = 'review' and (v_value #>> '{}') not in ('review','not_applicable') then
      raise exception 'Review requires all roles to finish or be not applicable' using errcode = '22023';
    end if;
  end loop;
  update public.alur_agent_jobs set status = p_status, progress = p_progress, note = p_note, updated_at = clock_timestamp()
    where id = p_job_id and owner_id = v_owner returning * into v_job;
  return pg_catalog.to_jsonb(v_job) - 'owner_id';
end $$;

revoke all on function alur_agent_private.enqueue_job(text,uuid), alur_agent_private.claim_job(text,uuid),
  alur_agent_private.update_job(uuid,uuid,text,jsonb,text) from public, anon, authenticated;
grant execute on function alur_agent_private.enqueue_job(text,uuid), alur_agent_private.claim_job(text,uuid),
  alur_agent_private.update_job(uuid,uuid,text,jsonb,text) to authenticated;

create or replace function public.alur_enqueue_agent_job(p_project_key text, p_request_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select alur_agent_private.enqueue_job(p_project_key,p_request_id);
$$;
create or replace function public.alur_claim_agent_job(p_project_key text, p_claim_token uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select alur_agent_private.claim_job(p_project_key,p_claim_token);
$$;
create or replace function public.alur_update_agent_job(p_job_id uuid, p_claim_token uuid, p_status text, p_progress jsonb, p_note text)
returns jsonb language sql security invoker set search_path = '' as $$
  select alur_agent_private.update_job(p_job_id,p_claim_token,p_status,p_progress,p_note);
$$;
revoke all on function public.alur_enqueue_agent_job(text,uuid), public.alur_claim_agent_job(text,uuid),
  public.alur_update_agent_job(uuid,uuid,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.alur_enqueue_agent_job(text,uuid), public.alur_claim_agent_job(text,uuid),
  public.alur_update_agent_job(uuid,uuid,text,jsonb,text) to authenticated;
-- A crashed runner remains running. Never automatically reclaim, expire or requeue.
commit;
