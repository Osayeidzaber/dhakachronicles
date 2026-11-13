import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "@/lib/env";
import { AppError } from "@/lib/errors";

/**
 * Per-request Supabase client acting as the signed-in user (RLS enforced).
 * All Supabase traffic goes through the Next.js server; the browser only holds
 * httpOnly session cookies, never the project URL or keys.
 */
export async function createClient() {
  // Read cookies first: this marks the route as dynamic even when not yet configured.
  const cookieStore = await cookies();
  const cfg = supabaseConfig();
  if (!cfg) throw new AppError("Supabase is not configured (see .env.example).", "NOT_CONFIGURED");
  return createServerClient(cfg.url, cfg.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) {
            cookieStore.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            });
          }
        } catch {
          // Called from a Server Component (read-only cookies); the proxy refreshes sessions.
        }
      },
    },
  });
}

/** Anonymous, cookie-less client for public reads (cache-friendly, RLS = public). */
export function createPublicClient() {
  const cfg = supabaseConfig();
  if (!cfg) throw new AppError("Supabase is not configured (see .env.example).", "NOT_CONFIGURED");
  return createServerClient(cfg.url, cfg.publishableKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
