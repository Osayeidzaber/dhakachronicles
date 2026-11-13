import "server-only";
import { createPublicClient } from "@/lib/supabase/server";
import type { Article, Author, Category, Lang, Media, Tag } from "@/lib/db/types";

/**
 * Public read API. This is the boundary the public frontend depends on:
 * a redesign only needs these functions, never raw tables.
 * Every query is restricted to published articles (and RLS enforces it again).
 */

const CARD_FIELDS: string = `
  id, translation_group_id, language, title, subtitle, slug, excerpt, published_at, updated_at,
  is_breaking, is_featured, featured_image_alt,
  featured_image:media!articles_featured_image_id_fkey(id, public_url, variants, width, height, alt_text_en, alt_text_bn),
  category:categories(id, slug, name_en, name_bn),
  author:authors(id, slug, name_en, name_bn)
`;

export type ArticleImage = Pick<Media, "id" | "public_url" | "variants" | "width" | "height" | "alt_text_en" | "alt_text_bn">;

export interface ArticleCard {
  id: string;
  translation_group_id: string;
  language: Lang;
  title: string;
  subtitle: string | null;
  slug: string;
  excerpt: string | null;
  published_at: string;
  updated_at: string;
  is_breaking: boolean;
  is_featured: boolean;
  featured_image_alt: string | null;
  featured_image: ArticleImage | null;
  category: Pick<Category, "id" | "slug" | "name_en" | "name_bn"> | null;
  author: Pick<Author, "id" | "slug" | "name_en" | "name_bn"> | null;
}

export interface ArticleDetail extends ArticleCard, Omit<Article, keyof ArticleCard | "category_id" | "author_id"> {
  category_id: string | null;
  author_id: string | null;
  og_image: ArticleImage | null;
  tags: Pick<Tag, "id" | "slug" | "name_en" | "name_bn">[];
  gallery: { position: number; caption: string | null; credit: string | null; media: ArticleImage }[];
  translations: { language: Lang; slug: string }[];
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function published<T extends { lte: (c: string, v: string) => T; eq: (c: string, v: string) => T }>(q: T): T {
  return q.eq("status", "published").lte("published_at", new Date().toISOString());
}

function paginate<T>(items: T[], total: number, page: number, pageSize: number): Page<T> {
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listLatest(lang: Lang, opts: { page?: number; pageSize?: number; categoryId?: string; authorId?: string; tagId?: string } = {}): Promise<Page<ArticleCard>> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, opts.pageSize ?? 12);
  const sb = createPublicClient();
  let articleIds: string[] | null = null;
  if (opts.tagId) {
    const { data } = await sb.from("article_tags").select("article_id").eq("tag_id", opts.tagId);
    articleIds = (data ?? []).map((r: { article_id: string }) => r.article_id);
    if (!articleIds.length) return paginate([], 0, page, pageSize);
  }
  let q = published(sb.from("articles").select(CARD_FIELDS, { count: "exact" }).eq("language", lang));
  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts.authorId) q = q.eq("author_id", opts.authorId);
  if (articleIds) q = q.in("id", articleIds);
  const { data, count, error } = await q
    .order("published_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return paginate((data ?? []) as unknown as ArticleCard[], count ?? 0, page, pageSize);
}

export async function listBreaking(lang: Lang, limit = 5): Promise<ArticleCard[]> {
  const sb = createPublicClient();
  const since = new Date(Date.now() - 48 * 3600_000).toISOString();
  const { data, error } = await published(sb.from("articles").select(CARD_FIELDS).eq("language", lang))
    .eq("is_breaking", true)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ArticleCard[];
}

