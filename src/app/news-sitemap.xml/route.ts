import { siteUrl, supabaseConfig } from "@/lib/env";
import { getPublicSettings, listForSitemap } from "@/lib/articles/queries";
import { buildNewsSitemap } from "@/lib/seo/feeds";
import { siteName } from "@/lib/settings";

export const revalidate = 300;

/** Google News sitemap (articles from the last 48 hours). */
export async function GET() {
  let xml = buildNewsSitemap([], siteUrl(), "Dhaka Chronicles");
  if (supabaseConfig()) {
    try {
      const since = new Date(Date.now() - 48 * 3600_000).toISOString();
      const [items, settings] = await Promise.all([listForSitemap(since, 1000), getPublicSettings()]);
      xml = buildNewsSitemap(items, siteUrl(), siteName(settings, "en"));
    } catch {
      // fall through with an empty but valid sitemap
    }
  }
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
