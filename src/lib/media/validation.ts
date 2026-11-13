/** Upload rules and magic-byte sniffing (never trust the client's Content-Type). */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

export const MEDIA_FOLDERS = ["articles", "authors", "categories", "branding", "instagram", "uploads"] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export const VARIANT_WIDTHS = [320, 640, 960, 1280, 1920] as const;

export function isAllowedMime(m: string): m is AllowedMime {
  return (ALLOWED_MIME as readonly string[]).includes(m);
}

/** Detect the real image type from the first bytes. Returns null for anything else. */
export function sniffImageType(buf: Uint8Array): AllowedMime | null {
  const b = buf;
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return "image/avif";
  return null;
}

/** Strip path parts and unsafe characters from a user-supplied filename. */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
}

/** Logical R2 folder layout, e.g. articles/2026/11/<article-id>. */
export function buildFolder(folder: MediaFolder, opts: { articleId?: string; date?: Date } = {}): string {
  if (folder === "articles") {
    const d = opts.date ?? new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `articles/${yyyy}/${mm}/${opts.articleId ?? "unassigned"}`;
  }
  return folder;
}

export function variantWidths(originalWidth: number): number[] {
  const widths = VARIANT_WIDTHS.filter((w) => w < originalWidth);
  return [...widths, Math.min(originalWidth, 2400)];
}
