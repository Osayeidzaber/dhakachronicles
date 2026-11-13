import { truncate } from "@/lib/content/tiptap";
import type { Lang } from "@/lib/db/types";

export const SEO_LIMITS = {
  titleMin: 30,
  titleMax: 60,
  descriptionMin: 70,
  descriptionMax: 160,
} as const;

export interface SeoSource {
  language: Lang;
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  content_text?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  canonical_url?: string | null;
  slug: string;
}

export interface ResolvedSeo {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  canonical: string;
}

export function articlePath(lang: Lang, slug: string): string {
  return `/${lang}/news/${encodeURIComponent(slug)}`;
}

/** Fill any missing SEO field from the article content with sensible defaults. */
export function resolveSeo(a: SeoSource, siteUrl: string): ResolvedSeo {
  const title = (a.seo_title?.trim() || truncate(a.title, SEO_LIMITS.titleMax)).trim();
  const description = (
    a.seo_description?.trim() ||
    truncate(a.excerpt?.trim() || a.subtitle?.trim() || a.content_text?.trim() || a.title, SEO_LIMITS.descriptionMax)
  ).trim();
  return {
    title,
    description,
    ogTitle: a.og_title?.trim() || title,
    ogDescription: a.og_description?.trim() || description,
    canonical: a.canonical_url?.trim() || `${siteUrl}${articlePath(a.language, a.slug)}`,
  };
}
