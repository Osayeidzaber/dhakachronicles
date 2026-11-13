import "server-only";
import { z } from "zod";
import { aiSeoConfig } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { truncate } from "@/lib/content/tiptap";
import type { Lang } from "@/lib/db/types";

/**
 * Optional AI SEO suggestions. Provider-agnostic: any OpenAI-compatible
 * /chat/completions endpoint (AI_SEO_API_URL + AI_SEO_API_KEY + AI_SEO_MODEL).
 * Never required for publishing; editors review every suggestion.
 */
export const aiSeoResultSchema = z.object({
  seo_title: z.string().max(200),
  seo_description: z.string().max(400),
  focus_keyword: z.string().max(100),
  excerpt: z.string().max(600).optional(),
});
export type AiSeoResult = z.infer<typeof aiSeoResultSchema>;

export function aiSeoAvailable(): boolean {
  return aiSeoConfig() !== null;
}

export async function generateSeoSuggestions(p: { language: Lang; title: string; body: string }): Promise<AiSeoResult> {
  const cfg = aiSeoConfig();
  if (!cfg) throw new AppError("AI SEO is not configured.", "NOT_CONFIGURED");
  const langName = p.language === "bn" ? "Bangla" : "English";
  const prompt = `You write SEO metadata for a news article. Respond in ${langName} only, as JSON with keys seo_title (<=60 chars), seo_description (<=155 chars), focus_keyword (1-4 words), excerpt (<=300 chars). Be factual; do not add claims not in the article.

Headline: ${p.title}

Article:
${truncate(p.body, 6000)}`;

  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new AppError(`AI provider returned ${res.status}.`, "INTERNAL");
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  try {
    return aiSeoResultSchema.parse(JSON.parse(text));
  } catch {
    throw new AppError("AI provider returned an unexpected response.", "INTERNAL");
  }
}
