import { BANGLA_ENABLED } from "@/lib/i18n";
import { describe, expect, it } from "vitest";
import { buildArticleMetadata } from "@/lib/seo/metadata";
import { resolveSeo } from "@/lib/seo/defaults";
import { validateSeo } from "@/lib/seo/validator";
import { newsArticleJsonLd, safeJsonLd } from "@/lib/seo/jsonld";
import { buildNewsSitemap, buildRss, sitemapEntries, type FeedItem } from "@/lib/seo/feeds";

const SITE = "https://dhakachronicles.example";

describe("SEO defaults and metadata", () => {
  const article = {
    language: "en" as const,
    title: "Heavy rain floods parts of Dhaka",
    slug: "heavy-rain-floods-dhaka",
    excerpt: null,
    content_text: "Heavy rain on Monday flooded several neighbourhoods in Dhaka. ".repeat(10),
    published_at: "2026-11-10T10:00:00Z",
    updated_at: "2026-11-10T12:00:00Z",
    translations: [{ language: "bn" as const, slug: "ঢাকায়-বৃষ্টি" }],
  };

  it("generates sensible defaults from content", () => {
    const seo = resolveSeo(article, SITE);
    expect(seo.title).toBe(article.title);
    expect(seo.description.length).toBeLessThanOrEqual(160);
    expect(seo.canonical).toBe(`${SITE}/en/news/heavy-rain-floods-dhaka`);
  });

  it("respects explicit SEO fields", () => {
    const seo = resolveSeo({ ...article, seo_title: "Custom", seo_description: "Desc", canonical_url: "https://other.example/x" }, SITE);
    expect(seo).toMatchObject({ title: "Custom", description: "Desc", canonical: "https://other.example/x" });
  });

  it("emits hreflang alternates for translations and Open Graph data", () => {
    const md = buildArticleMetadata({ ...article, ogImageUrl: "https://media.example/x.jpg" }, SITE, "Dhaka Chronicles");
    if (BANGLA_ENABLED) {
      // English is the default language for search engines.
      expect(md.alternates?.languages).toMatchObject({
        en: `${SITE}/en/news/heavy-rain-floods-dhaka`,
        bn: `${SITE}/bn/news/${encodeURIComponent("ঢাকায়-বৃষ্টি")}`,
        "x-default": `${SITE}/en/news/heavy-rain-floods-dhaka`,
      });
    } else {
      // Bangla edition switched off: no links to it.
      expect(md.alternates?.languages).toBeUndefined();
    }
    expect(md.openGraph).toMatchObject({ type: "article", publishedTime: article.published_at });
  });

  it("omits hreflang when there is no translation", () => {
    const md = buildArticleMetadata({ ...article, translations: [] }, SITE, "DC");
    expect(md.alternates?.languages).toBeUndefined();
  });
});

describe("SEO validator", () => {
  it("flags missing image, alt text, long titles and duplicate slugs", () => {
    const issues = validateSeo({ title: "x".repeat(80), slug: "a", content_text: "short", duplicate_slug: true, inline_images_missing_alt: 2 });
    const msgs = issues.map((i) => `${i.severity}:${i.field}`);
    expect(msgs).toContain("error:slug");
    expect(msgs).toContain("warning:seo_title");
    expect(msgs).toContain("warning:featured_image");
    expect(msgs).toContain("warning:content");
  });

  it("flags a featured image without alt text", () => {
    const issues = validateSeo({ title: "A reasonable headline about Dhaka today", slug: "a", content_text: "", featured_image_id: "m" });
    expect(issues.some((i) => i.field === "featured_image_alt")).toBe(true);
  });
});

describe("structured data and feeds", () => {
  it("builds NewsArticle JSON-LD and escapes script breakouts", () => {
    const ld = newsArticleJsonLd({
      url: `${SITE}/en/news/x`,
      headline: "</script><script>alert(1)</script>",
      description: "d",
      language: "bn",
      imageUrls: [],
      datePublished: "2026-11-10T10:00:00Z",
      dateModified: "2026-11-10T10:00:00Z",
      publisherName: "DC",
    });
    expect(ld["@type"]).toBe("NewsArticle");
    expect(ld.inLanguage).toBe("bn-BD");
    expect(safeJsonLd(ld)).not.toContain("</script>");
  });

  const now = new Date("2026-11-13T12:00:00Z");
  const items: FeedItem[] = [
    { translation_group_id: "g1", language: "en", slug: "fresh", title: "Fresh & new", excerpt: "<b>x</b>", published_at: "2026-11-13T08:00:00Z", updated_at: "2026-11-13T08:00:00Z" },
    { translation_group_id: "g1", language: "bn", slug: "নতুন", title: "নতুন", excerpt: null, published_at: "2026-11-13T09:00:00Z", updated_at: "2026-11-13T09:00:00Z" },
    { translation_group_id: "g2", language: "en", slug: "old", title: "Old", excerpt: null, published_at: "2026-11-01T08:00:00Z", updated_at: "2026-11-01T08:00:00Z" },
  ];

  it("Google News sitemap includes only the last 48 hours", () => {
    const xml = buildNewsSitemap(items, SITE, "Dhaka Chronicles", now);
    expect(xml).toContain("<news:title>Fresh &amp; new</news:title>");
    expect(xml).toContain("<news:language>bn</news:language>");
    expect(xml).not.toContain("/en/news/old");
  });

  it("sitemap entries link translations with hreflang", () => {
    const entries = sitemapEntries(items, SITE);
    expect(entries[0].alternates?.languages).toMatchObject({ en: `${SITE}/en/news/fresh` });
    expect(entries[2].alternates).toBeUndefined();
  });

  it("RSS is per language and escapes content", () => {
    const rss = buildRss(items, { siteUrl: SITE, title: "DC", description: "News", lang: "en" });
    expect(rss).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(rss).not.toContain("নতুন");
    expect(rss).toContain(`${SITE}/en/rss.xml`);
  });
});

describe("siteUrl", () => {
  const keep = { ...process.env };
  const run = async (vars: Record<string, string | undefined>) => {
    process.env = { ...keep, SITE_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: undefined, ...vars };
    const { siteUrl } = await import("@/lib/env");
    const out = siteUrl();
    process.env = keep;
    return out;
  };
  it("uses SITE_URL when it is a real domain", async () => {
    expect(await run({ SITE_URL: "https://dhakachronicles.com/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toBe("https://dhakachronicles.com");
  });
  it("ignores a localhost SITE_URL on Vercel", async () => {
    expect(await run({ SITE_URL: "http://localhost:3000", VERCEL_PROJECT_PRODUCTION_URL: "dhakachronicles.com" })).toBe("https://dhakachronicles.com");
  });
  it("falls back to localhost only in local dev", async () => {
    expect(await run({})).toBe("http://localhost:3000");
  });
});
