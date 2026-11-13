-- =============================================================================
-- Core schema for the bilingual news platform.
-- Tables, constraints, indexes and triggers. RLS lives in the next migration.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'editor', 'writer');
create type public.content_language as enum ('bn', 'en');
create type public.article_status as enum ('draft', 'pending_review', 'scheduled', 'published', 'archived');
create type public.media_status as enum ('pending', 'ready', 'failed');
create type public.instagram_import_status as enum ('pending', 'processing', 'imported', 'failed', 'skipped');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users). role NULL = account exists but has no CMS access.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  role public.app_role,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- media (Cloudflare R2 objects)
-- ---------------------------------------------------------------------------
create table public.media (
  id uuid primary key default gen_random_uuid(),
  r2_key text not null unique,
  public_url text not null,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  alt_text_en text,
  alt_text_bn text,
  caption text,
  credit text,
  folder text not null default 'uploads',
  status public.media_status not null default 'pending',
  -- responsive variants: [{ "key": "...", "url": "...", "width": 640, "format": "webp", "size": 1234 }]
  variants jsonb not null default '[]'::jsonb,
  source text not null default 'upload' check (source in ('upload', 'instagram')),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_created_at_idx on public.media (created_at desc);
create index media_status_idx on public.media (status);
create trigger media_updated_at before update on public.media
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- authors (public bylines; optionally linked to a staff profile)
-- ---------------------------------------------------------------------------
create table public.authors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null,
  name_bn text not null,
  bio_en text,
  bio_bn text,
  avatar_media_id uuid references public.media (id) on delete set null,
  email text,
  social_links jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger authors_updated_at before update on public.authors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories / tags
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null,
  name_bn text not null,
  description_en text,
  description_bn text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null,
  name_bn text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- articles: one row per language; translations share translation_group_id
-- ---------------------------------------------------------------------------
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  translation_group_id uuid not null default gen_random_uuid(),
  language public.content_language not null,
  title text not null check (char_length(title) between 1 and 300),
  subtitle text,
  -- Slugs allow Unicode letters (Bangla) and digits separated by single hyphens.
  slug text not null check (slug ~ '^[[:alnum:]ঀ-৿]+(-[[:alnum:]ঀ-৿]+)*$' and char_length(slug) <= 200),
  excerpt text,
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_text text not null default '',
  featured_image_id uuid references public.media (id) on delete set null,
  featured_image_alt text,
  category_id uuid references public.categories (id) on delete set null,
  author_id uuid references public.authors (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  status public.article_status not null default 'draft',
  is_breaking boolean not null default false,
  is_featured boolean not null default false,
  seo_title text,
  seo_description text,
  focus_keyword text,
  canonical_url text,
  og_title text,
  og_description text,
  og_image_id uuid references public.media (id) on delete set null,
  source_type text not null default 'original' check (source_type in ('original', 'instagram')),
  source_url text,
  published_at timestamptz,
  first_published_at timestamptz,
  scheduled_at timestamptz,
  submitted_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(subtitle, '') || ' ' || coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(content_text, '')), 'C')
  ) stored,
  constraint articles_language_slug_key unique (language, slug),
  constraint articles_translation_language_key unique (translation_group_id, language),
  constraint articles_scheduled_requires_date check (status <> 'scheduled' or scheduled_at is not null),
  constraint articles_published_requires_date check (status <> 'published' or published_at is not null)
);
create index articles_public_listing_idx on public.articles (language, status, published_at desc);
create index articles_category_idx on public.articles (category_id, language, published_at desc);
create index articles_author_idx on public.articles (author_id, language, published_at desc);
create index articles_created_by_idx on public.articles (created_by);
create index articles_status_updated_idx on public.articles (status, updated_at desc);
create index articles_due_schedule_idx on public.articles (scheduled_at) where status = 'scheduled';
create index articles_breaking_idx on public.articles (language, published_at desc) where is_breaking and status = 'published';
create index articles_featured_idx on public.articles (language, published_at desc) where is_featured and status = 'published';
create index articles_search_idx on public.articles using gin (search_vector);
create index articles_translation_group_idx on public.articles (translation_group_id);

