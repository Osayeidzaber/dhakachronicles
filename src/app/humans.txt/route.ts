import { siteUrl } from "@/lib/env";
import { OZ } from "@/lib/oz";

export const dynamic = "force-static";

/** humanstxt.org: who made this site. */
export function GET() {
  const body = `/* TEAM */
Website design & development: ${OZ.name}
Site: ${OZ.url}
Instagram: ${OZ.instagram}
From: Dhaka, Bangladesh

Journalism: Dhaka Chronicles newsroom
Site: ${siteUrl()}

/* SITE */
Last update: ${new Date().toISOString().slice(0, 10)}
Languages: English, Bangla
Standards: HTML5, CSS3, schema.org, Open Graph
Software: Next.js, React, TypeScript, Tailwind CSS, Supabase, Cloudflare R2
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
