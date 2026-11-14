import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { NOT_SET_UP } from "@/lib/supabase/session-cookie";

/** Service-role client: bypasses RLS. Only for cron jobs, provisioning and integrations. */
export function createAdminClient() {
  const cfg = supabaseConfig();
  if (!cfg?.secretKey) throw new AppError(NOT_SET_UP, "NOT_CONFIGURED");
  return createClient(cfg.url, cfg.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
