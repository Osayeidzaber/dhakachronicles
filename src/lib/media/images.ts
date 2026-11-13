import "server-only";
import sharp, { type Metadata } from "sharp";
import { AppError } from "@/lib/errors";
import { sniffImageType, variantWidths, type AllowedMime } from "@/lib/media/validation";
import type { MediaVariant } from "@/lib/db/types";

export interface ProcessedImage {
  mime: AllowedMime;
  width: number;
  height: number;
  /** Re-encoded original with EXIF/GPS metadata stripped and orientation applied. */
  original: { body: Buffer; ext: string; contentType: string };
  variants: { body: Buffer; width: number; height: number; format: "webp" | "avif" }[];
}

const MAX_PIXELS = 40_000_000; // guard against decompression bombs

/** Validate actual image bytes with Sharp and produce responsive WebP/AVIF variants. */
export async function processImage(input: Buffer, opts: { avif?: boolean } = {}): Promise<ProcessedImage> {
  const mime = sniffImageType(input);
  if (!mime) throw new AppError("Unsupported or invalid image file.", "VALIDATION");

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw new AppError("The image could not be decoded.", "VALIDATION");
  }
  if (!meta.width || !meta.height) throw new AppError("The image has no dimensions.", "VALIDATION");

  const base = () => sharp(input, { limitInputPixels: MAX_PIXELS, animated: false }).rotate();
  const oriented = await base().toBuffer({ resolveWithObject: true });
  const width = oriented.info.width;
  const height = oriented.info.height;

  const keepPng = mime === "image/png" || mime === "image/gif";
  const originalBody = keepPng
    ? await base().png({ compressionLevel: 9 }).toBuffer()
    : await base().jpeg({ quality: 88, mozjpeg: true }).toBuffer();

  const variants: ProcessedImage["variants"] = [];
  for (const w of variantWidths(width)) {
    const resized = base().resize({ width: w, withoutEnlargement: true });
    const webp = await resized.clone().webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    variants.push({ body: webp.data, width: webp.info.width, height: webp.info.height, format: "webp" });
    if (opts.avif !== false) {
      const avif = await resized.clone().avif({ quality: 55, effort: 4 }).toBuffer({ resolveWithObject: true });
      variants.push({ body: avif.data, width: avif.info.width, height: avif.info.height, format: "avif" });
    }
  }

  return {
    mime,
    width,
    height,
    original: keepPng
      ? { body: originalBody, ext: "png", contentType: "image/png" }
      : { body: originalBody, ext: "jpg", contentType: "image/jpeg" },
    variants,
  };
}

export function variantRecords(
  variants: ProcessedImage["variants"],
  keyFor: (v: ProcessedImage["variants"][number]) => string,
  urlFor: (key: string) => string,
): MediaVariant[] {
  return variants.map((v) => {
    const key = keyFor(v);
    return { key, url: urlFor(key), width: v.width, height: v.height, format: v.format, size: v.body.length };
  });
}
