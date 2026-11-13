import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";

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
}
