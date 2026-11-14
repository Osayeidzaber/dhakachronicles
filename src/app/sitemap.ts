import type { MetadataRoute } from "next";
import { siteUrl, supabaseConfig } from "@/lib/env";
import { listCategories, listForSitemap } from "@/lib/articles/queries";
import { sitemapEntries } from "@/lib/seo/feeds";
import { log } from "@/lib/logger";
import { PUBLIC_LOCALES } from "@/lib/i18n";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const langs = (path: string) => Object.fromEntries(PUBLIC_LOCALES.map((l) => [l, `${base}/${l}${path}`]));
  const home: MetadataRoute.Sitemap = [
    ...PUBLIC_LOCALES.map((l) => ({ url: `${base}/${l}`, changeFrequency: "hourly" as const, priority: 1, alternates: { languages: langs("") } })),
    ...["latest", "team", "advertise", "privacy"].flatMap((p) =>
      PUBLIC_LOCALES.map((l) => ({
        url: `${base}/${l}/${p}`,
        changeFrequency: (p === "latest" ? "hourly" : "monthly") as "hourly" | "monthly",
        priority: p === "latest" ? 0.8 : 0.3,
        alternates: { languages: langs(`/${p}`) },
      })),
    ),
  ];
  if (!supabaseConfig()) return home;
  try {
    const [articles, categories] = await Promise.all([listForSitemap(), listCategories()]);
    const cats = categories.flatMap((c) =>
      PUBLIC_LOCALES.map((l) => ({ url: `${base}/${l}/category/${c.slug}`, changeFrequency: "hourly" as const, priority: 0.6 })),
    );
    return [...home, ...cats, ...sitemapEntries(articles, base)];
  } catch (err) {
    log.error("sitemap.failed", { err });
    return home;
  }
}
