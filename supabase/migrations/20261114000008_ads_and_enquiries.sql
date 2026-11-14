-- Ads become their own thing (separate from brand deals): several image sizes per ad,
-- daily impression/click counts, a private shareable report link, and advertiser enquiries.

create table public.ads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  advertiser text not null check (char_length(btrim(advertiser)) between 1 and 160),
  brand_deal_id uuid references public.brand_deals (id) on delete set null,
  link_url text not null check (link_url ~* '^https://'),
  placement text not null default 'home' check (placement in ('home', 'article', 'both')),
  starts_on date,
  ends_on date,
  active boolean not null default true,
  -- Unguessable token for the advertiser's read-only stats page (/ad-report/<token>).
  report_token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ads_window check (starts_on is null or ends_on is null or starts_on <= ends_on)
);
create trigger ads_updated_at before update on public.ads for each row execute function public.set_updated_at();

-- One image per size. wide = desktop banner (1200x300), mobile = phone banner (640x320), square = in-article (600x600).
create table public.ad_creatives (
  ad_id uuid not null references public.ads (id) on delete cascade,
  size text not null check (size in ('wide', 'mobile', 'square')),
  media_id uuid not null references public.media (id) on delete restrict,
  primary key (ad_id, size)
);

create table public.ad_stats (
  ad_id uuid not null references public.ads (id) on delete cascade,
  day date not null,
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  primary key (ad_id, day)
);

alter table public.ads enable row level security;
alter table public.ad_creatives enable row level security;
alter table public.ad_stats enable row level security;

create policy ads_read on public.ads for select to authenticated using (public.is_editor());
create policy ads_write on public.ads for insert to authenticated with check (public.is_editor());
create policy ads_update on public.ads for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy ads_delete on public.ads for delete to authenticated using (public.is_admin());
create policy ad_creatives_read on public.ad_creatives for select to authenticated using (public.is_editor());
create policy ad_creatives_write on public.ad_creatives for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy ad_stats_read on public.ad_stats for select to authenticated using (public.is_editor());
revoke all on public.ads, public.ad_creatives, public.ad_stats from anon;

-- Move any ads set up on brand deals last release, then retire those columns.
insert into public.ads (name, advertiser, brand_deal_id, link_url, placement, starts_on, ends_on, active)
select d.brand_name, d.brand_name, d.id, d.ad_link_url, d.ad_placement, d.ad_starts, d.ad_ends, d.ad_enabled
from public.brand_deals d where d.ad_media_id is not null and d.ad_link_url is not null;
insert into public.ad_creatives (ad_id, size, media_id)
select a.id, 'wide', d.ad_media_id from public.ads a join public.brand_deals d on d.id = a.brand_deal_id where d.ad_media_id is not null;

drop function if exists public.active_ads(text);
alter table public.brand_deals
  drop constraint if exists brand_deals_ad_window,
  drop constraint if exists brand_deals_ad_needs_creative,
  drop column if exists ad_enabled,
  drop column if exists ad_media_id,
  drop column if exists ad_link_url,
  drop column if exists ad_placement,
  drop column if exists ad_starts,
  drop column if exists ad_ends;

create or replace function public.ad_is_live(a public.ads) returns boolean
language sql stable set search_path = public as $$
  select a.active
    and (a.starts_on is null or a.starts_on <= (now() at time zone 'Asia/Dhaka')::date)
    and (a.ends_on is null or a.ends_on >= (now() at time zone 'Asia/Dhaka')::date);
$$;

-- Public: ads running now for a placement, with their creatives. No tokens, no deal data.
create or replace function public.live_ads(p_placement text)
returns table (id uuid, advertiser text, link_url text, creatives jsonb)
language sql stable security definer set search_path = public as $$
  select a.id, a.advertiser, a.link_url,
    coalesce((select jsonb_agg(jsonb_build_object('size', c.size, 'media_id', c.media_id)) from public.ad_creatives c where c.ad_id = a.id), '[]'::jsonb)
  from public.ads a
  where public.ad_is_live(a) and (a.placement = p_placement or a.placement = 'both')
    and exists (select 1 from public.ad_creatives c where c.ad_id = a.id)
  order by a.updated_at desc
  limit 4;
$$;

-- Public: count an impression or click for a live ad (anything else is ignored).
create or replace function public.record_ad_event(p_ad_id uuid, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Dhaka')::date;
begin
  if p_kind not in ('impression', 'click') then return; end if;
  if not exists (select 1 from public.ads a where a.id = p_ad_id and public.ad_is_live(a)) then return; end if;
  insert into public.ad_stats (ad_id, day, impressions, clicks)
  values (p_ad_id, d, (p_kind = 'impression')::int, (p_kind = 'click')::int)
  on conflict (ad_id, day) do update set
    impressions = public.ad_stats.impressions + excluded.impressions,
    clicks = public.ad_stats.clicks + excluded.clicks;
end;
$$;

-- Public with the token only: the advertiser's report.
create or replace function public.ad_report(p_token text)
returns table (name text, advertiser text, placement text, starts_on date, ends_on date, live boolean, stats jsonb)
language sql stable security definer set search_path = public as $$
  select a.name, a.advertiser, a.placement, a.starts_on, a.ends_on, public.ad_is_live(a),
    coalesce((select jsonb_agg(jsonb_build_object('day', s.day, 'impressions', s.impressions, 'clicks', s.clicks) order by s.day)
              from public.ad_stats s where s.ad_id = a.id), '[]'::jsonb)
  from public.ads a
  where length(p_token) >= 32 and a.report_token = p_token;
$$;

-- Public: "advertise with us" form becomes a lead in Brand deals.
create or replace function public.submit_ad_enquiry(p_name text, p_company text, p_email text, p_phone text, p_format text, p_budget text, p_message text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if char_length(btrim(coalesce(p_company, ''))) not between 1 and 200 then raise exception 'company required'; end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'valid email required'; end if;
  insert into public.brand_deals (brand_name, contact_name, contact_email, stage, deliverables, notes, created_by)
  values (
    btrim(p_company), left(nullif(btrim(p_name), ''), 200), btrim(p_email), 'lead', left(nullif(btrim(p_format), ''), 2000),
    left(concat_ws(E'\n', 'Website enquiry', 'Phone: ' || nullif(btrim(p_phone), ''), 'Budget: ' || nullif(btrim(p_budget), ''), nullif(btrim(p_message), '')), 5000),
    null
  ) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.live_ads(text), public.record_ad_event(uuid, text), public.ad_report(text),
  public.submit_ad_enquiry(text, text, text, text, text, text, text) from public;
grant execute on function public.live_ads(text), public.record_ad_event(uuid, text), public.ad_report(text),
  public.submit_ad_enquiry(text, text, text, text, text, text, text) to anon, authenticated;
