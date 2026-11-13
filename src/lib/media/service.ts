import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AppError, check } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { deleteObjects, getObjectBytes, presignPut, publicUrl, putObject } from "@/lib/media/r2";
import { processImage, variantRecords } from "@/lib/media/images";
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  MEDIA_FOLDERS,
  buildFolder,
  safeFilename,
} from "@/lib/media/validation";
import type { Media } from "@/lib/db/types";

export const presignSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.enum(ALLOWED_MIME),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  folder: z.enum(MEDIA_FOLDERS).default("uploads"),
  articleId: z.uuid().optional(),
});

/**
 * Step 1 of an upload: create a pending media row and a presigned URL for a
 * temporary object. The browser PUTs the file directly to R2.
 */
export async function createUpload(raw: unknown) {
  const session = await requireSession("media.upload");
  await rateLimit(`upload:${session.userId}`, 60, 600);
  const input = presignSchema.parse(raw);

  const id = randomUUID();
  const tmpKey = `tmp/${id}`;
  const folder = buildFolder(input.folder, { articleId: input.articleId });
  const supabase = await createClient();
  check(
    await supabase.from("media").insert({
      id,
      r2_key: tmpKey,
      public_url: "",
      original_filename: safeFilename(input.filename),
      mime_type: input.contentType,
      file_size: input.size,
      folder,
      status: "pending",
      uploaded_by: session.userId,
    }),
  );
  const uploadUrl = await presignPut(tmpKey, input.contentType, input.size);
  return { id, uploadUrl, headers: { "Content-Type": input.contentType } };
}

/** Store processed image bytes under <folder>/<id>/ and return the media fields. */
async function storeProcessed(id: string, folder: string, bytes: Buffer) {
  const img = await processImage(bytes);
  const prefix = `${folder}/${id}`;
  const originalKey = `${prefix}/original.${img.original.ext}`;
  await putObject(originalKey, img.original.body, img.original.contentType);
  const variants = variantRecords(img.variants, (v) => `${prefix}/w${v.width}.${v.format}`, publicUrl);
  await Promise.all(
    img.variants.map((v, i) => putObject(variants[i].key, v.body, `image/${v.format}`)),
  );
  return {
    r2_key: originalKey,
    public_url: publicUrl(originalKey),
    mime_type: img.original.contentType,
    file_size: img.original.body.length,
    width: img.width,
    height: img.height,
    variants,
  };
}

/** Step 2: verify the uploaded bytes, generate variants, move to the final folder. */
export async function finalizeUpload(id: string): Promise<Media> {
  const session = await requireSession("media.upload");
  const supabase = await createClient();
  const { data: row } = await supabase.from("media").select("*").eq("id", id).maybeSingle();
  if (!row) throw new AppError("Upload not found.", "NOT_FOUND");
  const media = row as Media;
  if (media.uploaded_by !== session.userId) throw new AppError("Forbidden", "FORBIDDEN");
  if (media.status !== "pending") return media;

  try {
    const bytes = await getObjectBytes(media.r2_key, MAX_UPLOAD_BYTES);
    const stored = await storeProcessed(id, media.folder, bytes);
    const updated = check(
      await supabase.from("media").update({ ...stored, status: "ready" }).eq("id", id).select("*").single(),
    ) as Media;
    await deleteObjects([media.r2_key]);
    await audit(session.userId, "media.upload", "media", id, { filename: media.original_filename });
    return updated;
  } catch (err) {
    await supabase.from("media").update({ status: "failed" }).eq("id", id);
    await deleteObjects([media.r2_key]).catch(() => undefined);
    throw err;
  }
}

/** Server-side ingest (used by the Instagram importer). Uses the service role. */
export async function ingestImage(bytes: Buffer, opts: { filename: string; folder: string; source: "instagram" | "upload"; caption?: string | null }): Promise<Media> {
  const id = randomUUID();
  const stored = await storeProcessed(id, opts.folder, bytes);
  const admin = createAdminClient();
  return check(
    await admin
      .from("media")
      .insert({
        id,
        ...stored,
        original_filename: safeFilename(opts.filename),
        folder: opts.folder,
        status: "ready",
        source: opts.source,
        caption: opts.caption ?? null,
      })
      .select("*")
      .single(),
  ) as Media;
}

export const mediaMetaSchema = z.object({
  alt_text_en: z.string().max(300).nullish(),
  alt_text_bn: z.string().max(300).nullish(),
  caption: z.string().max(1000).nullish(),
  credit: z.string().max(200).nullish(),
});

export async function updateMediaMeta(id: string, raw: unknown): Promise<void> {
  const session = await requireSession("media.upload");
  const input = mediaMetaSchema.parse(raw);
  const supabase = await createClient();
  const { data, error } = await supabase.from("media").update(input).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new AppError("Media not found or not editable by you.", "FORBIDDEN");
  await audit(session.userId, "media.update", "media", id);
}

/** Delete media. The DB trigger refuses if a published/scheduled article uses it. */
export async function deleteMedia(id: string): Promise<void> {
  const session = await requireSession("media.upload");
  const supabase = await createClient();
  const { data: row } = await supabase.from("media").select("*").eq("id", id).maybeSingle();
  if (!row) throw new AppError("Media not found.", "NOT_FOUND");
  const media = row as Media;
  if (!can(session.profile.role, "media.manage_any") && media.uploaded_by !== session.userId) {
    throw new AppError("You can only delete your own uploads.", "FORBIDDEN");
  }
  const { data: deleted, error } = await supabase.from("media").delete().eq("id", id).select("id");
  if (error) {
    if (error.message.includes("referenced by a published")) {
      throw new AppError("This image is used by a published or scheduled article and cannot be deleted.", "CONFLICT");
    }
    throw error;
  }
  if (!deleted?.length) throw new AppError("You cannot delete this media.", "FORBIDDEN");
  await deleteObjects([media.r2_key, ...media.variants.map((v) => v.key)]).catch(() => undefined);
  await audit(session.userId, "media.delete", "media", id, { filename: media.original_filename });
}
