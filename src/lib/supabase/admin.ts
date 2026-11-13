import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/env";
import { AppError } from "@/lib/errors";

/** Service-role client: bypasses RLS. Only for cron jobs, provisioning and integrations. */
export function createAdminClient() {
  const cfg = supabaseConfig();
  if (!cfg?.secretKey) throw new AppError("SUPABASE_SECRET_KEY is not configured.", "NOT_CONFIGURED");
  return createClient(cfg.url, cfg.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
