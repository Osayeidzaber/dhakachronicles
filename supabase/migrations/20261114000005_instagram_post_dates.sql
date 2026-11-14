-- Published Instagram stories should be dated when the post was made on Instagram,
-- not when it was imported or approved. Backfill the stories imported so far.
update public.articles a
set published_at = i.media_timestamp,
    first_published_at = least(coalesce(a.first_published_at, i.media_timestamp), i.media_timestamp)
from public.instagram_imports i
where i.article_id = a.id
  and a.source_type = 'instagram'
  and a.status = 'published'
  and i.media_timestamp is not null
  and i.media_timestamp <= now()
  and a.published_at is distinct from i.media_timestamp;
