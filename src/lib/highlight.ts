import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import type { Lang } from "@/lib/db/types";

/** The story pinned to the homepage lead slot, stored in site_settings("homepage_highlight"). */
export const highlightSchema = z.object({
  article_id: z.uuid(),
  until: z.iso.datetime({ offset: true }).nullable().default(null),
  set_by: z.uuid().nullable().default(null),
  set_at: z.iso.datetime({ offset: true }).nullable().default(null),
  /** true when chosen by the engagement ranking; a manual pin always wins over it. */
  auto: z.boolean().default(false),
});
export type Highlight = z.infer<typeof highlightSchema>;

/** Active highlight or null (expired ones are ignored). */
export function activeHighlight(raw: unknown, now = new Date()): Highlight | null {
  const parsed = highlightSchema.safeParse(raw);
  if (!parsed.success) return null;
  if (parsed.data.until && new Date(parsed.data.until) <= now) return null;
  return parsed.data;
}

export async function readHighlight(): Promise<Highlight | null> {
  const { data } = await createPublicClient().from("site_settings").select("setting_value").eq("setting_key", "homepage_highlight").maybeSingle();
  return activeHighlight(data?.setting_value);
}

/**
 * The highlighted story's id for a language: the story itself, or its translation
 * in that language when the pinned one is in the other language.
 */
export async function highlightedArticleId(lang: Lang): Promise<string | null> {
  const h = await readHighlight();
  if (!h) return null;
  const sb = createPublicClient();
  const { data: a } = await sb.from("articles").select("id, language, translation_group_id").eq("id", h.article_id).eq("status", "published").maybeSingle();
  if (!a) return null;
  if (a.language === lang) return a.id as string;
  const { data: t } = await sb
    .from("articles")
    .select("id")
    .eq("translation_group_id", a.translation_group_id)
    .eq("language", lang)
    .eq("status", "published")
    .maybeSingle();
  return (t?.id as string | undefined) ?? null;
}

export async function setHighlight(userId: string, articleId: string, until: string | null) {
  const value: Highlight = { article_id: articleId, until, set_by: userId, set_at: new Date().toISOString(), auto: false };
  const { error } = await createAdminClient()
    .from("site_settings")
    .upsert({ setting_key: "homepage_highlight", setting_value: value, is_public: true, updated_by: userId }, { onConflict: "setting_key" });
  if (error) throw error;
}

export async function clearHighlight(userId: string) {
  const { error } = await createAdminClient()
    .from("site_settings")
    .upsert({ setting_key: "homepage_highlight", setting_value: {}, is_public: true, updated_by: userId }, { onConflict: "setting_key" });
  if (error) throw error;
}

export interface PickResult {
  id: string;
  title: string;
  language: Lang;
  status: string;
  source: "article" | "instagram";
  meta: string;
  imageUrl: string | null;
}

/** Search stories to highlight: by headline/slug, or by Instagram caption. */
export async function searchForHighlight(q: string, source: "article" | "instagram"): Promise<PickResult[]> {
  const sb = await createClient();
  const term = q.trim().replace(/[%_,()]/g, " ").slice(0, 80);
  if (source === "instagram") {
    let query = sb
      .from("instagram_imports")
      .select("caption, media_timestamp, article:articles(id, title, language, status, featured_image:media!articles_featured_image_id_fkey(public_url))")
      .not("article_id", "is", null)
      .order("media_timestamp", { ascending: false })
      .limit(12);
    if (term) query = query.ilike("caption", `%${term}%`);
    const { data } = await query;
    return ((data ?? []) as unknown as {
      caption: string | null;
      media_timestamp: string | null;
      article: { id: string; title: string; language: Lang; status: string; featured_image: { public_url: string } | null } | null;
    }[])
      .filter((r) => r.article)
      .map((r) => ({
        id: r.article!.id,
        title: r.article!.title,
        language: r.article!.language,
        status: r.article!.status,
        source: "instagram" as const,
        meta: `Instagram · ${r.article!.status}${r.media_timestamp ? ` · posted ${r.media_timestamp.slice(0, 10)}` : ""}`,
        imageUrl: r.article!.featured_image?.public_url ?? null,
      }));
  }
  let query = sb
    .from("articles")
    .select("id, title, language, status, published_at, category:categories(name_en), featured_image:media!articles_featured_image_id_fkey(public_url)")
    .order("updated_at", { ascending: false })
    .limit(12);
  if (term) query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%`);
  const { data } = await query;
  return ((data ?? []) as unknown as {
    id: string;
    title: string;
    language: Lang;
    status: string;
    published_at: string | null;
    category: { name_en: string } | null;
    featured_image: { public_url: string } | null;
  }[]).map((a) => ({
    id: a.id,
    title: a.title,
    language: a.language,
    status: a.status,
    source: "article" as const,
    meta: [a.category?.name_en, a.language === "bn" ? "বাংলা" : "English", a.status].filter(Boolean).join(" · "),
    imageUrl: a.featured_image?.public_url ?? null,
  }));
}
