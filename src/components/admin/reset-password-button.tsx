"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { ResetPasswordState } from "@/app/(cms)/admin/actions";

/** Main-admin control: set a new temporary password and show it once, with a copy button. */
export function ResetPasswordButton({ action }: { action: (prev: ResetPasswordState) => Promise<ResetPasswordState> }) {
  const [state, run, pending] = useActionState<ResetPasswordState>(action, {});
  const [copied, setCopied] = useState(false);
  if (state.password) {
    return (
      <div className="space-y-2 rounded-xl border border-white/15 bg-white/[0.03] p-3 text-xs">
        <p className="text-neutral-700">New temporary password{state.email ? ` for ${state.email}` : ""}. Share it privately; it won’t be shown again.</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-black px-2.5 py-1.5 font-mono text-[13px] text-white">{state.password}</code>
          <button
            type="button"
            className="btn h-8 px-3 text-xs"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.password!);
                setCopied(true);
              } catch {
                /* clipboard blocked */
              }
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <form action={run} className="space-y-1.5">
      <button disabled={pending} className="btn h-9 text-xs">
        {pending ? <Spinner className="size-3.5" /> : <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />}
        {pending ? "Resetting…" : "Reset password"}
      </button>
      {state.error && <p className="text-xs text-red-300">{state.error}</p>}
    </form>
  );
}
