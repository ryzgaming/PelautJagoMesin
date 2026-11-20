begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, display_name text not null default '', blocked boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.products (
 id text primary key check (id ~ '^[a-z0-9-]{1,80}$'), title text not null,
 category text not null default '', description text not null default '',
 price_idr bigint not null check(price_idr between 0 and 100000000),
 is_free boolean not null default false, active boolean not null default false,
 storage_path text check(storage_path is null or storage_path ~ '^[a-z0-9-]+\.html$'),
 check(is_free = (price_idr=0))
);
create table public.orders (
 id text primary key default ('om-'||gen_random_uuid()::text),
 user_id uuid not null references auth.users(id), product_id text not null references public.products(id),
 product_title text not null, amount_idr bigint not null check(amount_idr>0),
 status text not null default 'pending' check(status in ('pending','paid','failed','refunded')),
 snap_token text, transaction_id text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index orders_user_product on public.orders(user_id,product_id,created_at desc);
create table public.entitlements (
 user_id uuid not null references auth.users(id), product_id text not null references public.products(id),
 granted_at timestamptz not null default now(), primary key(user_id,product_id)
);
create or replace function public.new_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,email) values(new.id,coalesce(new.email,'')) on conflict(id) do update set email=excluded.email;return new;end $$;
create trigger on_auth_user_created after insert or update of email on auth.users for each row execute function public.new_profile();
insert into public.profiles(id,email) select id,coalesce(email,'') from auth.users on conflict do nothing;

alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.entitlements enable row level security;
-- Browser roles receive no mutation permissions. All privileged writes pass through authenticated API.
revoke all on public.profiles,public.admins,public.products,public.orders,public.entitlements from anon,authenticated;
grant select on public.profiles,public.products,public.entitlements to authenticated;
grant select on public.products to anon;
grant all on public.profiles,public.admins,public.products,public.orders,public.entitlements to service_role;
create policy read_active_products on public.products for select to anon,authenticated using(active);
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy own_access on public.entitlements for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and not blocked));

create or replace function public.prepare_order(p_user_id uuid,p_product_id text,p_email text)
returns public.orders language plpgsql security definer set search_path='' as $$
declare p public.products; o public.orders;
begin
 -- Serialize checkout per customer, including rate limiting and entitlement checks.
 perform 1 from public.profiles where id=p_user_id for update;
 if not found or exists(select 1 from public.profiles where id=p_user_id and blocked) then raise exception 'ACCOUNT_BLOCKED';end if;
 select * into p from public.products where id=p_product_id and active and not is_free;
 if not found then raise exception 'PRODUCT_NOT_AVAILABLE';end if;
 if exists(select 1 from public.entitlements where user_id=p_user_id and product_id=p_product_id) then raise exception 'ALREADY_OWNED';end if;
 select * into o from public.orders where user_id=p_user_id and product_id=p_product_id and status='pending' and snap_token is not null and amount_idr=p.price_idr and created_at>now()-interval '23 hours' order by created_at desc limit 1;
 if found then return o;end if;
 if exists(select 1 from public.orders where user_id=p_user_id and created_at>now()-interval '10 seconds') or (select count(*) from public.orders where user_id=p_user_id and created_at>now()-interval '1 hour')>=10 then raise exception 'CHECKOUT_RATE_LIMIT';end if;
 insert into public.orders(user_id,product_id,product_title,amount_idr) values(p_user_id,p.id,p.title,p.price_idr) returning * into o;
 return o;
end $$;

create or replace function public.apply_payment(p_order_id text,p_amount bigint,p_status text,p_transaction_id text)
returns text language plpgsql security definer set search_path='' as $$
declare o public.orders; next_status text;
begin
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.amount_idr<>p_amount then raise exception 'PAYMENT_MISMATCH';end if;
 if p_status not in ('pending','paid','failed','refunded') or p_transaction_id is null or length(p_transaction_id)=0 then raise exception 'INVALID_PAYMENT';end if;
 if o.transaction_id is not null and o.transaction_id<>p_transaction_id then raise exception 'TRANSACTION_MISMATCH';end if;
 -- Lock access across separate orders for the same customer/product as well.
 perform pg_advisory_xact_lock(hashtextextended(o.user_id::text||':'||o.product_id,0));
 next_status:=case when o.status='refunded' then 'refunded' when p_status='refunded' then 'refunded' when o.status='paid' then 'paid' when p_status='paid' then 'paid' when o.status='failed' then 'failed' else p_status end;
 update public.orders set status=next_status,transaction_id=p_transaction_id,updated_at=now() where id=o.id;
 if exists(select 1 from public.orders where user_id=o.user_id and product_id=o.product_id and status='paid') then
   insert into public.entitlements(user_id,product_id) values(o.user_id,o.product_id) on conflict do nothing;
 else delete from public.entitlements where user_id=o.user_id and product_id=o.product_id;
 end if;
 return next_status;
end $$;
revoke all on function public.new_profile(),public.prepare_order(uuid,text,text),public.apply_payment(text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.prepare_order(uuid,text,text),public.apply_payment(text,bigint,text,text) to service_role;
insert into public.products(id,title,category,description,price_idr,is_free,active,storage_path) values
 ('shinko-gj-sim','Shinko GJ 80-25','Pump','Pompa sentrifugal dan sistem pendingin air laut.',0,true,true,null),
 ('tanabe-h74','Tanabe H-74','Compressor','Kompresor udara start dua tingkat.',29000,false,true,'tanabe-h74.html'),
 ('alfa-laval-mab206s','Alfa Laval MAB 206S-24','Purifier','Pelajari bowl, separasi, dan perawatan purifier.',39000,false,true,'alfa-laval-mab206s.html'),
 ('man-l2330h','MAN L23/30H Mk3','Engine','Eksplorasi generator dan komponen mesin kapal.',49000,false,true,'man-l2330h.html');
-- Private bucket. No browser policies: API fetches only after checking ownership.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('premium','premium',false,10485760,array['text/html']) on conflict(id) do update set public=false;
commit;