-- Keep timestamps truthful regardless of which code path changes status.
create or replace function public.articles_before_write()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  if new.status = 'published' then
    if new.published_at is null then
      new.published_at := now();
    end if;
    if new.first_published_at is null then
      new.first_published_at := new.published_at;
    end if;
    new.scheduled_at := null;
    new.archived_at := null;
  elsif new.status = 'pending_review' and (tg_op = 'INSERT' or old.status is distinct from 'pending_review') then
    new.submitted_at := now();
  elsif new.status = 'archived' and (tg_op = 'INSERT' or old.status is distinct from 'archived') then
    new.archived_at := now();
  end if;

  if new.status <> 'archived' then
    new.archived_at := null;
  end if;
  return new;
end;
$$;
create trigger articles_before_write before insert or update on public.articles
  for each row execute function public.articles_before_write();

create table public.article_tags (
  article_id uuid not null references public.articles (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (article_id, tag_id)
);
create index article_tags_tag_idx on public.article_tags (tag_id);

create table public.article_media (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete restrict,
  position integer not null default 0,
  caption text,
  credit text,
  created_at timestamptz not null default now(),
  unique (article_id, media_id)
);
create index article_media_media_idx on public.article_media (media_id);
create index article_media_article_pos_idx on public.article_media (article_id, position);

-- ---------------------------------------------------------------------------
-- article_revisions: snapshots captured automatically before significant edits
-- ---------------------------------------------------------------------------
create table public.article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  content_snapshot jsonb not null,
  metadata_snapshot jsonb not null,
  editor_id uuid references public.profiles (id) on delete set null,
  reason text not null default 'edit',
  created_at timestamptz not null default now()
);
create index article_revisions_article_idx on public.article_revisions (article_id, created_at desc);

-- Snapshot OLD before significant edits. To avoid one revision per autosave,
-- content-only edits are snapshotted at most every 10 minutes; status changes
-- and title changes always snapshot.
create or replace function public.articles_capture_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_rev timestamptz;
  reason text;
begin
  if old.status is distinct from new.status then
    reason := 'status:' || old.status::text || '->' || new.status::text;
  elsif old.title is distinct from new.title then
    reason := 'title';
  elsif old.content is distinct from new.content then
    select max(created_at) into last_rev from public.article_revisions where article_id = old.id;
    if last_rev is not null and last_rev > now() - interval '10 minutes' then
      return new;
    end if;
    reason := 'content';
  else
    return new;
  end if;

  insert into public.article_revisions (article_id, content_snapshot, metadata_snapshot, editor_id, reason)
  values (
    old.id,
    old.content,
    jsonb_build_object(
      'title', old.title, 'subtitle', old.subtitle, 'slug', old.slug, 'excerpt', old.excerpt,
      'status', old.status, 'seo_title', old.seo_title, 'seo_description', old.seo_description,
      'focus_keyword', old.focus_keyword, 'canonical_url', old.canonical_url,
      'featured_image_id', old.featured_image_id, 'category_id', old.category_id,
      'author_id', old.author_id, 'published_at', old.published_at, 'updated_at', old.updated_at
    ),
    coalesce(auth.uid(), new.updated_by),
    reason
  );
  return new;
end;
$$;
create trigger articles_capture_revision before update on public.articles
  for each row execute function public.articles_capture_revision();

-- ---------------------------------------------------------------------------
-- Media deletion guard: never delete media used by a published article.
-- ---------------------------------------------------------------------------
create or replace function public.media_published_references(p_media_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.articles a
  where a.status in ('published', 'scheduled')
    and (
      a.featured_image_id = p_media_id
      or a.og_image_id = p_media_id
      or exists (select 1 from public.article_media am where am.article_id = a.id and am.media_id = p_media_id)
      or a.content::text like '%' || p_media_id::text || '%'
    );
$$;

create or replace function public.media_guard_delete()
returns trigger
language plpgsql
as $$
begin
  if public.media_published_references(old.id) > 0 then
    raise exception 'media % is referenced by a published or scheduled article', old.id
      using errcode = 'P0001', hint = 'MEDIA_IN_USE';
  end if;
  -- Draft gallery links are removed with the media row.
  delete from public.article_media where media_id = old.id;
  return old;
end;
$$;
create trigger media_guard_delete before delete on public.media
  for each row execute function public.media_guard_delete();

-- ---------------------------------------------------------------------------
-- Instagram integration
-- ---------------------------------------------------------------------------
create table public.instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text not null unique,
  username text not null,
  account_type text,
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'token_expired', 'error', 'username_mismatch')),
  auto_import boolean not null default false,
  token_expires_at timestamptz,
  token_refreshed_at timestamptz,
  last_synced_at timestamptz,
  last_successful_sync_at timestamptz,
  last_error text,
  initial_import_completed boolean not null default false,
  connected_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger instagram_accounts_updated_at before update on public.instagram_accounts
  for each row execute function public.set_updated_at();

