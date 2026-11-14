import "server-only";
import { z } from "zod";
import { aiSeoConfig } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { Lang } from "@/lib/db/types";

const NAMES: Record<Lang, string> = { en: "English", bn: "Bangla (Bengali script)" };

export function translationAvailable(): boolean {
  return aiSeoConfig() !== null;
}

/** Split strings into batches small enough for one request. */
export function batchTexts(texts: string[], maxChars = 5000, maxItems = 60): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let size = 0;
  for (const t of texts) {
    if (cur.length && (size + t.length > maxChars || cur.length >= maxItems)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(t);
    size += t.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

const resultSchema = z.object({ t: z.array(z.string()) });

/**
 * Machine translation through the configured OpenAI-compatible endpoint (same as AI SEO).
 * Returns one translation per input, in order. The result is a draft: an editor must review it.
 */
export async function translateTexts(texts: string[], from: Lang, to: Lang): Promise<string[]> {
  const cfg = aiSeoConfig();
  if (!cfg) throw new AppError("Automatic translation is not set up (AI_SEO_API_URL / AI_SEO_API_KEY).", "NOT_CONFIGURED");
  const out: string[] = [];
  for (const batch of batchTexts(texts)) {
    const prompt = `You are a professional news translator for a Bangladeshi newspaper. Translate each string in the JSON array "t" from ${NAMES[from]} to ${NAMES[to]}.
Rules: keep meaning exact; do not add or remove facts; keep names, numbers, @handles, #hashtags and URLs as they are; use natural newspaper style; keep leading/trailing spaces.
Respond only with JSON {"t": [...]} containing exactly ${batch.length} strings in the same order.

${JSON.stringify({ t: batch })}`;
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, temperature: 0.2 }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new AppError(`Translation service returned ${res.status}.`, "INTERNAL");
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    let parsed: z.infer<typeof resultSchema>;
    try {
      parsed = resultSchema.parse(JSON.parse(body.choices?.[0]?.message?.content ?? ""));
    } catch {
      throw new AppError("The translation service returned an unexpected answer. Try again.", "INTERNAL");
    }
    if (parsed.t.length !== batch.length) throw new AppError("The translation came back incomplete. Try again.", "INTERNAL");
    out.push(...parsed.t);
  }
  return out;
}
