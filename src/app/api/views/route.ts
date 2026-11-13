import { z } from "zod";
import { jsonHandler } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Records an article view (published articles only; enforced in SQL). */
export const POST = jsonHandler(async (req: Request) => {
  const { articleId } = z.object({ articleId: z.uuid() }).parse(await req.json());
  await rateLimit(`views:${await clientIp()}`, 120, 60);
  const { error } = await createPublicClient().rpc("record_article_view", { p_article_id: articleId });
  if (error) throw error;
  return null;
});
