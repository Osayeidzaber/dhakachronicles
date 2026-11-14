-- Public "most read" list: article ids only (no view counts exposed), published only.
create or replace function public.most_read(p_language text, p_days integer, p_limit integer)
returns table (article_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select v.article_id
  from public.article_daily_views v
  join public.articles a on a.id = v.article_id
  where a.status = 'published'
    and a.language::text = p_language
    and v.view_date >= current_date - greatest(1, least(p_days, 31))
  group by v.article_id
  order by sum(v.views) desc
  limit greatest(1, least(p_limit, 20));
$$;
grant execute on function public.most_read(text, integer, integer) to anon, authenticated;
