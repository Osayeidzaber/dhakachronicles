import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { can, type Permission } from "@/lib/auth/permissions";
import type { Profile } from "@/lib/db/types";
import { supabaseConfig } from "@/lib/env";

export interface StaffSession {
  userId: string;
  email: string | null;
  profile: Profile;
}

/** Current user + profile, or null. Uses getUser() (verified with Supabase Auth, not just the cookie). */
export const getSession = cache(async (): Promise<StaffSession | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (!profile) return null;
  return { userId: data.user.id, email: data.user.email ?? null, profile: profile as Profile };
});

/** For pages: redirect to login if signed out, show forbidden if lacking the permission. */
export async function requirePageSession(permission?: Permission): Promise<StaffSession> {
  if (!supabaseConfig()) redirect("/login?error=not_configured");
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.profile.role || !session.profile.is_active) redirect("/login?error=no_access");
  if (permission && !can(session.profile.role, permission)) redirect("/admin?error=forbidden");
  return session;
}

/** For server actions and route handlers: throw instead of redirecting. */
export async function requireSession(permission?: Permission): Promise<StaffSession> {
  const session = await getSession();
  if (!session) throw new AppError("You must be signed in.", "UNAUTHORIZED");
  if (!session.profile.role || !session.profile.is_active) throw new AppError("Your account has no CMS access.", "FORBIDDEN");
  if (permission && !can(session.profile.role, permission)) {
    throw new AppError("You do not have permission to do that.", "FORBIDDEN");
  }
  return session;
}

/** Record "last active" for the team page, at most every 5 minutes. */
export async function touchLastSeen(session: StaffSession): Promise<void> {
  const seen = session.profile.last_seen_at ? new Date(session.profile.last_seen_at).getTime() : 0;
  if (Date.now() - seen < 5 * 60_000) return;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient().from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", session.userId);
}
