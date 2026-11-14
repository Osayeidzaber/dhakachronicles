import { createAdminClient } from "@/lib/supabase/admin";
import { assertCronAuth, jsonHandler } from "@/lib/http";
import { autoSortBacklog, runSync } from "@/lib/instagram/sync";
import { instagramConfig } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Called by Supabase Cron. Syncs only when an account is connected and auto-import is on. */
export const POST = jsonHandler(async (req: Request) => {
  assertCronAuth(req);
  if (!instagramConfig()) return { skipped: "instagram_not_configured" };
  const admin = createAdminClient();
  const { data: account } = await admin.from("instagram_accounts").select("status, auto_import").limit(1).maybeSingle();
  if (!account || account.status !== "connected" || !account.auto_import) {
    // Even without auto-import, keep every story filed under a section with tags.
    return { skipped: "auto_import_off", sorted: await autoSortBacklog(admin) };
  }
  return runSync("cron", { maxPosts: 25, maxPages: 1 });
});
