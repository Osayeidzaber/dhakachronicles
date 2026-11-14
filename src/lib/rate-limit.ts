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
  if (!allowed) {
    await alertOnce(key);
    throw new AppError("Too many requests. Please wait and try again.", "RATE_LIMITED");
  }
}

/** Repeated sign-in failures look like abuse: alert, at most once per key every 15 minutes per instance. */
const alerted = new Map<string, number>();
async function alertOnce(key: string) {
  if (!key.startsWith("login:")) return;
  const now = Date.now();
  if ((alerted.get(key) ?? 0) > now - 15 * 60_000) return;
  alerted.set(key, now);
  const { notifyAlert } = await import("@/lib/discord");
  const [, kind, ...rest] = key.split(":");
  // Mask the identifier: show only a hint of the email or IP.
  const id = rest.join(":");
  const hint = kind === "email" ? id.replace(/^(.{2}).*(@.*)$/, "$1…$2") : id.replace(/(\d+)$/, "x");
  await notifyAlert({
    title: "Too many failed sign-ins",
    detail: "Sign-in was blocked for 15 minutes after repeated attempts. If this wasn't a staff member, someone may be guessing passwords.",
    source: "auth.rate_limit",
    fields: { "Blocked by": kind === "email" ? "Account" : "IP address", Who: hint },
  });
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
