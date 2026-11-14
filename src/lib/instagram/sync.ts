import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { instagramConfig } from "@/lib/env";
import { AppError, check } from "@/lib/errors";
import { log } from "@/lib/logger";
import { ingestImage, ingestVideo } from "@/lib/media/service";
import { mapLimit } from "@/lib/concurrency";
import { buildFolder } from "@/lib/media/validation";
import { docToText } from "@/lib/content/tiptap";
import { decryptSecret } from "@/lib/instagram/crypto";
import {
  InstagramApiError,
  getMedia,
  igMediaSchema,
  imageSources,
  videoSources,
  isAllowedMediaHost,
  listMedia,
  type IgMedia,
} from "@/lib/instagram/client";
import { detectLanguage, draftContent, draftSlug, draftTitle } from "@/lib/instagram/draft";
import type { InstagramAccount, Lang } from "@/lib/db/types";
import { notifyAlert, notifyArticle } from "@/lib/discord";
import { audit } from "@/lib/audit";
import { revalidateArticle } from "@/lib/articles/revalidate";
import { articlePath } from "@/lib/seo/defaults";
import { siteUrl } from "@/lib/env";

export const syncOptionsSchema = z.object({
  maxPosts: z.coerce.number().int().min(1).max(1000).default(50),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
  maxPages: z.coerce.number().int().min(1).max(40).default(4),
  since: z.iso.date().optional(),
  until: z.iso.date().optional(),
});
export type SyncOptions = z.infer<typeof syncOptionsSchema>;

export const MAX_ATTEMPTS = 5;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
/** Parallel downloads per post, and posts processed at once. */
const MEDIA_CONCURRENCY = 4;
const POST_CONCURRENCY = 3;

/** Exponential backoff for failed imports: 5m, 20m, 80m, 5h20m. */
export function nextRetryAt(attempts: number, now = new Date()): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  return new Date(now.getTime() + 5 * 60_000 * 4 ** (attempts - 1));
}

/** Split fetched posts into new ones vs. already-imported ones (duplicate detection by media id). */
export function partitionNew<T extends { id: string }>(items: T[], knownIds: Iterable<string>): { fresh: T[]; duplicates: T[] } {
  const known = new Set(knownIds);
  const seen = new Set<string>();
  const fresh: T[] = [];
  const duplicates: T[] = [];
  for (const item of items) {
    if (known.has(item.id) || seen.has(item.id)) duplicates.push(item);
    else {
      seen.add(item.id);
      fresh.push(item);
    }
  }
  return { fresh, duplicates };
}

type Admin = ReturnType<typeof createAdminClient>;

export async function getConnectedAccount(admin: Admin): Promise<{ account: InstagramAccount; token: string; appSecret: string } | null> {
  const cfg = instagramConfig();
  if (!cfg) return null;
  const { data: account } = await admin.from("instagram_accounts").select("*").order("created_at").limit(1).maybeSingle();
  if (!account) return null;
  const { data: tok } = await admin.from("instagram_tokens").select("encrypted_access_token").eq("account_id", account.id).maybeSingle();
  if (!tok) return null;
  return { account: account as InstagramAccount, token: decryptSecret(tok.encrypted_access_token, cfg.encryptionKey), appSecret: cfg.appSecret };
}

/**
 * System-user tokens normally never expire (no refresh API needed). If the
 * configuration set an expiry and it has passed, mark the account for reconnect.
 */
export async function ensureTokenValid(admin: Admin, account: InstagramAccount): Promise<void> {
  if (!account.token_expires_at || new Date(account.token_expires_at).getTime() > Date.now()) return;
  await admin.from("instagram_accounts").update({ status: "token_expired", last_error: "Access token expired. Reconnect the account." }).eq("id", account.id);
  throw new AppError("Instagram token expired. Reconnect the account.", "UNAUTHORIZED");
}

async function download(url: string, maxBytes = MAX_IMAGE_BYTES, timeoutMs = 30_000): Promise<Buffer> {
  if (!isAllowedMediaHost(url)) throw new Error("Media URL is not on an Instagram CDN host.");
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  if (!res.ok) throw new Error(`Media download failed (${res.status}).`);
  if (!isAllowedMediaHost(res.url || url)) throw new Error("Media redirected away from the Instagram CDN.");
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new Error("Media file is too large.");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error("Media file is too large.");
  return buf;
}

/**
 * After the draft exists: publish it when the account is in "publish" mode,
 * then tell Discord either way.
 */