export async function listFeatured(lang: Lang, limit = 4): Promise<ArticleCard[]> {
  const sb = createPublicClient();
  const { data, error } = await published(sb.from("articles").select(CARD_FIELDS).eq("language", lang))
    .eq("is_featured", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ArticleCard[];
}

export async function getPublishedArticle(lang: Lang, slug: string): Promise<ArticleDetail | null> {
  const sb = createPublicClient();
  const { data, error } = await published(
    sb
      .from("articles")
      .select(
        `*, ${CARD_FIELDS},
        og_image:media!articles_og_image_id_fkey(id, public_url, variants, width, height, alt_text_en, alt_text_bn),
        article_tags(tag:tags(id, slug, name_en, name_bn)),
        article_media(position, caption, credit, media:media(id, public_url, variants, width, height, alt_text_en, alt_text_bn))` as string,
      )
      .eq("language", lang)
      .eq("slug", slug),
  ).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as ArticleDetail & {
    article_tags: { tag: ArticleDetail["tags"][number] }[];
    article_media: ArticleDetail["gallery"];
  };
  const { data: tr } = await published(
    sb.from("articles").select("language, slug" as string).eq("translation_group_id", row.translation_group_id),
  );
  return {
    ...row,
    tags: row.article_tags.map((t) => t.tag).filter(Boolean),
    gallery: [...row.article_media].sort((a, b) => a.position - b.position),
    translations: (tr ?? []) as unknown as { language: Lang; slug: string }[],
  };
}

export async function listRelated(article: Pick<ArticleDetail, "id" | "language" | "category_id">, limit = 4): Promise<ArticleCard[]> {
  if (!article.category_id) return [];
  const sb = createPublicClient();
  const { data } = await published(sb.from("articles").select(CARD_FIELDS).eq("language", article.language))
    .eq("category_id", article.category_id)
    .neq("id", article.id)
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as ArticleCard[];
}

export async function searchArticles(lang: Lang, query: string, page = 1, pageSize = 12): Promise<Page<ArticleCard>> {
  const q = query.trim().slice(0, 100);
  if (!q) return paginate([], 0, page, pageSize);
  const sb = createPublicClient();
  const { data, count, error } = await published(sb.from("articles").select(CARD_FIELDS, { count: "exact" }).eq("language", lang))
    .textSearch("search_vector", q, { type: "websearch", config: "simple" })
    .order("published_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return paginate((data ?? []) as unknown as ArticleCard[], count ?? 0, page, pageSize);
}

export async function listCategories(): Promise<Category[]> {
  const { data } = await createPublicClient().from("categories").select("*").order("sort_order").order("name_en");
  return (data ?? []) as Category[];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data } = await createPublicClient().from("categories").select("*").eq("slug", slug).maybeSingle();
  return (data as Category) ?? null;
}

export async function getTagBySlug(slug: string): Promise<Tag | null> {
  const { data } = await createPublicClient().from("tags").select("*").eq("slug", slug).maybeSingle();
  return (data as Tag) ?? null;
}

export async function getAuthorBySlug(slug: string): Promise<(Author & { avatar: ArticleImage | null }) | null> {
  const { data } = await createPublicClient()
    .from("authors")
    .select("*, avatar:media(id, public_url, variants, width, height, alt_text_en, alt_text_bn)")
    .eq("slug", slug)
    .maybeSingle();
  return (data as (Author & { avatar: ArticleImage | null }) | null) ?? null;
}

/** For sitemaps/feeds: lightweight list of published articles. */
export async function listForSitemap(sinceIso?: string, limit = 5000) {
  const fields =
    "id, translation_group_id, language, slug, title, excerpt, published_at, updated_at, featured_image:media!articles_featured_image_id_fkey(public_url)";
  let q = createPublicClient()
    .from("articles")
    .select(fields as string)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString());
  if (sinceIso) q = q.gte("published_at", sinceIso);
  const { data, error } = await q.order("published_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as {
    id: string;
    translation_group_id: string;
    language: Lang;
    slug: string;
    title: string;
    excerpt: string | null;
    published_at: string;
    updated_at: string;
    featured_image: { public_url: string } | null;
  }[];
}

export async function getPublicSettings(): Promise<Record<string, unknown>> {
  const { data } = await createPublicClient().from("site_settings").select("setting_key, setting_value").eq("is_public", true);
  return Object.fromEntries((data ?? []).map((r: { setting_key: string; setting_value: unknown }) => [r.setting_key, r.setting_value]));
}
