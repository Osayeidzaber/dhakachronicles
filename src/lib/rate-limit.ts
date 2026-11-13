import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/logger";

/**
 * Database-backed fixed-window rate limit (works across serverless instances).
 * Fails open if the database is unreachable, so an outage doesn't lock everyone out.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  let allowed = true;
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    allowed = data === true;
  } catch (err) {
    log.warn("rate_limit.unavailable", { key, err });
  }
  if (!allowed) throw new AppError("Too many requests. Please wait and try again.", "RATE_LIMITED");
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