async function finishImport(admin: Admin, articleId: string, accountId: string | null, permalink: string | null, publish?: boolean, categoryId?: string | null) {
  let mode = publish === undefined ? "draft" : publish ? "publish" : "draft";
  if (publish === undefined && accountId) {
    const { data } = await admin.from("instagram_accounts").select("import_mode").eq("id", accountId).maybeSingle();
    mode = (data?.import_mode as string | undefined) ?? "draft";
  }
  const { data: art } = await admin
    .from("articles")
    .update({ ...(mode === "publish" ? { status: "published" } : {}), ...(categoryId ? { category_id: categoryId } : {}) })
    .eq("id", articleId)
    .select("id, language, slug, title, excerpt, content_text, status, category:categories(name_en, name_bn), featured_image:media!articles_featured_image_id_fkey(public_url)")
    .single();
  if (!art) return;
  const image = (art.featured_image as { public_url?: string } | null)?.public_url ?? null;
  const cat = art.category as { name_en?: string; name_bn?: string } | null;
  const section = (art.language === "bn" ? cat?.name_bn : cat?.name_en) ?? null;
  const excerpt = (art.excerpt as string | null) ?? (((art.content_text as string | null) ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || null);
  if (art.status === "published") {
    revalidateArticle({ language: art.language as Lang, slug: art.slug as string });
    await notifyArticle({
      kind: "instagram_published",
      title: art.title as string,
      excerpt,
      section,
      actor: "Instagram import",
      language: art.language as Lang,
      url: `${siteUrl()}${articlePath(art.language as Lang, art.slug as string)}`,
      siteUrl: `${siteUrl()}${articlePath(art.language as Lang, art.slug as string)}`,
      adminUrl: `${siteUrl()}/admin/articles/${art.id}`,
      imageUrl: image,
      sourceUrl: permalink ?? null,
    });
  } else {
    await notifyArticle({
      kind: "instagram_imported",
      title: art.title as string,
      excerpt,
      section,
      actor: "Instagram import",
      language: art.language as Lang,
      url: `${siteUrl()}/admin/articles/${art.id}`,
      adminUrl: `${siteUrl()}/admin/articles/${art.id}`,
      imageUrl: image,
      sourceUrl: permalink ?? null,
    });
  }
}

/** Process one import row end to end: media → R2, then an atomic draft creation. */
export async function processImport(admin: Admin, importId: string, publish?: boolean, categoryId?: string | null): Promise<"imported" | "failed" | "skipped"> {
  const { data: row } = await admin.from("instagram_imports").select("*").eq("id", importId).single();
  if (!row || row.status === "imported") return "imported";
  const attempts = (row.attempts as number) + 1;
  await admin.from("instagram_imports").update({ status: "processing", attempts, error_message: null }).eq("id", importId);

  try {
    const media = igMediaSchema.parse(row.raw_metadata);
    const sources = imageSources(media);
    const videos = videoSources(media);
    const ts = media.timestamp;
    const folder = buildFolder("instagram");
    const failures: string[] = [];

    // Images (and video covers) download in parallel, in carousel order.
    const imageResults = await mapLimit(sources, MEDIA_CONCURRENCY, async (src) => {
      const bytes = await download(src.url);
      return ingestImage(bytes, { filename: `instagram-${src.id}.jpg`, folder, source: "instagram", caption: null });
    });
    const mediaIds: string[] = [];
    const coverBySource = new Map<string, string>();
    imageResults.forEach((r, i) => {
      if (r.status === "fulfilled") {
        mediaIds.push(r.value.id);
        coverBySource.set(sources[i].id, r.value.public_url);
      } else failures.push(`${sources[i].id}: ${r.reason instanceof Error ? r.reason.message : "error"}`);
    });

    // Videos (reels, video posts, carousel videos) are copied to R2 so they keep playing after Instagram's links expire.
    const videoResults = await mapLimit(videos, 2, async (v) => {
      const bytes = await download(v.url, MAX_VIDEO_BYTES, 120_000);
      const poster = coverBySource.get(v.id) ?? null;
      const m = await ingestVideo(bytes, { filename: `instagram-${v.id}.mp4`, folder, posterUrl: poster });
      return { src: m.public_url, poster, mediaId: m.id };
    });
    const draftVideos = videoResults.flatMap((r, i) => {
      if (r.status === "fulfilled") return [r.value];
      failures.push(`video ${videos[i].id}: ${r.reason instanceof Error ? r.reason.message : "error"}`);
      return [];
    });
    if (sources.length + videos.length > 0 && mediaIds.length === 0 && draftVideos.length === 0) throw new Error(`No media could be imported. ${failures.join("; ")}`);

    const caption = media.caption ?? "";
    const title = draftTitle(caption, ts);
    const content = draftContent(caption, media.permalink, draftVideos);
    const articleId = check(
      await admin.rpc("create_instagram_draft", {
        p_import_id: importId,
        p_language: detectLanguage(caption),
        p_title: title,
        p_slug: draftSlug(title, media.id),
        p_content: content,
        p_content_text: docToText(content),
        p_media_ids: mediaIds,
      }),
    );
    if (failures.length) {
      await admin.from("instagram_imports").update({ error_message: `Imported with skipped media: ${failures.join("; ")}` }).eq("id", importId);
    }
    await finishImport(admin, String(articleId), row.account_id as string | null, media.permalink ?? null, publish, categoryId);
    await audit(null, publish ? "instagram.imported_published" : "instagram.imported", "article", String(articleId), {
      post: media.id,
      type: media.media_type,
      posted: ts.slice(0, 16).replace("T", " "),
      images: mediaIds.length,
      videos: draftVideos.length,
      skipped_media: failures.length,
      attempt: attempts,
    });
    return "imported";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const retry = nextRetryAt(attempts);
    await admin
      .from("instagram_imports")
      .update({ status: "failed", error_message: message.slice(0, 1000), next_retry_at: retry?.toISOString() ?? null })
      .eq("id", importId);
    log.warn("instagram.import_failed", { importId, attempts, message });
    await audit(null, "instagram.import_failed", "instagram_import", importId, { attempt: attempts, error: message.slice(0, 300), will_retry: retry ? "yes" : "no (gave up)" });
    const permalink = (row.permalink as string | null) ?? null;
    if (!retry) await notifyArticle({ kind: "instagram_failed", title: "Instagram import failed", error: message.slice(0, 500), url: `${siteUrl()}/admin/instagram?tab=failed`, adminUrl: `${siteUrl()}/admin/instagram?tab=failed`, sourceUrl: permalink });
    await notifyAlert({
      title: retry ? "Instagram post failed to import (will retry)" : "Instagram post gave up after 5 attempts",
      detail: message.slice(0, 800),
      severity: retry ? "warning" : "critical",
      source: "instagram.import",
      url: `${siteUrl()}/admin/instagram?tab=failed`,
      fields: { Attempt: `${attempts} of ${MAX_ATTEMPTS}`, "Next try": retry ? retry.toISOString().slice(0, 16).replace("T", " ") + " UTC" : "none", Post: permalink },
    });
    return "failed";
  }
}

export interface SyncResult {
  runId: string;
  fetched: number;
  imported: number;
  skipped: number;
  failed: number;
}

/**
 * Fetch posts (paginated, newest first), register new ones, import them,
 * then retry earlier failures that are due. One sync per account at a time.
 */
export async function runSync(trigger: "manual" | "cron" | "initial" | "retry", opts: Partial<SyncOptions> = {}, startedBy: string | null = null): Promise<SyncResult> {
  const options = syncOptionsSchema.parse(opts);
  const admin = createAdminClient();
  const conn = await getConnectedAccount(admin);
  if (!conn) throw new AppError("No Instagram account is connected.", "NOT_CONFIGURED");
  const { account } = conn;
  if (account.status === "username_mismatch") throw new AppError("Connected account is not the expected account.", "FORBIDDEN");

  // Clear runs stuck for >30 minutes (crashed function) so the lock is released.
  await admin
    .from("instagram_sync_runs")
    .update({ status: "failed", error_message: "Timed out", finished_at: new Date().toISOString() })
    .eq("account_id", account.id)
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - 30 * 60_000).toISOString());

  const { data: run, error: runErr } = await admin
    .from("instagram_sync_runs")
    .insert({ account_id: account.id, trigger, options, started_by: startedBy })
    .select("id")
    .single();
  if (runErr) {
    if (runErr.code === "23505") throw new AppError("A sync is already running.", "CONFLICT");
    throw runErr;
  }
  const result: SyncResult = { runId: run.id, fetched: 0, imported: 0, skipped: 0, failed: 0 };

  try {
    await ensureTokenValid(admin, account);
    const auth = { token: conn.token, appSecret: conn.appSecret };
    let after: string | undefined;
    const since = options.since ? new Date(options.since) : undefined;
    const until = options.until ? new Date(`${options.until}T23:59:59Z`) : undefined;

    for (let page = 0; page < options.maxPages && result.fetched < options.maxPosts; page++) {
      const { items, after: next } = await listMedia(auth, account.ig_user_id, { after, limit: options.pageSize, since, until });
      const batch = items.slice(0, options.maxPosts - result.fetched);
      result.fetched += batch.length;

      const { data: known } = await admin
        .from("instagram_imports")
        .select("instagram_media_id")
        .in("instagram_media_id", batch.map((m) => m.id));
      const { fresh, duplicates } = partitionNew(batch, (known ?? []).map((k: { instagram_media_id: string }) => k.instagram_media_id));
      result.skipped += duplicates.length;

      // Register all new posts in one round trip, then import a few at a time.
      const { data: inserted } = fresh.length
        ? await admin
            .from("instagram_imports")
            .upsert(fresh.map((m) => rowFor(m, account.id, run.id)), { onConflict: "instagram_media_id", ignoreDuplicates: true })
            .select("id")
        : { data: [] as { id: string }[] };
      result.skipped += fresh.length - (inserted?.length ?? 0);
      const outcomes = await mapLimit(inserted ?? [], POST_CONCURRENCY, (r) => processImport(admin, r.id));
      for (const o of outcomes) {
        if (o.status === "fulfilled" && o.value === "imported") result.imported++;
        else result.failed++;
      }
      if (!next) break;
      after = next;
    }

    // Retry earlier failures that are due.
    const { data: due } = await admin
      .from("instagram_imports")
      .select("id")
      .eq("status", "failed")
      .lte("next_retry_at", new Date().toISOString())
      .lt("attempts", MAX_ATTEMPTS)
      .limit(10);
    const retried = await mapLimit(due ?? [], POST_CONCURRENCY, (d) => processImport(admin, d.id));
    result.imported += retried.filter((o) => o.status === "fulfilled" && o.value === "imported").length;

    const now = new Date().toISOString();
    await admin
      .from("instagram_accounts")
      .update({
        status: "connected",
        last_synced_at: now,
        last_successful_sync_at: now,
        last_error: null,
        initial_import_completed: account.initial_import_completed || trigger === "initial",
      })
      .eq("id", account.id);
    await admin
      .from("instagram_sync_runs")
      .update({
        status: result.failed ? "partial" : "succeeded",
        fetched_count: result.fetched,
        imported_count: result.imported,
        skipped_count: result.skipped,
        failed_count: result.failed,
        finished_at: now,
      })
      .eq("id", run.id);
    await audit(startedBy, "instagram.sync_run", "instagram_sync_run", run.id, { trigger, fetched: result.fetched, imported: result.imported, skipped: result.skipped, failed: result.failed });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    const tokenProblem = err instanceof InstagramApiError && err.isTokenError;
    await admin
      .from("instagram_accounts")
      .update({ last_synced_at: new Date().toISOString(), last_error: message, ...(tokenProblem ? { status: "token_expired" } : {}) })
      .eq("id", account.id);
    await admin
      .from("instagram_sync_runs")
      .update({
        status: "failed",
        error_message: message,
        fetched_count: result.fetched,
        imported_count: result.imported,
        skipped_count: result.skipped,
        failed_count: result.failed,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    log.error("instagram.sync_failed", { runId: run.id, message });
    await audit(startedBy, "instagram.sync_failed", "instagram_sync_run", run.id, { trigger, error: message.slice(0, 300) });
    const rateLimited = err instanceof InstagramApiError && err.isRateLimited;
    await notifyAlert({
      title: tokenProblem ? "Instagram token expired: reconnect the account" : rateLimited ? "Instagram rate limit reached" : "Instagram sync failed",
      detail: message.slice(0, 800),
      severity: tokenProblem ? "critical" : "warning",
      source: "instagram.sync",
      url: `${siteUrl()}/admin/instagram`,
      fields: { Trigger: trigger, Fetched: result.fetched, Imported: result.imported, Failed: result.failed },
    });
    throw err;
  }
}

function rowFor(m: IgMedia, accountId: string, runId: string) {
  return {
    account_id: accountId,
    instagram_media_id: m.id,
    media_type: m.media_type,
    caption: m.caption ?? null, // preserved verbatim
    permalink: m.permalink ?? null,
    media_timestamp: m.timestamp,
    raw_metadata: m,
    status: "pending",
    sync_run_id: runId,
  };
}

export interface FeedItem {
  id: string;
  caption: string;
  mediaType: string;
  thumbnail: string | null;
  permalink: string | null;
  timestamp: string;
  slides: number;
  hasVideo: boolean;
  importStatus: string | null;
  articleId: string | null;
}

/** One page of the live Instagram feed with each post's import status, for picking posts by hand. */
export async function browseFeed(after?: string, limit = 24): Promise<{ items: FeedItem[]; after?: string }> {
  const admin = createAdminClient();
  const conn = await getConnectedAccount(admin);
  if (!conn) throw new AppError("No Instagram account is connected.", "NOT_CONFIGURED");
  const page = await listMedia({ token: conn.token, appSecret: conn.appSecret }, conn.account.ig_user_id, { after, limit });
  const { data: known } = await admin
    .from("instagram_imports")
    .select("instagram_media_id, status, article_id")
    .in("instagram_media_id", page.items.map((m) => m.id));
  const byId = new Map((known ?? []).map((k: { instagram_media_id: string; status: string; article_id: string | null }) => [k.instagram_media_id, k]));
  return {
    after: page.after,
    items: page.items.map((m) => {
      const k = byId.get(m.id);
      const kids = m.children?.data ?? [];
      return {
        id: m.id,
        caption: m.caption ?? "",
        mediaType: m.media_type,
        thumbnail: m.media_type === "VIDEO" ? (m.thumbnail_url ?? null) : (m.media_url ?? kids[0]?.media_url ?? kids[0]?.thumbnail_url ?? null),
        permalink: m.permalink ?? null,
        timestamp: m.timestamp,
        slides: m.media_type === "CAROUSEL_ALBUM" ? kids.length : 1,
        hasVideo: videoSources(m).length > 0 || m.media_type === "VIDEO",
        importStatus: k?.status ?? null,
        articleId: k?.article_id ?? null,
      };
    }),
  };
}

export const importSelectionSchema = z.object({
  ids: z.array(z.string().regex(/^\d{5,30}$/)).min(1, "Pick at least one post.").max(30, "Pick up to 30 posts at a time."),
  publish: z.boolean().default(false),
  categoryId: z.uuid().nullish(),
});

/**
 * Import exactly the posts an editor picked (and optionally publish them straight away).
 * Already-imported posts are skipped; everything runs a few posts at a time.
 */
export async function importSelected(input: z.infer<typeof importSelectionSchema>): Promise<{ imported: number; skipped: number; failed: number }> {
  const { ids, publish, categoryId } = importSelectionSchema.parse(input);
  const admin = createAdminClient();
  const conn = await getConnectedAccount(admin);
  if (!conn) throw new AppError("No Instagram account is connected.", "NOT_CONFIGURED");
  await ensureTokenValid(admin, conn.account);
  const auth = { token: conn.token, appSecret: conn.appSecret };

  const { data: known } = await admin.from("instagram_imports").select("instagram_media_id").in("instagram_media_id", ids);
  const { fresh, duplicates } = partitionNew(ids.map((id) => ({ id })), (known ?? []).map((k: { instagram_media_id: string }) => k.instagram_media_id));
  const fetched = await mapLimit(fresh, 5, (f) => getMedia(auth, f.id));
  const posts = fetched.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  let failed = fetched.length - posts.length;

  const { data: run, error: runErr } = await admin
    .from("instagram_sync_runs")
    .insert({ account_id: conn.account.id, trigger: "manual", options: { selected: ids.length, publish } })
    .select("id")
    .single();
  if (runErr) throw runErr.code === "23505" ? new AppError("A sync is already running. Try again in a minute.", "CONFLICT") : runErr;
  const runId = run.id as string;
  const { data: rows } = posts.length
    ? await admin.from("instagram_imports").upsert(posts.map((m) => rowFor(m, conn.account.id, runId)), { onConflict: "instagram_media_id", ignoreDuplicates: true }).select("id")
    : { data: [] as { id: string }[] };
  const outcomes = await mapLimit(rows ?? [], POST_CONCURRENCY, (r) => processImport(admin, r.id, publish, categoryId));
  const imported = outcomes.filter((o) => o.status === "fulfilled" && o.value === "imported").length;
  failed += outcomes.length - imported;
  const skipped = duplicates.length;
  await admin
    .from("instagram_sync_runs")
    .update({
      status: failed ? "partial" : "succeeded",
      fetched_count: ids.length,
      imported_count: imported,
      skipped_count: skipped,
      failed_count: failed,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  return { imported, skipped, failed };
}
