/**
 * Article slug: keeps Latin letters, Bangla characters and digits; everything else
 * collapses to single hyphens. Matches the articles.slug check constraint.
 */
export function slugify(input: string, maxLength = 120): string {
  return input
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{Script=Latin}\p{Script=Bengali}\p{Nd}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Strict ASCII slug for categories, tags and authors. */
export function asciiSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const ARTICLE_SLUG_RE = /^[\p{L}\p{M}\p{Nd}]+(-[\p{L}\p{M}\p{Nd}]+)*$/u;
export const ASCII_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
