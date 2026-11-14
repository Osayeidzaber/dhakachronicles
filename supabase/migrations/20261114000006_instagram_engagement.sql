-- Instagram engagement, used to feature the week's most popular posts automatically.
alter table public.instagram_imports
  add column if not exists like_count integer not null default 0 check (like_count >= 0),
  add column if not exists comments_count integer not null default 0 check (comments_count >= 0),
  -- true when the story was put in Featured by the engagement ranking (not by an editor),
  -- so the ranking only ever removes stories it added itself.
  add column if not exists auto_featured boolean not null default false;

create index if not exists instagram_imports_engagement_idx
  on public.instagram_imports (media_timestamp desc) where article_id is not null;
