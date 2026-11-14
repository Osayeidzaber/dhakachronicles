import { PUBLIC_LOCALES } from "@/lib/i18n";
import type { Metadata } from "next";
import type { Lang } from "@/lib/db/types";
import { articlePath, resolveSeo, type SeoSource } from "@/lib/seo/defaults";

export interface ArticleMetaInput extends SeoSource {
  published_at: string;
  updated_at: string;
  featured_image_alt?: string | null;
  focus_keyword?: string | null;
  ogImageUrl?: string | null;
  ogImageWidth?: number | null;
  ogImageHeight?: number | null;
  authorName?: string | null;
  section?: string | null;
  tags?: string[];
  translations: { language: Lang; slug: string }[];
}

/** Next.js Metadata for an article: SEO defaults, canonical, hreflang, Open Graph, Twitter. */
export function buildArticleMetadata(a: ArticleMetaInput, siteUrl: string, siteName: string): Metadata {
  const seo = resolveSeo(a, siteUrl);
  const languages: Record<string, string> = {};
  for (const tr of a.translations) if (PUBLIC_LOCALES.includes(tr.language)) languages[tr.language] = `${siteUrl}${articlePath(tr.language, tr.slug)}`;
  languages[a.language] = `${siteUrl}${articlePath(a.language, a.slug)}`;
  if (Object.keys(languages).length > 1) languages["x-default"] = languages.en ?? languages[a.language];

  const images = a.ogImageUrl
    ? [{ url: a.ogImageUrl, width: a.ogImageWidth ?? undefined, height: a.ogImageHeight ?? undefined, alt: a.featured_image_alt ?? seo.ogTitle }]
    : undefined;

  return {
    title: seo.title,
    description: seo.description,
    keywords: [a.focus_keyword, ...(a.tags ?? [])].filter((k): k is string => !!k),
    alternates: { canonical: seo.canonical, languages: Object.keys(languages).length > 1 ? languages : undefined },
    openGraph: {
      type: "article",
      title: seo.ogTitle,
      description: seo.ogDescription,
      url: `${siteUrl}${articlePath(a.language, a.slug)}`,
      siteName,
      locale: a.language === "bn" ? "bn_BD" : "en_US",
      alternateLocale: a.translations.filter((t) => t.language !== a.language).map((t) => (t.language === "bn" ? "bn_BD" : "en_US")),
      publishedTime: a.published_at,
      modifiedTime: a.updated_at,
      section: a.section ?? undefined,
      authors: a.authorName ? [a.authorName] : undefined,
      tags: a.tags,
      images,
    },
    twitter: { card: images ? "summary_large_image" : "summary", title: seo.ogTitle, description: seo.ogDescription, images: images?.map((i) => i.url) },
  };
}
