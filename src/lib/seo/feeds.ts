import type { Lang } from "@/lib/db/types";
import { articlePath } from "@/lib/seo/defaults";

export interface FeedItem {
  translation_group_id: string;
  language: Lang;
  slug: string;
  title: string;
  excerpt: string | null;
  published_at: string;
  updated_at: string;
  featured_image?: { public_url: string } | null;
}

export function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string);
}

/** Google News sitemap: only articles published in the last 48 hours (max 1000). */
export function buildNewsSitemap(items: FeedItem[], siteUrl: string, publicationName: string, now = new Date()): string {
  const cutoff = now.getTime() - 48 * 3600_000;
  const recent = items.filter((i) => new Date(i.published_at).getTime() >= cutoff).slice(0, 1000);
  const urls = recent
    .map(
      (i) => `  <url>
    <loc>${xmlEscape(siteUrl + articlePath(i.language, i.slug))}</loc>
    <news:news>
      <news:publication>
        <news:name>${xmlEscape(publicationName)}</news:name>
        <news:language>${i.language}</news:language>
      </news:publication>
      <news:publication_date>${new Date(i.published_at).toISOString()}</news:publication_date>
      <news:title>${xmlEscape(i.title)}</news:title>
    </news:news>
  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>
`;
}

export function buildRss(items: FeedItem[], p: { siteUrl: string; title: string; description: string; lang: Lang }): string {
  const entries = items
    .filter((i) => i.language === p.lang)
    .slice(0, 50)
    .map((i) => {
      const url = p.siteUrl + articlePath(i.language, i.slug);
      return `    <item>
      <title>${xmlEscape(i.title)}</title>
      <link>${xmlEscape(url)}</link>
      <guid isPermaLink="true">${xmlEscape(url)}</guid>
      <pubDate>${new Date(i.published_at).toUTCString()}</pubDate>
      ${i.excerpt ? `<description>${xmlEscape(i.excerpt)}</description>` : ""}
      ${i.featured_image ? `<enclosure url="${xmlEscape(i.featured_image.public_url)}" type="image/jpeg" length="0"/>` : ""}
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(p.title)}</title>
    <link>${xmlEscape(`${p.siteUrl}/${p.lang}`)}</link>
    <description>${xmlEscape(p.description)}</description>
    <language>${p.lang === "bn" ? "bn-BD" : "en"}</language>
    <atom:link href="${xmlEscape(`${p.siteUrl}/${p.lang}/rss.xml`)}" rel="self" type="application/rss+xml"/>
${entries}
  </channel>
</rss>
`;
}

/** Sitemap entries with hreflang alternates for translations of the same story. */
export function sitemapEntries(items: FeedItem[], siteUrl: string) {
  const groups = new Map<string, FeedItem[]>();
  for (const i of items) groups.set(i.translation_group_id, [...(groups.get(i.translation_group_id) ?? []), i]);
  return items.map((i) => {
    const siblings = groups.get(i.translation_group_id) ?? [];
    return {
      url: siteUrl + articlePath(i.language, i.slug),
      lastModified: new Date(i.updated_at),
      alternates: siblings.length > 1 ? { languages: Object.fromEntries(siblings.map((s) => [s.language, siteUrl + articlePath(s.language, s.slug)])) } : undefined,
    };
  });
}
