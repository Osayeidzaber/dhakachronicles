"use client";

import { useActionState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { GlowButton } from "@/components/ui/vendor/louis/glow-button";
import { signIn, type LoginState } from "./actions";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-5">
      {notice && <p className="rounded-xl border border-line p-3 text-sm text-neutral-700">{notice}</p>}
      {state.error && (
        <p role="alert" className="reveal flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
          {state.error}
        </p>
      )}
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block text-[13px] text-neutral-600">
        Email
        <input name="email" type="email" required autoComplete="email" placeholder="you@dhakachronicles.com" className="input mt-2 h-12 text-[15px]" />
      </label>
      <label className="block text-[13px] text-neutral-600">
        Password
        <input name="password" type="password" required autoComplete="current-password" className="input mt-2 h-12 text-[15px]" />
      </label>
      <GlowButton type="submit" disabled={pending} trigger="always" colors={["#9a9a9a", "#ffffff"]} className="mt-2 w-full text-[15px]">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Signing in…
          </>
        ) : (
          <>
            Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </GlowButton>
    </form>
  );
}
