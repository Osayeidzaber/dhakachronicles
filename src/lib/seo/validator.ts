import { SEO_LIMITS } from "@/lib/seo/defaults";
import { wordCount } from "@/lib/content/tiptap";

export type SeoSeverity = "error" | "warning" | "info";
export interface SeoIssue {
  field: string;
  severity: SeoSeverity;
  message: string;
}

export interface SeoCheckInput {
  title: string;
  slug: string;
  seo_title?: string | null;
  seo_description?: string | null;
  excerpt?: string | null;
  focus_keyword?: string | null;
  content_text: string;
  featured_image_id?: string | null;
  featured_image_alt?: string | null;
  inline_images_missing_alt?: number;
  duplicate_slug?: boolean;
}

/**
 * Editorial SEO checklist. It flags missing or weak metadata; it does NOT predict
 * or guarantee search rankings.
 */
export function validateSeo(a: SeoCheckInput): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const add = (field: string, severity: SeoSeverity, message: string) => issues.push({ field, severity, message });

  const title = a.seo_title?.trim() || a.title.trim();
  if (!a.seo_title?.trim()) add("seo_title", "info", "No SEO title set; the headline will be used.");
  if (title.length > SEO_LIMITS.titleMax) add("seo_title", "warning", `Title is ${title.length} characters; aim for ≤ ${SEO_LIMITS.titleMax}.`);
  if (title.length < SEO_LIMITS.titleMin) add("seo_title", "warning", `Title is short (${title.length} characters).`);

  const desc = a.seo_description?.trim() || a.excerpt?.trim() || "";
  if (!desc) add("seo_description", "warning", "No meta description or excerpt; one will be generated from the body.");
  else if (desc.length > SEO_LIMITS.descriptionMax) add("seo_description", "warning", `Description is ${desc.length} characters; aim for ≤ ${SEO_LIMITS.descriptionMax}.`);
  else if (desc.length < SEO_LIMITS.descriptionMin) add("seo_description", "info", `Description is short (${desc.length} characters).`);

  if (!a.featured_image_id) add("featured_image", "warning", "No featured image (needed for social sharing and Google News).");
  else if (!a.featured_image_alt?.trim()) add("featured_image_alt", "warning", "Featured image has no alt text.");
  if (a.inline_images_missing_alt) add("content", "warning", `${a.inline_images_missing_alt} inline image(s) have no alt text.`);

  if (a.duplicate_slug) add("slug", "error", "Another article in this language already uses this slug.");
  if (a.slug.length > 100) add("slug", "info", "Slug is long; shorter URLs are easier to share.");

  const words = wordCount(a.content_text);
  if (words < 80) add("content", "info", `Body is short (${words} words).`);

  const kw = a.focus_keyword?.trim().toLowerCase();
  if (!kw) add("focus_keyword", "info", "No focus keyword set.");
  else {
    if (!title.toLowerCase().includes(kw)) add("focus_keyword", "info", "Focus keyword does not appear in the title.");
    if (!a.content_text.toLowerCase().includes(kw)) add("focus_keyword", "info", "Focus keyword does not appear in the body.");
  }
  return issues;
}
