import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

const PRIVATE = ["/admin", "/api", "/login", "/set-password", "/welcome", "/auth", "/en/ad-report", "/bn/ad-report"];
// Search and AI crawlers are welcome on the public site (news should be findable and citable).
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Google-Extended", "Applebot-Extended", "Bingbot", "CCBot"];

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE }, ...AI_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE }))],
    sitemap: [`${base}/sitemap.xml`, `${base}/news-sitemap.xml`],
    host: base,
  };
}
