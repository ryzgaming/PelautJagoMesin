-- Run after commerce and alur-workflow/supabase/admin-access.sql.
create schema if not exists affiliate_private;
revoke all on schema affiliate_private from public,anon,authenticated;
grant usage on schema affiliate_private to authenticated;
create table affiliate_private.partners (
 user_id uuid primary key references auth.users(id),
 code text not null unique default upper(left(replace(gen_random_uuid()::text,'-',''),12))
);
create table affiliate_private.terms (
 singleton boolean primary key default true check(singleton),
 amount_idr integer check(amount_idr > 0)
);
insert into affiliate_private.terms default values;
create table affiliate_private.referrals (
 member_id uuid primary key references auth.users(id),
 partner_id uuid not null references affiliate_private.partners(user_id),
 amount_idr integer check(amount_idr > 0), credited_at timestamptz not null default now(),
 check(member_id <> partner_id)
);
create index affiliate_partner_referrals on affiliate_private.referrals(partner_id);
alter table affiliate_private.partners enable row level security;
alter table affiliate_private.terms enable row level security;
alter table affiliate_private.referrals enable row level security;
revoke all on all tables in schema affiliate_private from public,anon,authenticated;

create function affiliate_private.account() returns uuid language plpgsql stable security definer set search_path='' as $$
declare account_id uuid := auth.uid();
begin
 if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id
   where u.id=account_id and u.email_confirmed_at is not null and not p.blocked) then
   raise exception 'Akun terverifikasi diperlukan.' using errcode='42501';
 end if;
 return account_id;
end $$;
create function affiliate_private.dashboard(p_join boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare account_id uuid := affiliate_private.account(); partner_code text;
begin
 if p_join then insert into affiliate_private.partners(user_id) values(account_id) on conflict(user_id) do nothing; end if;
 select code into partner_code from affiliate_private.partners where user_id=account_id;
 return (select jsonb_build_object('code',partner_code,'referrals',count(*),'pending',count(*) filter(where amount_idr is null),
 'earned_idr',coalesce(sum(amount_idr),0),'rate_idr',(select amount_idr from affiliate_private.terms))
 from affiliate_private.referrals where partner_id=account_id);
end $$;
create function affiliate_private.redeem(p_code text) returns text language plpgsql security definer set search_path='' as $$
declare account_id uuid := affiliate_private.account(); sponsor uuid; fee integer;
begin
 if not exists(select 1 from auth.users where id=account_id and last_sign_in_at >= now()-interval '10 minutes') then return 'login_required'; end if;
 select a.user_id into sponsor from affiliate_private.partners a join public.profiles p on p.id=a.user_id
 where a.code=upper(trim(p_code)) and not p.blocked;
 if sponsor is null then return 'invalid'; end if;
 if sponsor=account_id then return 'self'; end if;
 select amount_idr into fee from affiliate_private.terms where singleton for share;
 insert into affiliate_private.referrals(member_id,partner_id,amount_idr) values(account_id,sponsor,fee) on conflict(member_id) do nothing;
 if found then return 'credited'; end if;
 return 'already_linked';
end $$;
create function affiliate_private.admin(p_rate integer) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not alur_access_private.is_admin() then raise exception 'Admin diperlukan.' using errcode='42501'; end if;
 if p_rate is not null then
  if p_rate < 1 then raise exception 'Nominal harus positif.' using errcode='22023'; end if;
  update affiliate_private.terms set amount_idr=p_rate where singleton;
  update affiliate_private.referrals set amount_idr=p_rate where amount_idr is null;
 end if;
 return jsonb_build_object('rate_idr',(select amount_idr from affiliate_private.terms),
 'accounts',(select coalesce(jsonb_agg(to_jsonb(x) order by x.email),'[]'::jsonb) from
 (select p.email,count(*) as referrals,count(*) filter(where r.amount_idr is null) as pending,coalesce(sum(r.amount_idr),0) as earned_idr
 from affiliate_private.referrals r join public.profiles p on p.id=r.partner_id group by r.partner_id,p.email) x));
end $$;
revoke all on all functions in schema affiliate_private from public,anon,authenticated;
grant execute on function affiliate_private.dashboard(boolean),affiliate_private.redeem(text),affiliate_private.admin(integer) to authenticated;

create function public.affiliate_dashboard(p_join boolean default false) returns jsonb language sql security invoker set search_path='' as $$select affiliate_private.dashboard(p_join)$$;
create function public.affiliate_redeem(p_code text) returns text language sql security invoker set search_path='' as $$select affiliate_private.redeem(p_code)$$;
create function public.affiliate_admin(p_rate integer default null) returns jsonb language sql security invoker set search_path='' as $$select affiliate_private.admin(p_rate)$$;
revoke all on function public.affiliate_dashboard(boolean),public.affiliate_redeem(text),public.affiliate_admin(integer) from public,anon,authenticated;
grant execute on function public.affiliate_dashboard(boolean),public.affiliate_redeem(text),public.affiliate_admin(integer) to authenticated;
