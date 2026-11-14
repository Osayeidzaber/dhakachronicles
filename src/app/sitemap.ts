import type { MetadataRoute } from "next";
import { siteUrl, supabaseConfig } from "@/lib/env";
import { listCategories, listForSitemap } from "@/lib/articles/queries";
import { sitemapEntries } from "@/lib/seo/feeds";
import { log } from "@/lib/logger";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const home: MetadataRoute.Sitemap = [
    { url: `${base}/bn`, changeFrequency: "hourly", priority: 1, alternates: { languages: { bn: `${base}/bn`, en: `${base}/en` } } },
    { url: `${base}/en`, changeFrequency: "hourly", priority: 1, alternates: { languages: { bn: `${base}/bn`, en: `${base}/en` } } },
    ...["latest", "team", "advertise", "privacy"].flatMap((p) =>
      (["en", "bn"] as const).map((l) => ({
        url: `${base}/${l}/${p}`,
        changeFrequency: (p === "latest" ? "hourly" : "monthly") as "hourly" | "monthly",
        priority: p === "latest" ? 0.8 : 0.3,
        alternates: { languages: { en: `${base}/en/${p}`, bn: `${base}/bn/${p}` } },
      })),
    ),
  ];
  if (!supabaseConfig()) return home;
  try {
    const [articles, categories] = await Promise.all([listForSitemap(), listCategories()]);
    const cats = categories.flatMap((c) =>
      (["bn", "en"] as const).map((l) => ({ url: `${base}/${l}/category/${c.slug}`, changeFrequency: "hourly" as const, priority: 0.6 })),
    );
    return [...home, ...cats, ...sitemapEntries(articles, base)];
  } catch (err) {
    log.error("sitemap.failed", { err });
    return home;
  }
}
