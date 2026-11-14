import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { can, canEditArticle } from "@/lib/auth/permissions";
import { AppError, check } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { docToText } from "@/lib/content/tiptap";
import { slugify } from "@/lib/content/slug";
import { otherLang } from "@/lib/i18n";
import { revalidateArticle } from "@/lib/articles/revalidate";
import { planTransition } from "@/lib/articles/workflow";
import {
  articleInputSchema,
  transitionSchema,
  type ArticleInput,
  type TransitionInput,
} from "@/lib/articles/validation";
import type { Article, Lang } from "@/lib/db/types";

const EDITORIAL_ONLY = ["is_breaking", "is_featured"] as const;

function toRow(input: ArticleInput) {
  const { tag_ids: _tags, ...rest } = input;
  void _tags;
  return { ...rest, content_text: docToText(input.content) };
}

async function getForWrite(id: string): Promise<Article> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("articles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("Article not found.", "NOT_FOUND");
  return data as Article;
}

export async function assertSlugAvailable(language: Lang, slug: string, exceptId?: string) {
  const supabase = await createClient();
  let q = supabase.from("articles").select("id").eq("language", language).eq("slug", slug);
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q.limit(1);
  if (data && data.length > 0) throw new AppError(`The slug "${slug}" is already used in ${language}.`, "CONFLICT");
}

export async function createArticle(raw: unknown, translationGroupId?: string): Promise<Article> {
  const session = await requireSession("article.create");
  const input = articleInputSchema.parse(raw);
  await assertSlugAvailable(input.language, input.slug);

  const row: Record<string, unknown> = {
    ...toRow(input),
    status: "draft",
    created_by: session.userId,
    updated_by: session.userId,
  };
  if (translationGroupId) row.translation_group_id = translationGroupId;
  if (!can(session.profile.role, "article.publish")) for (const k of EDITORIAL_ONLY) row[k] = false;

  const supabase = await createClient();
  const article = check(await supabase.from("articles").insert(row).select("*").single()) as Article;
  if (input.tag_ids.length) {
    check(await supabase.rpc("set_article_tags", { p_article_id: article.id, p_tag_ids: input.tag_ids }));
  }
  await audit(session.userId, "article.create", "article", article.id, { language: article.language });
  return article;
}

export async function updateArticle(id: string, raw: unknown): Promise<Article> {
  const session = await requireSession();
  const existing = await getForWrite(id);
  if (!canEditArticle(session.profile.role, session.userId, existing)) {
    throw new AppError("You cannot edit this article.", "FORBIDDEN");
  }
  const input = articleInputSchema.parse(raw);
  if (input.language !== existing.language) throw new AppError("Language cannot be changed; create a translation instead.", "VALIDATION");
  if (input.slug !== existing.slug) await assertSlugAvailable(input.language, input.slug, id);

  const row: Record<string, unknown> = { ...toRow(input), updated_by: session.userId };
  if (!can(session.profile.role, "article.publish")) for (const k of EDITORIAL_ONLY) delete row[k];

  const supabase = await createClient();
  const article = check(await supabase.from("articles").update(row).eq("id", id).select("*").single()) as Article;
  check(await supabase.rpc("set_article_tags", { p_article_id: id, p_tag_ids: input.tag_ids }));

  await audit(session.userId, "article.update", "article", id);
  if (article.status === "published" || existing.slug !== article.slug) revalidateArticle(existing);
  if (article.status === "published") revalidateArticle(article);
  return article;
}

export async function transitionArticle(id: string, raw: TransitionInput | unknown): Promise<Article> {
  const session = await requireSession();
  const input = transitionSchema.parse(raw);
  const existing = await getForWrite(id);
  if (!canEditArticle(session.profile.role, session.userId, existing)) {
    throw new AppError("You cannot change this article.", "FORBIDDEN");
  }
  const plan = planTransition(existing.status, input, session.profile.role, session.userId);
  // Instagram stories keep the time the post was made on Instagram, not the time an editor approved it.
  if (plan.patch.published_at) {
    const { data: src } = await (await createClient()).from("instagram_imports").select("media_timestamp").eq("article_id", id).maybeSingle();
    if (src?.media_timestamp && new Date(src.media_timestamp).getTime() <= Date.now()) plan.patch.published_at = src.media_timestamp;
  }

  if (plan.status === "published" || plan.status === "scheduled") {
    if (!existing.title.trim() || !existing.content_text.trim()) {
      throw new AppError("An article needs a title and body before it can be published.", "VALIDATION");
    }
  }

  const supabase = await createClient();
  const article = check(
    await supabase
      .from("articles")
      .update({ ...plan.patch, updated_by: session.userId })
      .eq("id", id)
      .select("*")
      .single(),
  ) as Article;

  await audit(session.userId, plan.auditAction, "article", id, { from: existing.status, to: article.status });
  if (input.action === "submit") {
    const admin = (await import("@/lib/supabase/admin")).createAdminClient();
    await admin.rpc("notify_editors", {
      p_type: "review_requested",
      p_title: "Article submitted for review",
      p_body: article.title,
      p_link: `/admin/articles/${id}`,
    });
  }
  revalidateArticle(article);
  const kind =
    article.status === "published" && existing.status !== "published"
      ? "published"
      : article.status === "pending_review" && existing.status !== "pending_review"
        ? "submitted"
        : article.status === "scheduled" && existing.status !== "scheduled"
          ? "scheduled"
          : existing.status === "published" && article.status === "archived"
            ? "archived"
            : existing.status === "published" && article.status !== "published"
              ? "unpublished"
              : null;
  if (kind) {
    const { notifyArticle } = await import("@/lib/discord");
    const { siteUrl } = await import("@/lib/env");
    const { articlePath } = await import("@/lib/seo/defaults");
    const live = kind === "published";
    const admin = (await import("@/lib/supabase/admin")).createAdminClient();
    const { data: extra } = await admin
      .from("articles")
      .select("category:categories(name_en, name_bn), featured_image:media!articles_featured_image_id_fkey(public_url)")
      .eq("id", id)
      .maybeSingle();
    const cat = (extra?.category ?? null) as { name_en?: string; name_bn?: string } | null;
    await notifyArticle({
      imageUrl: (extra?.featured_image as { public_url?: string } | null)?.public_url ?? null,
      section: (article.language === "bn" ? cat?.name_bn : cat?.name_en) ?? null,
      kind,
      title: article.title,
      excerpt: article.excerpt,
      language: article.language,
      actor: session.profile.full_name || session.email || "Staff",
      scheduledFor: kind === "scheduled" ? article.scheduled_at : null,
      url: live ? `${siteUrl()}${articlePath(article.language, article.slug)}` : `${siteUrl()}/admin/articles/${id}`,
      siteUrl: live ? `${siteUrl()}${articlePath(article.language, article.slug)}` : null,
      adminUrl: `${siteUrl()}/admin/articles/${id}`,
      sourceUrl: article.source_type === "instagram" ? article.source_url : null,
    });
  }
  return article;
}

