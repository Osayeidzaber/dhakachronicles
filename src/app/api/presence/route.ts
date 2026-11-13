import { z } from "zod";
import { jsonHandler } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  articleId: z.uuid().nullish(),
  language: z.enum(["bn", "en"]),
});

/**
 * Anonymous "reading now" heartbeat, sent every 30s while a tab is visible.
 * Stores only a random session id, the article and a timestamp; no IP or user data.
 */
export const POST = jsonHandler(async (req: Request) => {
  const input = schema.parse(await req.json());
  await rateLimit(`presence:${await clientIp()}`, 60, 60);
  const { error } = await createPublicClient().rpc("reader_heartbeat", {
    p_session: input.sessionId,
    p_article_id: input.articleId ?? null,
    p_language: input.language,
  });
  if (error) throw error;
  return null;
});
