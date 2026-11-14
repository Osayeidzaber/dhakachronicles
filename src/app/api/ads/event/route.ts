import { z } from "zod";
import { jsonHandler } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Counts an ad impression (live ads only; enforced in SQL). */
export const POST = jsonHandler(async (req: Request) => {
  const { id } = z.object({ id: z.uuid(), kind: z.literal("impression") }).parse(await req.json());
  await rateLimit(`ad-imp:${await clientIp()}`, 120, 60);
  const { error } = await createPublicClient().rpc("record_ad_event", { p_ad_id: id, p_kind: "impression" });
  if (error) throw error;
  return null;
});
