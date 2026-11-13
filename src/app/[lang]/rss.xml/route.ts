import { siteUrl, supabaseConfig } from "@/lib/env";
import { isLang } from "@/lib/i18n";
import { getPublicSettings, listForSitemap } from "@/lib/articles/queries";
import { buildRss } from "@/lib/seo/feeds";
import { seoDefaults, siteName } from "@/lib/settings";

export const revalidate = 300;

export async function GET(_req: Request, ctx: { params: Promise<{ lang: string }> }) {
  const { lang } = await ctx.params;
  if (!isLang(lang)) return new Response("Not found", { status: 404 });
  let items: Awaited<ReturnType<typeof listForSitemap>> = [];
  let settings: Record<string, unknown> = {};
  if (supabaseConfig()) {
    try {
      [items, settings] = await Promise.all([listForSitemap(undefined, 200), getPublicSettings()]);
    } catch {
      // empty feed
    }
  }
  const d = seoDefaults(settings);
  const xml = buildRss(items, {
    siteUrl: siteUrl(),
    title: siteName(settings, lang),
    description: (lang === "bn" ? d.description_bn : d.description_en) || siteName(settings, lang),
    lang,
  });
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
