import type { Metadata } from "next";
import { requirePageSession } from "@/lib/auth/session";
import { WelcomeScreen } from "./welcome-screen";

export const metadata: Metadata = { title: "Welcome", robots: { index: false } };

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
}

/** Shown once after signing in, then continues to the dashboard. */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await requirePageSession();
  const { next } = await searchParams;
  const name = session.profile.full_name?.trim() || session.email?.split("@")[0] || "there";
  return <WelcomeScreen name={name.split(" ")[0]} fullName={name} avatarUrl={session.profile.avatar_url} role={session.profile.role ?? ""} next={safeNext(next)} />;
}
