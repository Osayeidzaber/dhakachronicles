import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { getMediaInsights, type MediaInsights } from "@/lib/instagram/client";
import { getConnectedAccount } from "@/lib/instagram/sync";

export type PostInsights =
  | { state: "ok"; insights: MediaInsights }
  | { state: "not_connected" }
  | { state: "error" };

/**
 * Live Insights (views, reach, saves, shares, interactions) for one imported post, for the editor.
 * Never throws: the article page must render even when Instagram is down or not connected.
 */
export async function postInsights(mediaId: string): Promise<PostInsights> {
  try {
    const conn = await getConnectedAccount(createAdminClient());
    if (!conn) return { state: "not_connected" };
    const insights = await getMediaInsights({ token: conn.token, appSecret: conn.appSecret }, mediaId);
    return { state: "ok", insights };
  } catch (err) {
    log.warn("instagram.insights_failed", { mediaId, error: err instanceof Error ? err.message : String(err) });
    return { state: "error" };
  }
}
