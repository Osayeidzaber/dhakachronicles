import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Lang } from "@/lib/db/types";

export type Range = "today" | "7d" | "30d";

export interface SeriesPoint {
  label: string;
  current: number;
  previous: number;
}

export interface TopArticle {
  id: string;
  title: string;
  slug: string;
  language: Lang;
  category: string | null;
  views: number;
  previous: number;
  live: number;
  imageUrl: string | null;
}

export interface DashboardData {
  live: { total: number; byArticle: Map<string, number> };
  views: { current: number; previous: number };
  publishedInRange: { current: number; previous: number };
  series: SeriesPoint[];
  top: TopArticle[];
  byCategory: { name: string; views: number }[];
  language: { bn: number; en: number };
  pipeline: Record<string, number>;
  instagram: { connected: boolean; username: string | null; imported: number; published: number; failed: number; lastSync: string | null; mode: string };
  storage: { bytes: number; files: number; instagramFiles: number; originalBytes: number };
  activity: { id: string; action: string; target: string | null; at: string; who: string; avatar: string | null; meta: Record<string, unknown> }[];
}

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Percentage change; null when there is no baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Dates (YYYY-MM-DD) covered by a range and by the period just before it. */
export function rangeDays(range: Range, now = new Date()): { current: string[]; previous: string[] } {
  const n = range === "today" ? 1 : range === "7d" ? 7 : 30;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = (offset: number) => Array.from({ length: n }, (_, i) => iso(new Date(start - (offset + n - 1 - i) * DAY)));
  return { current: days(0), previous: days(n) };
}

