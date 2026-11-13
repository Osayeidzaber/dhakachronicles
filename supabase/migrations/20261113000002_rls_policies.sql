-- =============================================================================
-- Row Level Security. Public visitors only ever see published content.
-- The service role bypasses RLS (used only server-side: cron, Instagram, provisioning).
-- =============================================================================

-- Current user's role (NULL for anonymous / no-access accounts).
create or replace function public.app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_staff() returns boolean
language sql stable as $$ select public.app_role() is not null; $$;

create or replace function public.is_editor() returns boolean
language sql stable as $$ select public.app_role() in ('admin', 'editor'); $$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.app_role() = 'admin'; $$;

-- Users must never escalate their own role.
create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'only admins can change roles' using errcode = '42501';
  end if;
  if new.id = auth.uid() and new.role is distinct from old.role then
    raise exception 'you cannot change your own role' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.profiles_guard_role();

alter table public.profiles enable row level security;
alter table public.media enable row level security;
alter table public.authors enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.articles enable row level security;
alter table public.article_tags enable row level security;
alter table public.article_media enable row level security;
alter table public.article_revisions enable row level security;
alter table public.instagram_accounts enable row level security;
alter table public.instagram_tokens enable row level security;      -- no policies: service role only
alter table public.oauth_states enable row level security;          -- no policies: service role only
alter table public.instagram_sync_runs enable row level security;
alter table public.instagram_imports enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.site_settings enable row level security;
alter table public.article_daily_views enable row level security;
alter table public.rate_limits enable row level security;           -- no policies: service role only
alter table public.job_runs enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Taxonomy & authors: public read, editors write
create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy categories_write on public.categories for all to authenticated
  using (public.is_editor()) with check (public.is_editor());
create policy tags_read on public.tags for select to anon, authenticated using (true);
create policy tags_write on public.tags for all to authenticated
  using (public.is_editor()) with check (public.is_editor());
create policy authors_read on public.authors for select to anon, authenticated using (true);
create policy authors_write on public.authors for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

-- media: public read of ready media; staff upload; editors manage everything; writers their own
create policy media_read on public.media for select to anon, authenticated
  using (status = 'ready' or public.is_staff());
create policy media_insert on public.media for insert to authenticated
  with check (public.is_staff() and uploaded_by = auth.uid());
create policy media_update on public.media for update to authenticated
  using (public.is_editor() or uploaded_by = auth.uid())
  with check (public.is_editor() or uploaded_by = auth.uid());
create policy media_delete on public.media for delete to authenticated
  using (public.is_editor() or (uploaded_by = auth.uid() and public.is_staff()));

-- articles
create policy articles_public_read on public.articles for select to anon, authenticated
  using (status = 'published' and published_at <= now());
create policy articles_staff_read on public.articles for select to authenticated
  using (public.is_editor() or (public.is_staff() and created_by = auth.uid()));
create policy articles_insert on public.articles for insert to authenticated
  with check (
    public.is_staff() and created_by = auth.uid()
    and (public.is_editor() or status in ('draft', 'pending_review'))
  );
create policy articles_update_editor on public.articles for update to authenticated
  using (public.is_editor()) with check (public.is_editor());
create policy articles_update_writer on public.articles for update to authenticated
  using (public.app_role() = 'writer' and created_by = auth.uid() and status in ('draft', 'pending_review'))
  with check (created_by = auth.uid() and status in ('draft', 'pending_review'));
create policy articles_delete on public.articles for delete to authenticated
  using (public.is_admin());

-- Writers cannot flip editorial flags on their own drafts.
create or replace function public.articles_guard_writer_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and public.app_role() = 'writer' then
    new.is_breaking := false;
    new.is_featured := false;
    new.published_at := null;
    new.scheduled_at := null;
    new.reviewed_by := null;
  end if;
  return new;
end;
$$;
create trigger articles_guard_writer_fields before insert or update on public.articles
  for each row execute function public.articles_guard_writer_fields();

-- article_tags / article_media follow the parent article's visibility & editability
create policy article_tags_read on public.article_tags for select to anon, authenticated
  using (exists (select 1 from public.articles a where a.id = article_id));
create policy article_tags_write on public.article_tags for all to authenticated
  using (exists (select 1 from public.articles a where a.id = article_id
    and (public.is_editor() or (a.created_by = auth.uid() and a.status in ('draft','pending_review')))))
  with check (exists (select 1 from public.articles a where a.id = article_id
    and (public.is_editor() or (a.created_by = auth.uid() and a.status in ('draft','pending_review')))));
create policy article_media_read on public.article_media for select to anon, authenticated
  using (exists (select 1 from public.articles a where a.id = article_id));
create policy article_media_write on public.article_media for all to authenticated
  using (exists (select 1 from public.articles a where a.id = article_id
    and (public.is_editor() or (a.created_by = auth.uid() and a.status in ('draft','pending_review')))))
  with check (exists (select 1 from public.articles a where a.id = article_id
    and (public.is_editor() or (a.created_by = auth.uid() and a.status in ('draft','pending_review')))));

-- revisions: readable by whoever can read the staff view of the article
create policy revisions_read on public.article_revisions for select to authenticated
  using (public.is_staff() and exists (select 1 from public.articles a where a.id = article_id));

-- Instagram: editors view, admins manage connection
create policy ig_accounts_read on public.instagram_accounts for select to authenticated using (public.is_editor());
create policy ig_accounts_admin on public.instagram_accounts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy ig_runs_read on public.instagram_sync_runs for select to authenticated using (public.is_editor());
create policy ig_imports_read on public.instagram_imports for select to authenticated using (public.is_editor());

-- notifications: own only
create policy notifications_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit logs: staff may append their own entries, only admins read
create policy audit_insert on public.audit_logs for insert to authenticated
  with check (public.is_staff() and user_id = auth.uid());
create policy audit_read on public.audit_logs for select to authenticated using (public.is_admin());

-- settings
create policy settings_public_read on public.site_settings for select to anon, authenticated
  using (is_public or public.is_admin());
create policy settings_admin_write on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- analytics & jobs
create policy views_read on public.article_daily_views for select to authenticated using (public.is_editor());
create policy job_runs_read on public.job_runs for select to authenticated using (public.is_admin());

-- Function execution grants
revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.notify_editors(text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_article_view(uuid) to anon, authenticated;
