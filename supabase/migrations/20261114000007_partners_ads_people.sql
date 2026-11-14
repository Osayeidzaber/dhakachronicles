-- Public side of brand deals (partner showcase + ad placements) and editable public team.

-- 1. Brand deals: what may be shown publicly. Fees, contacts and notes stay staff-only.
alter table public.brand_deals
  add column if not exists show_on_site boolean not null default false,
  add column if not exists logo_media_id uuid references public.media (id) on delete set null,
  add column if not exists website_url text check (website_url is null or website_url ~* '^https://'),
  add column if not exists public_blurb text check (public_blurb is null or char_length(public_blurb) <= 300),
  add column if not exists proof_url text check (proof_url is null or proof_url ~* '^https://'),
  add column if not exists ad_enabled boolean not null default false,
  add column if not exists ad_media_id uuid references public.media (id) on delete set null,
  add column if not exists ad_link_url text check (ad_link_url is null or ad_link_url ~* '^https://'),
  add column if not exists ad_placement text not null default 'home' check (ad_placement in ('home', 'article', 'both')),
  add column if not exists ad_starts date,
  add column if not exists ad_ends date;

alter table public.brand_deals
  add constraint brand_deals_ad_window check (ad_starts is null or ad_ends is null or ad_starts <= ad_ends),
  add constraint brand_deals_ad_needs_creative check (not ad_enabled or (ad_media_id is not null and ad_link_url is not null));

-- Anonymous readers never touch the table; they call these, which return safe columns only.
create or replace function public.public_partners()
returns table (id uuid, brand_name text, website_url text, public_blurb text, proof_url text, logo_media_id uuid)
language sql stable security definer set search_path = public as $$
  select d.id, d.brand_name, d.website_url, d.public_blurb, d.proof_url, d.logo_media_id
  from public.brand_deals d
  where d.show_on_site and d.stage <> 'cancelled'
  order by d.updated_at desc
  limit 60;
$$;

create or replace function public.active_ads(p_placement text)
returns table (id uuid, brand_name text, ad_link_url text, ad_media_id uuid)
language sql stable security definer set search_path = public as $$
  select d.id, d.brand_name, d.ad_link_url, d.ad_media_id
  from public.brand_deals d
  where d.ad_enabled
    and d.stage <> 'cancelled'
    and (d.ad_placement = p_placement or d.ad_placement = 'both')
    and (d.ad_starts is null or d.ad_starts <= (now() at time zone 'Asia/Dhaka')::date)
    and (d.ad_ends is null or d.ad_ends >= (now() at time zone 'Asia/Dhaka')::date)
  order by d.updated_at desc
  limit 3;
$$;

revoke all on function public.public_partners() from public;
revoke all on function public.active_ads(text) from public;
grant execute on function public.public_partners() to anon, authenticated;
grant execute on function public.active_ads(text) to anon, authenticated;

-- 2. People shown on the public Team page, edited by admins (not generated from staff accounts).
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  name_en text not null check (char_length(btrim(name_en)) between 1 and 120),
  name_bn text check (name_bn is null or char_length(name_bn) <= 120),
  role_en text check (role_en is null or char_length(role_en) <= 120),
  role_bn text check (role_bn is null or char_length(role_bn) <= 120),
  bio_en text check (bio_en is null or char_length(bio_en) <= 600),
  bio_bn text check (bio_bn is null or char_length(bio_bn) <= 600),
  photo_media_id uuid references public.media (id) on delete set null,
  author_id uuid references public.authors (id) on delete set null,
  instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  sort_order integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index team_members_order_idx on public.team_members (sort_order, name_en);
create trigger team_members_updated_at before update on public.team_members
  for each row execute function public.set_updated_at();

alter table public.team_members enable row level security;
create policy team_members_public_read on public.team_members for select to anon, authenticated
  using (visible or public.is_editor());
create policy team_members_insert on public.team_members for insert to authenticated with check (public.is_admin());
create policy team_members_update on public.team_members for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy team_members_delete on public.team_members for delete to authenticated using (public.is_admin());