/** Create the other-language version of a story as a new draft in the same translation group. */
export async function createTranslation(id: string): Promise<Article> {
  const source = await getForWrite(id);
  const target = otherLang(source.language);
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("articles")
    .select("id")
    .eq("translation_group_id", source.translation_group_id)
    .eq("language", target)
    .maybeSingle();
  if (existing) throw new AppError(`A ${target} translation already exists.`, "CONFLICT");

  const base = slugify(source.slug) || "article";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data } = await supabase.from("articles").select("id").eq("language", target).eq("slug", slug).limit(1);
    if (!data?.length) break;
    slug = `${base}-${i}`;
  }

  const { data: tags } = await supabase.from("article_tags").select("tag_id").eq("article_id", id);
  return createArticle(
    {
      language: target,
      title: source.title,
      subtitle: source.subtitle,
      slug,
      excerpt: null,
      content: { type: "doc", content: [] },
      featured_image_id: source.featured_image_id,
      featured_image_alt: null,
      category_id: source.category_id,
      author_id: source.author_id,
      tag_ids: (tags ?? []).map((t: { tag_id: string }) => t.tag_id),
      is_breaking: false,
      is_featured: false,
    },
    source.translation_group_id,
  );
}

export async function deleteArticle(id: string): Promise<void> {
  const session = await requireSession("article.delete");
  const existing = await getForWrite(id);
  const supabase = await createClient();
  check(await supabase.from("articles").delete().eq("id", id));
  await audit(session.userId, "article.delete", "article", id, { title: existing.title });
  revalidateArticle(existing);
}

export async function restoreRevision(articleId: string, revisionId: string): Promise<Article> {
  const session = await requireSession();
  const existing = await getForWrite(articleId);
  if (!canEditArticle(session.profile.role, session.userId, existing)) throw new AppError("Forbidden", "FORBIDDEN");
  const supabase = await createClient();
  const { data: rev } = await supabase
    .from("article_revisions")
    .select("*")
    .eq("id", revisionId)
    .eq("article_id", articleId)
    .maybeSingle();
  if (!rev) throw new AppError("Revision not found.", "NOT_FOUND");
  const meta = rev.metadata_snapshot as Record<string, unknown>;
  const article = check(
    await supabase
      .from("articles")
      .update({
        content: rev.content_snapshot,
        content_text: docToText(rev.content_snapshot),
        title: meta.title,
        subtitle: meta.subtitle,
        excerpt: meta.excerpt,
        updated_by: session.userId,
      })
      .eq("id", articleId)
      .select("*")
      .single(),
  ) as Article;
  await audit(session.userId, "article.restore_revision", "article", articleId, { revisionId });
  if (article.status === "published") revalidateArticle(article);
  return article;
}

export type BulkAction = "archive" | "publish" | "return_to_draft" | "delete" | "feature" | "unfeature";

export async function bulkArticles(ids: string[], action: BulkAction): Promise<{ done: number; failed: string[] }> {
  const failed: string[] = [];
  let done = 0;
  for (const id of ids.slice(0, 100)) {
    try {
      if (action === "delete") await deleteArticle(id);
      else if (action === "feature" || action === "unfeature") await setFeatured(id, action === "feature");
      else await transitionArticle(id, { action });
      done++;
    } catch (err) {
      failed.push(`${id}: ${err instanceof Error ? err.message : "error"}`);
    }
  }
  return { done, failed };
}

/** Editors: put a story in (or take it out of) the home page Featured column. */
export async function setFeatured(id: string, featured: boolean): Promise<void> {
  const session = await requireSession("article.publish");
  const supabase = await createClient();
  const { data, error } = await supabase.from("articles").update({ is_featured: featured }).eq("id", id).select("id, language, slug").single();
  if (error) throw error;
  await audit(session.userId, featured ? "article.feature" : "article.unfeature", "article", id);
  revalidateArticle(data as { language: Lang; slug: string });
}
