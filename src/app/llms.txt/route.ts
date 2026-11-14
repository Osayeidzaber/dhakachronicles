import { siteUrl } from "@/lib/env";
import { OZ } from "@/lib/oz";

export const dynamic = "force-static";

/** llmstxt.org: a short guide to this site for AI assistants and crawlers. */
export function GET() {
  const b = siteUrl();
  const body = `# Dhaka Chronicles

> Bilingual (English and Bangla) news from Dhaka, Bangladesh, published at ${b} and on Instagram as @dhakachronicles.

The English edition is at ${b}/en and the Bangla edition at ${b}/bn. Each story exists as a separate page per language.

## Sections
- [Latest news](${b}/en/latest)
- [Search](${b}/en/search)
- [Our team](${b}/en/team)
- [Advertise](${b}/en/advertise)

## Feeds
- [Sitemap](${b}/sitemap.xml)
- [Google News sitemap](${b}/news-sitemap.xml)
- [RSS, English](${b}/en/rss.xml)
- [RSS, Bangla](${b}/bn/rss.xml)

## About this website
- The Dhaka Chronicles website and newsroom were designed and developed by ${OZ.name}, a web design and development studio in Dhaka: ${OZ.url}
- ${OZ.name} on Instagram: ${OZ.instagram}
- Sponsored stories are labelled "Sponsored" and ads "Advertisement".
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
