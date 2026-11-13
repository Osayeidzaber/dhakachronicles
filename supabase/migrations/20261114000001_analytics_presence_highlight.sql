-- Live readers, hourly analytics, per-account last-seen, Instagram import mode.

-- ---------------------------------------------------------------------------
-- Live readers: one row per anonymous browser session, refreshed by a heartbeat.
-- No IP or user data is stored; session_id is a random id kept in sessionStorage.
create table public.reader_presence (
  session_id text primary key check (length(session_id) between 16 and 64),
  article_id uuid references public.articles (id) on delete set null,
  language text check (language in ('bn', 'en')),
  last_seen timestamptz not null default now()
);
create index reader_presence_seen_idx on public.reader_presence (last_seen);
alter table public.reader_presence enable row level security;
-- No policies: written only through reader_heartbeat(), read only by staff functions.

create or replace function public.reader_heartbeat(p_session text, p_article_id uuid, p_language text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.reader_presence (session_id, article_id, language, last_seen)
  values (p_session, p_article_id, case when p_language in ('bn', 'en') then p_language end, now())
  on conflict (session_id) do update
    set article_id = excluded.article_id, language = excluded.language, last_seen = now();
$$;
revoke all on function public.reader_heartbeat(text, uuid, text) from public;
grant execute on function public.reader_heartbeat(text, uuid, text) to anon, authenticated, service_role;

-- Readers active in the last 90 seconds (staff only).
-- Returns {"total": n, "articles": [{"article_id", "readers"}...]}; null for non-staff.
create or replace function public.live_readers()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select article_id from public.reader_presence where last_seen > now() - interval '90 seconds'
  )
  select case when public.is_staff() then jsonb_build_object(
    'total', (select count(*) from live),
    'articles', coalesce((
      select jsonb_agg(jsonb_build_object('article_id', article_id, 'readers', n) order by n desc)
      from (select article_id, count(*) as n from live where article_id is not null group by article_id order by n desc limit 20) t
    ), '[]'::jsonb)
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- Hourly site-wide views by language, for the dashboard chart.
create table public.site_hourly_views (
  hour timestamptz not null,
  language text not null check (language in ('bn', 'en')),
  views integer not null default 0,
  primary key (hour, language)
);
alter table public.site_hourly_views enable row level security;
create policy hourly_views_read on public.site_hourly_views for select to authenticated using (public.is_staff());

create or replace function public.record_article_view(p_article_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lang text;
begin
  select language::text into v_lang from public.articles where id = p_article_id and status = 'published';
  if v_lang is null then
    return;
  end if;
  insert into public.article_daily_views (article_id, view_date, views)
  values (p_article_id, current_date, 1)
  on conflict (article_id, view_date) do update set views = public.article_daily_views.views + 1;
  insert into public.site_hourly_views (hour, language, views)
  values (date_trunc('hour', now()), v_lang, 1)
  on conflict (hour, language) do update set views = public.site_hourly_views.views + 1;
end;
$$;

-- Staff can read per-article daily views (dashboard top lists), not just editors.
drop policy if exists views_read on public.article_daily_views;
create policy views_read on public.article_daily_views for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Accounts: last activity time shown on the team page.
alter table public.profiles add column last_seen_at timestamptz;

-- ---------------------------------------------------------------------------
-- Instagram: what happens to a newly imported post.
alter table public.instagram_accounts
  add column import_mode text not null default 'draft' check (import_mode in ('draft', 'publish'));
