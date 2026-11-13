-- =============================================================================
-- Transactional workflow functions (each call runs in a single transaction).
-- =============================================================================

-- Replace an article's tags atomically. Runs as the caller, so RLS applies.
create or replace function public.set_article_tags(p_article_id uuid, p_tag_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.article_tags where article_id = p_article_id;
  insert into public.article_tags (article_id, tag_id)
  select p_article_id, unnest(coalesce(p_tag_ids, '{}'))
  on conflict do nothing;
end;
$$;
grant execute on function public.set_article_tags(uuid, uuid[]) to authenticated;

-- Publish every scheduled article whose time has come. Safe under concurrent
-- runs (SKIP LOCKED). Called by the cron endpoint with the service role.
create or replace function public.publish_due_articles()
returns table (id uuid, language public.content_language, slug text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select a.id from public.articles a
    where a.status = 'scheduled' and a.scheduled_at <= now()
    order by a.scheduled_at
    for update skip locked
    limit 200
  )
  update public.articles a
     set status = 'published',
         published_at = coalesce(a.scheduled_at, now())
    from due
   where a.id = due.id
  returning a.id, a.language, a.slug;
end;
$$;
revoke execute on function public.publish_due_articles() from public, anon, authenticated;

-- Create a draft article from an Instagram import (service role only).
create or replace function public.create_instagram_draft(
  p_import_id uuid,
  p_language public.content_language,
  p_title text,
  p_slug text,
  p_content jsonb,
  p_content_text text,
  p_media_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_article_id uuid;
  v_import public.instagram_imports;
begin
  select * into v_import from public.instagram_imports where id = p_import_id for update;
  if not found then raise exception 'import % not found', p_import_id; end if;
  if v_import.article_id is not null then return v_import.article_id; end if;

  insert into public.articles (language, title, slug, excerpt, content, content_text,
                               featured_image_id, status, source_type, source_url)
  values (p_language, p_title, p_slug, left(coalesce(v_import.caption, ''), 280), p_content, p_content_text,
          p_media_ids[1], 'draft', 'instagram', v_import.permalink)
  returning id into v_article_id;

  insert into public.article_media (article_id, media_id, position)
  select v_article_id, m, ord - 1 from unnest(p_media_ids) with ordinality as t(m, ord);

  update public.instagram_imports
     set article_id = v_article_id, status = 'imported', imported_at = now(), error_message = null
   where id = p_import_id;

  perform public.notify_editors('instagram_import', 'New Instagram post imported', p_title,
                                '/admin/articles/' || v_article_id);
  return v_article_id;
end;
$$;
revoke execute on function public.create_instagram_draft(uuid, public.content_language, text, text, jsonb, text, uuid[]) from public, anon, authenticated;

-- Dashboard counters in one round trip.
create or replace function public.article_status_counts()
returns table (status public.article_status, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select status, count(*) from public.articles group by status;
$$;
grant execute on function public.article_status_counts() to authenticated;

-- Default settings
insert into public.site_settings (setting_key, setting_value, is_public) values
  ('site_name', '{"en": "Dhaka Chronicles", "bn": "ঢাকা ক্রনিকলস"}', true),
  ('default_language', '"bn"', true),
  ('logo_media_id', 'null', true),
  ('social_links', '{"instagram": "https://www.instagram.com/dhakachronicles/"}', true),
  ('seo_defaults', '{"title_suffix": " | Dhaka Chronicles", "description_en": "", "description_bn": ""}', true),
  ('instagram', '{"expected_username": "dhakachronicles", "auto_publish": false}', false)
on conflict (setting_key) do nothing;
