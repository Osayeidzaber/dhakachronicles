import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createPublicClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

type LiveAd = { id: string; link_url: string };

/** Counts a click, then sends the reader to the advertiser. Only ads running now redirect. */
export async function GET(req: Request) {
  const home = NextResponse.redirect(new URL("/", siteUrl()));
  const id = z.uuid().safeParse(new URL(req.url).searchParams.get("id"));
  if (!id.success) return home;
  const sb = createPublicClient();
  const [a, b] = await Promise.all([sb.rpc("live_ads", { p_placement: "home" }), sb.rpc("live_ads", { p_placement: "article" })]);
  const ad = [...((a.data ?? []) as LiveAd[]), ...((b.data ?? []) as LiveAd[])].find((x) => x.id === id.data);
  if (!ad) return home;
  try {
    await rateLimit(`ad-click:${await clientIp()}`, 30, 60);
    await sb.rpc("record_ad_event", { p_ad_id: ad.id, p_kind: "click" });
  } catch (err) {
    // Too many clicks from one address are not counted, but the reader still gets through.
    log.warn("ads.click_not_counted", { err });
  }
  return NextResponse.redirect(ad.link_url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
