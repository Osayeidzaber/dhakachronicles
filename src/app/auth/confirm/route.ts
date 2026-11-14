import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";

const querySchema = z.object({
  token_hash: z.string().min(10).max(500),
  type: z.enum(["invite", "recovery", "magiclink", "email"]),
  next: z.string().optional(),
});

/** Only same-site paths are allowed as a destination (no open redirects). */
function safeNext(next: string | undefined, type: string): string {
  const fallback = type === "invite" || type === "recovery" ? "/set-password" : "/admin";
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

/**
 * Landing page for links in Supabase auth emails (invite, password reset).
 * Verifies the one-time token server-side, which sets the httpOnly session cookie,
 * then sends the user on (invites go to /set-password).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  const fail = (reason: string) => {
    const to = url.clone();
    to.pathname = "/login";
    to.search = `?error=${reason}`;
    return NextResponse.redirect(to);
  };
  if (!parsed.success) return fail("invalid_link");
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: parsed.data.type, token_hash: parsed.data.token_hash });
    if (error) {
      log.warn("auth.confirm_failed", { type: parsed.data.type, message: error.message });
      return fail("link_expired");
    }
  } catch {
    return fail("not_configured");
  }
  const to = url.clone();
  to.pathname = safeNext(parsed.data.next, parsed.data.type);
  to.search = parsed.data.type === "invite" ? "?invited=1" : "";
  return NextResponse.redirect(to);
}
