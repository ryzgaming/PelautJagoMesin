-- Install after commerce and before the Alur schemas.
create schema if not exists alur_access_private;
revoke all on schema alur_access_private from public, anon, authenticated;
grant usage on schema alur_access_private to authenticated;
create or replace function alur_access_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.admins a join public.profiles p on p.id=a.user_id
               where a.user_id=(select auth.uid()) and not p.blocked)
$$;
revoke all on function alur_access_private.is_admin() from public,anon,authenticated;
grant execute on function alur_access_private.is_admin() to authenticated;
create or replace function public.alur_is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$ select alur_access_private.is_admin() $$;
revoke all on function public.alur_is_admin() from public,anon,authenticated;
grant execute on function public.alur_is_admin() to authenticated;
