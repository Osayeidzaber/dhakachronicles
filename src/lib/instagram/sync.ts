import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { instagramConfig } from "@/lib/env";
import { AppError, check } from "@/lib/errors";
import { log } from "@/lib/logger";
import { ingestImage } from "@/lib/media/service";
import { buildFolder } from "@/lib/media/validation";
import { docToText } from "@/lib/content/tiptap";
import { decryptSecret, encryptSecret } from "@/lib/instagram/crypto";
import {
  InstagramApiError,
  igMediaSchema,
  imageSources,
  isAllowedMediaHost,
  listMedia,
  refreshLongLivedToken,
  type IgMedia,
} from "@/lib/instagram/client";
import { detectLanguage, draftContent, draftSlug, draftTitle } from "@/lib/instagram/draft";
import type { InstagramAccount } from "@/lib/db/types";

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

export async function getConnectedAccount(admin: Admin): Promise<{ account: InstagramAccount; token: string } | null> {
  const cfg = instagramConfig();
  if (!cfg) return null;
  const { data: account } = await admin.from("instagram_accounts").select("*").order("created_at").limit(1).maybeSingle();
  if (!account) return null;
  const { data: tok } = await admin.from("instagram_tokens").select("encrypted_access_token").eq("account_id", account.id).maybeSingle();
  if (!tok) return null;
  return { account: account as InstagramAccount, token: decryptSecret(tok.encrypted_access_token, cfg.encryptionKey) };
}

/** Refresh the long-lived token when it expires within 10 days (tokens must be ≥24h old). */
export async function refreshTokenIfNeeded(admin: Admin, account: InstagramAccount, token: string): Promise<string> {
  const cfg = instagramConfig();
  if (!cfg || !account.token_expires_at) return token;
  const expiresIn = new Date(account.token_expires_at).getTime() - Date.now();
  if (expiresIn > 10 * 86400_000) return token;
  if (expiresIn <= 0) {
    await admin.from("instagram_accounts").update({ status: "token_expired", last_error: "Access token expired. Reconnect the account." }).eq("id", account.id);
    throw new AppError("Instagram token expired. Reconnect the account.", "UNAUTHORIZED");
  }
  const fresh = await refreshLongLivedToken(token);
  await admin.from("instagram_tokens").update({ encrypted_access_token: encryptSecret(fresh.access_token, cfg.encryptionKey), updated_at: new Date().toISOString() }).eq("account_id", account.id);
  await admin
    .from("instagram_accounts")
    .update({ token_expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(), token_refreshed_at: new Date().toISOString() })
    .eq("id", account.id);
  log.info("instagram.token_refreshed", { accountId: account.id });
  return fresh.access_token;
}

async function downloadImage(url: string): Promise<Buffer> {
  if (!isAllowedMediaHost(url)) throw new Error("Media URL is not on an Instagram CDN host.");
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000), redirect: "follow" });
  if (!res.ok) throw new Error(`Media download failed (${res.status}).`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_IMAGE_BYTES) throw new Error("Media file is too large.");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error("Media file is too large.");
  return buf;
}

/** Process one import row end to end: media → R2, then an atomic draft creation. */
export async function processImport(admin: Admin, importId: string): Promise<"imported" | "failed" | "skipped"> {
  const { data: row } = await admin.from("instagram_imports").select("*").eq("id", importId).single();
  if (!row || row.status === "imported") return "imported";
  const attempts = (row.attempts as number) + 1;
  await admin.from("instagram_imports").update({ status: "processing", attempts, error_message: null }).eq("id", importId);

  try {
    const media = igMediaSchema.parse(row.raw_metadata);
    const sources = imageSources(media);
    const ts = media.timestamp;
    const mediaIds: string[] = [];
    const folder = buildFolder("instagram");
    const failures: string[] = [];
    for (const src of sources) {
      try {
        const bytes = await downloadImage(src.url);
        const m = await ingestImage(bytes, { filename: `instagram-${src.id}.jpg`, folder, source: "instagram", caption: null });
        mediaIds.push(m.id);
      } catch (err) {
        failures.push(`${src.id}: ${err instanceof Error ? err.message : "error"}`);
      }
    }
    if (sources.length > 0 && mediaIds.length === 0) throw new Error(`No media could be imported. ${failures.join("; ")}`);

    const caption = media.caption ?? "";
    const title = draftTitle(caption, ts);
    const content = draftContent(caption, media.permalink);
    check(
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
    return "imported";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const retry = nextRetryAt(attempts);
    await admin
      .from("instagram_imports")
      .update({ status: "failed", error_message: message.slice(0, 1000), next_retry_at: retry?.toISOString() ?? null })
      .eq("id", importId);
    log.warn("instagram.import_failed", { importId, attempts, message });
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
    const token = await refreshTokenIfNeeded(admin, account, conn.token);
    let after: string | undefined;
    const since = options.since ? new Date(options.since) : undefined;
    const until = options.until ? new Date(`${options.until}T23:59:59Z`) : undefined;

    for (let page = 0; page < options.maxPages && result.fetched < options.maxPosts; page++) {
      const { items, after: next } = await listMedia(token, { after, limit: options.pageSize, since, until });
      const batch = items.slice(0, options.maxPosts - result.fetched);
      result.fetched += batch.length;

      const { data: known } = await admin
        .from("instagram_imports")
        .select("instagram_media_id")
        .in("instagram_media_id", batch.map((m) => m.id));
      const { fresh, duplicates } = partitionNew(batch, (known ?? []).map((k: { instagram_media_id: string }) => k.instagram_media_id));
      result.skipped += duplicates.length;

      for (const m of fresh) {
        const { data: inserted } = await admin
          .from("instagram_imports")
          .upsert(rowFor(m, account.id, run.id), { onConflict: "instagram_media_id", ignoreDuplicates: true })
          .select("id");
        if (!inserted?.length) {
          result.skipped++;
          continue;
        }
        const outcome = await processImport(admin, inserted[0].id);
        if (outcome === "imported") result.imported++;
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
    for (const d of due ?? []) {
      const outcome = await processImport(admin, d.id);
      if (outcome === "imported") result.imported++;
    }

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