-- Encrypted tokens. RLS enabled with NO policies: only the service role can read.
create table public.instagram_tokens (
  account_id uuid primary key references public.instagram_accounts (id) on delete cascade,
  encrypted_access_token text not null,
  scopes text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Short-lived OAuth state values (CSRF protection for the Instagram Login flow).
create table public.oauth_states (
  state text primary key,
  provider text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.instagram_sync_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.instagram_accounts (id) on delete cascade,
  trigger text not null check (trigger in ('manual', 'cron', 'initial', 'retry')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'partial', 'failed')),
  options jsonb not null default '{}'::jsonb,
  fetched_count integer not null default 0,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  started_by uuid references public.profiles (id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index instagram_sync_runs_started_idx on public.instagram_sync_runs (started_at desc);
-- At most one running sync per account (prevents overlapping cron/manual runs).
create unique index instagram_sync_runs_one_running on public.instagram_sync_runs (account_id) where status = 'running';

create table public.instagram_imports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.instagram_accounts (id) on delete set null,
  instagram_media_id text not null unique,
  media_type text not null,
  caption text,
  permalink text,
  media_timestamp timestamptz,
  raw_metadata jsonb not null default '{}'::jsonb,
  status public.instagram_import_status not null default 'pending',
  article_id uuid references public.articles (id) on delete set null,
  error_message text,
  attempts integer not null default 0,
  next_retry_at timestamptz,
  sync_run_id uuid references public.instagram_sync_runs (id) on delete set null,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index instagram_imports_status_idx on public.instagram_imports (status, next_retry_at);
create index instagram_imports_timestamp_idx on public.instagram_imports (media_timestamp desc);
create trigger instagram_imports_updated_at before update on public.instagram_imports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Notifications (dashboard inbox)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

-- Fan out a notification to every active editor and admin.
create or replace function public.notify_editors(p_type text, p_title text, p_body text, p_link text)
returns integer
language sql
security definer
set search_path = public
as $$
  with ins as (
    insert into public.notifications (user_id, type, title, body, link)
    select id, p_type, p_title, p_body, p_link from public.profiles
    where role in ('admin', 'editor') and is_active
    returning 1
  )
  select count(*)::integer from ins;
$$;

-- ---------------------------------------------------------------------------
-- audit_logs, site_settings, analytics, rate limiting, job runs
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id);

create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null,
  is_public boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

create table public.article_daily_views (
  article_id uuid not null references public.articles (id) on delete cascade,
  view_date date not null default current_date,
  views integer not null default 0,
  primary key (article_id, view_date)
);

create or replace function public.record_article_view(p_article_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.article_daily_views (article_id, view_date, views)
  select a.id, current_date, 1 from public.articles a
  where a.id = p_article_id and a.status = 'published'
  on conflict (article_id, view_date) do update set views = public.article_daily_views.views + 1;
$$;

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);

-- Fixed-window counter; returns true when the call is allowed.
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  result jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index job_runs_name_idx on public.job_runs (job_name, started_at desc);

-- ---------------------------------------------------------------------------
-- Profile provisioning: profiles are created for every auth user, but the role
-- comes ONLY from app_metadata (settable exclusively with the service role).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
begin
  begin
    v_role := (new.raw_app_meta_data ->> 'role')::public.app_role;
  exception when others then
    v_role := null;
  end;
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), v_role)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
