import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/env";
import { LoginArt } from "../login/login-art";
import { SetPasswordForm } from "./set-password-form";
import { OnboardingSteps } from "./onboarding-steps";

export const metadata: Metadata = { title: "Set your password", robots: { index: false } };

/** Where invited staff (and password resets) land after the email link is verified. */
export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ invited?: string }> }) {
  const { invited } = await searchParams;
  if (!supabaseConfig()) redirect("/login?error=not_configured");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?error=link_expired");
  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", data.user.id).maybeSingle();
  const name = profile?.full_name ?? (data.user.user_metadata?.full_name as string | undefined) ?? "";
  const first = name.split(" ")[0];

  return (
    <main className="flex min-h-screen flex-wrap bg-black text-white">
      <section className="relative flex min-h-[40vh] min-w-0 flex-[1_1_520px] flex-col justify-between overflow-hidden border-white/5 p-8 md:min-h-screen md:border-r md:p-12">
        <LoginArt />
        <Link href="/" aria-label="Dhaka Chronicles" className="relative z-10 block w-fit transition-opacity duration-300 hover:opacity-85">
          <Logo height={44} priority className="drop-shadow-[0_1px_10px_rgba(0,0,0,0.65)]" />
        </Link>
        <div className="pointer-events-none relative z-10">
          <p className="kicker">{invited ? "You're invited" : "Newsroom"}</p>
          <h2 className="font-display mt-4 text-[clamp(2.6rem,5vw,4.4rem)] leading-[1.02]">
            {invited ? <>Welcome to the newsroom{first ? `, ${first}` : ""}.</> : "Choose a new password."}
          </h2>
          {profile?.role && <p className="mt-6 text-base text-muted capitalize">You&apos;re joining as {profile.role}.</p>}
        </div>
        <p className="relative z-10 text-xs text-subtle">Your password is never shown to anyone, including administrators.</p>
      </section>
      <section className="flex min-w-0 flex-[1_1_440px] items-center justify-center px-6 py-12">
        <div className="reveal w-full max-w-sm">
          <h1 className="text-3xl font-medium tracking-tight">{invited ? "Set up your account" : "Set your password"}</h1>
          <p className="mt-2 mb-6 text-sm text-muted">{data.user.email}</p>
          {invited && (
            <div className="mb-8">
              <OnboardingSteps />
            </div>
          )}
          <SetPasswordForm defaultName={name} />
        </div>
      </section>
    </main>
  );
}
