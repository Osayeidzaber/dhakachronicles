import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { env, siteUrl } from "@/lib/env";
import { notifyActivity } from "@/lib/discord";
import { shouldMirrorToDiscord } from "@/lib/discord-embed";

/**
 * Append an audit log entry. Uses the service role so a failed policy can never
 * silently drop the record; failures are logged but never break the user action.
 */
export async function audit(
  userId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("audit_logs")
      .insert({ user_id: userId, action, target_type: targetType, target_id: targetId, metadata });
    if (error) throw error;
  } catch (err) {
    log.error("audit.write_failed", { action, targetType, targetId, err });
  }
  log.info("audit", { userId, action, targetType, targetId });
  await sendActivity(userId, action, targetType, targetId, metadata);
}

/** Mirror the audit entry to the Discord activity channel (never throws). */
async function sendActivity(userId: string | null, action: string, targetType: string, targetId: string | null, metadata: Record<string, unknown>) {
  try {
    if (!env().DISCORD_ACTIVITY_WEBHOOK_URL) return;
    if (!shouldMirrorToDiscord(action, targetId, metadata)) return;
    let actor: string | null = null;
    let avatar: string | null = null;
    if (userId) {
      const { data } = await createAdminClient().from("profiles").select("full_name, avatar_url").eq("id", userId).maybeSingle();
      actor = data?.full_name ?? null;
      avatar = data?.avatar_url ?? null;
    }
    const adminUrl = targetType === "article" && targetId ? `${siteUrl()}/admin/articles/${targetId}` : `${siteUrl()}/admin`;
    await notifyActivity({ action, actor: actor ?? (userId ? "Staff member" : "System"), actorAvatar: avatar, targetType, targetId, metadata, adminUrl });
  } catch (err) {
    log.warn("audit.discord_failed", { action, err });
  }
}
