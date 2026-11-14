import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { searchArticles } from "@/lib/articles/queries";
import { isConfigured } from "@/lib/public-data";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { localized, relativeTime } from "@/lib/i18n";
import { articlePath } from "@/lib/seo/defaults";

export const dynamic = "force-dynamic";

const qSchema = z.object({ q: z.string().trim().min(2).max(100), lang: z.enum(["en", "bn"]) });

/** Instant results for the header search box (6 stories, small thumbnails). */
export async function GET(req: NextRequest) {
  const parsed = qSchema.safeParse({ q: req.nextUrl.searchParams.get("q") ?? "", lang: req.nextUrl.searchParams.get("lang") ?? "en" });
  if (!parsed.success || !isConfigured()) return NextResponse.json({ items: [], total: 0 });
  try {
    await rateLimit(`search:${await clientIp()}`, 60, 60);
    const page = await searchArticles(parsed.data.lang, parsed.data.q, 1, 6);
    const items = page.items.map((a) => {
      const img = a.featured_image;
      const thumb = img ? ((img.variants ?? []).filter((v) => v.format === "webp" && v.width >= 160).sort((x, y) => x.width - y.width)[0]?.url ?? img.public_url) : null;
      return {
        id: a.id,
        title: a.title,
        href: articlePath(a.language, a.slug),
        section: a.category ? localized(a.category, "name", a.language) : null,
        when: relativeTime(a.published_at, a.language),
        thumb,
      };
    });
    return NextResponse.json({ items, total: page.total }, { headers: { "Cache-Control": "public, max-age=30" } });
  } catch {
    return NextResponse.json({ items: [], total: 0, error: "busy" }, { status: 200 });
  }
}