export async function getDashboardData(range: Range): Promise<DashboardData> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { current, previous } = rangeDays(range);
  const from = previous[0];
  const now = new Date();
  const startCurrent = new Date(`${current[0]}T00:00:00Z`);
  const startPrevious = new Date(`${previous[0]}T00:00:00Z`);

  const [liveRes, dailyRes, hourlyRes, pubRes, statusRes, igAccRes, igImpRes, mediaRes, auditRes] = await Promise.all([
    supabase.rpc("live_readers"),
    supabase.from("article_daily_views").select("article_id, view_date, views").gte("view_date", from),
    range === "today"
      ? supabase.from("site_hourly_views").select("hour, language, views").gte("hour", new Date(startCurrent.getTime() - DAY).toISOString())
      : supabase.from("site_hourly_views").select("hour, language, views").gte("hour", startPrevious.toISOString()),
    supabase.from("articles").select("published_at").eq("status", "published").gte("published_at", startPrevious.toISOString()),
    supabase.rpc("article_status_counts"),
    supabase.from("instagram_accounts").select("username, status, last_successful_sync_at, import_mode").limit(1).maybeSingle(),
    supabase.from("instagram_imports").select("status, article:articles(status)"),
    admin.from("media").select("file_size, variants, source"),
    supabase
      .from("audit_logs")
      .select("id, action, target_type, created_at, metadata, user:profiles(full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  // Live readers
  const liveJson = (liveRes.data ?? { total: 0, articles: [] }) as { total: number; articles: { article_id: string; readers: number }[] };
  const byArticle = new Map(liveJson.articles.map((a) => [a.article_id, a.readers]));

  // Views per article in each period
  const daily = (dailyRes.data ?? []) as { article_id: string; view_date: string; views: number }[];
  const cur = new Set(current);
  const per = new Map<string, { c: number; p: number }>();
  let viewsCur = 0;
  let viewsPrev = 0;
  for (const r of daily) {
    const e = per.get(r.article_id) ?? { c: 0, p: 0 };
    if (cur.has(r.view_date)) {
      e.c += r.views;
      viewsCur += r.views;
    } else {
      e.p += r.views;
      viewsPrev += r.views;
    }
    per.set(r.article_id, e);
  }

  // Chart series
  const hourly = (hourlyRes.data ?? []) as { hour: string; language: Lang; views: number }[];
  let series: SeriesPoint[];
  const lang = { bn: 0, en: 0 };
  if (range === "today") {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, "0")}:00`, current: 0, previous: 0 }));
    for (const r of hourly) {
      const t = new Date(r.hour);
      const h = t.getUTCHours();
      if (t >= startCurrent) {
        buckets[h].current += r.views;
        lang[r.language] += r.views;
      } else buckets[h].previous += r.views;
    }
    series = buckets.slice(0, now.getUTCHours() + 1);
  } else {
    const byDay = new Map<string, number>();
    for (const r of daily) byDay.set(r.view_date, (byDay.get(r.view_date) ?? 0) + r.views);
    series = current.map((d, i) => ({ label: d.slice(5), current: byDay.get(d) ?? 0, previous: byDay.get(previous[i]) ?? 0 }));
    for (const r of hourly) if (new Date(r.hour) >= startCurrent) lang[r.language] += r.views;
  }

  // Top articles (by views in range, then live readers)
  const ids = [...new Set([...[...per.entries()].sort((a, b) => b[1].c - a[1].c).slice(0, 10).map(([id]) => id), ...byArticle.keys()])].slice(0, 15);
  let top: TopArticle[] = [];
  const byCategory = new Map<string, number>();
  if (ids.length) {
    const { data } = await supabase
      .from("articles")
      .select("id, title, slug, language, category:categories(name_en), featured_image:media!articles_featured_image_id_fkey(public_url)")
      .in("id", ids);
    top = ((data ?? []) as unknown as {
      id: string;
      title: string;
      slug: string;
      language: Lang;
      category: { name_en: string } | null;
      featured_image: { public_url: string } | null;
    }[]).map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      language: a.language,
      category: a.category?.name_en ?? null,
      views: per.get(a.id)?.c ?? 0,
      previous: per.get(a.id)?.p ?? 0,
      live: byArticle.get(a.id) ?? 0,
      imageUrl: a.featured_image?.public_url ?? null,
    }));
    top.sort((a, b) => b.views - a.views || b.live - a.live);
    for (const a of top) if (a.category) byCategory.set(a.category, (byCategory.get(a.category) ?? 0) + a.views);
  }

  const published = (pubRes.data ?? []) as { published_at: string }[];
  const pubCur = published.filter((p) => new Date(p.published_at) >= startCurrent).length;

  const pipeline: Record<string, number> = {};
  for (const r of (statusRes.data ?? []) as { status: string; total: number }[]) pipeline[r.status] = Number(r.total);

  const imports = (igImpRes.data ?? []) as unknown as { status: string; article: { status: string } | null }[];
  const media = (mediaRes.data ?? []) as { file_size: number; variants: { size?: number }[] | null; source: string }[];

  return {
    live: { total: liveJson.total ?? 0, byArticle },
    views: { current: viewsCur, previous: viewsPrev },
    publishedInRange: { current: pubCur, previous: published.length - pubCur },
    series,
    top: top.slice(0, 8),
    byCategory: [...byCategory.entries()].map(([name, views]) => ({ name, views })).sort((a, b) => b.views - a.views).slice(0, 6),
    language: lang,
    pipeline,
    instagram: {
      connected: igAccRes.data?.status === "connected",
      username: (igAccRes.data?.username as string | undefined) ?? null,
      imported: imports.filter((i) => i.status === "imported").length,
      published: imports.filter((i) => i.article?.status === "published").length,
      failed: imports.filter((i) => i.status === "failed").length,
      lastSync: (igAccRes.data?.last_successful_sync_at as string | undefined) ?? null,
      mode: (igAccRes.data?.import_mode as string | undefined) ?? "draft",
    },
    storage: {
      bytes: media.reduce((s, m) => s + (m.file_size ?? 0) + (m.variants ?? []).reduce((v, x) => v + (x.size ?? 0), 0), 0),
      originalBytes: media.reduce((s, m) => s + (m.file_size ?? 0), 0),
      files: media.length,
      instagramFiles: media.filter((m) => m.source === "instagram").length,
    },
    activity: ((auditRes.data ?? []) as unknown as {
      id: string;
      action: string;
      target_type: string;
      created_at: string;
      metadata: Record<string, unknown>;
      user: { full_name: string; avatar_url: string | null } | null;
    }[]).map((a) => ({
      id: a.id,
      action: a.action,
      target: a.target_type,
      at: a.created_at,
      who: a.user?.full_name || "System",
      avatar: a.user?.avatar_url ?? null,
      meta: a.metadata ?? {},
    })),
  };
}

/** Human sentence for an audit action. */
export function describeActivity(action: string, meta: Record<string, unknown>): string {
  const t = typeof meta.title === "string" ? `“${meta.title}”` : "";
  const map: Record<string, string> = {
    "article.create": `created an article ${t}`,
    "article.update": `edited an article ${t}`,
    "article.publish": `published an article ${t}`,
    "article.schedule": `scheduled an article ${t}`,
    "article.submit": `sent an article for review ${t}`,
    "article.archive": `archived an article ${t}`,
    "article.delete": `deleted an article ${t}`,
    "instagram.sync": "ran an Instagram sync",
    "instagram.connect": "connected Instagram",
    "instagram.disconnect": "disconnected Instagram",
    "instagram.mode": `set Instagram imports to ${meta.mode === "publish" ? "publish automatically" : "save as drafts"}`,
    "team.invite": `invited ${typeof meta.email === "string" ? meta.email : "a member"}`,
    "team.create": `created an account for ${typeof meta.email === "string" ? meta.email : "a member"}`,
    "team.update": "updated a team member",
    "profile.update": "updated their profile",
    "highlight.set": `highlighted ${t || "a story"} on the homepage`,
    "highlight.clear": "cleared the homepage highlight",
    "settings.update": "changed site settings",
    "discord.update": "changed Discord notifications",
    "media.upload": "uploaded media",
    "media.delete": "deleted media",
  };
  return (map[action] ?? action.replace(/[._]/g, " ")).trim();
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}
