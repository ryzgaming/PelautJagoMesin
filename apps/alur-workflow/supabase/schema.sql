begin;
create table if not exists public.alur_flows (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null, name text not null, graph jsonb not null, revision integer not null check(revision>0),
  updated timestamptz not null default now(), primary key(owner_id,id)
);
create table if not exists public.alur_runs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  flow_id text not null, mode text not null check(mode in ('test','live')), created timestamptz not null default now(), trace jsonb not null, result jsonb not null
);
create index if not exists alur_runs_history on public.alur_runs(owner_id,flow_id,created desc);
alter table public.alur_flows enable row level security;
alter table public.alur_runs enable row level security;
revoke all on public.alur_flows,public.alur_runs from anon,public,authenticated;
grant select,insert,update on public.alur_flows to authenticated;
grant select,insert on public.alur_runs to authenticated;
create policy alur_read_flows on public.alur_flows for select to authenticated using(owner_id=(select auth.uid()));
create policy alur_add_flows on public.alur_flows for insert to authenticated with check(owner_id=(select auth.uid()));
create policy alur_edit_flows on public.alur_flows for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy alur_read_runs on public.alur_runs for select to authenticated using(owner_id=(select auth.uid()));
create policy alur_add_runs on public.alur_runs for insert to authenticated with check(owner_id=(select auth.uid()));
drop policy if exists alur_admin_required on public.alur_flows;
create policy alur_admin_required on public.alur_flows as restrictive for all to authenticated
 using ((select alur_access_private.is_admin())) with check ((select alur_access_private.is_admin()));
drop policy if exists alur_admin_required on public.alur_runs;
create policy alur_admin_required on public.alur_runs as restrictive for all to authenticated
 using ((select alur_access_private.is_admin())) with check ((select alur_access_private.is_admin()));
commit;
