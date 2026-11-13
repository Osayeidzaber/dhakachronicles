import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/** Service-role client: bypasses RLS. Only for cron jobs, provisioning and integrations. */
export function createAdminClient() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = env();
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
