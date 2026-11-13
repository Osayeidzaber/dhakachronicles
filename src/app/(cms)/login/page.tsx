import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { LoginArt, LoginHeadline } from "./login-art";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const notice =
    error === "no_access"
      ? "Your account does not have newsroom access yet. Ask an administrator."
      : error === "not_configured"
        ? "Supabase is not configured yet. Add SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY to the server environment."
        : undefined;
  return (
    <main className="flex min-h-screen flex-wrap bg-black text-white">
      <section className="relative flex min-h-[46vh] min-w-0 flex-[1_1_560px] flex-col justify-between overflow-hidden border-white/5 p-8 md:min-h-screen md:border-r md:p-12">
        <LoginArt />
        <Link href="/" className="font-display relative z-10 text-3xl">
          Dhaka Chronicles
        </Link>
        <div className="pointer-events-none relative z-10">
          <p className="kicker">Newsroom</p>
          <LoginHeadline />
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted">Write, edit and publish in Bangla and English.</p>
        </div>
        <p className="relative z-10 text-xs text-subtle">Accounts are created by an administrator.</p>
      </section>
      <section className="flex min-w-0 flex-[1_1_480px] items-center justify-center px-6 py-12">
        <div className="reveal w-full max-w-sm">
          <h1 className="text-3xl font-medium tracking-tight">Sign in</h1>
          <p className="mt-2 mb-8 text-sm text-muted">Use your newsroom account.</p>
          <LoginForm next={next} notice={notice} />
        </div>
      </section>
    </main>
  );
}
