import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const notice =
    error === "no_access"
      ? "Your account does not have CMS access yet. Ask an administrator."
      : error === "not_configured"
        ? "Supabase is not configured yet. Add SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY to the server environment."
        : undefined;
  return (
    <main className="admin flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Dhaka Chronicles CMS</h1>
        <p className="mb-6 text-sm text-neutral-500">Staff sign-in. Accounts are created by administrators.</p>
        <LoginForm next={next} notice={notice} />
      </div>
    </main>
  );
}
