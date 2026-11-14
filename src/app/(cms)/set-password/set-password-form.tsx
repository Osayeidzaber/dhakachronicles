"use client";

import { useActionState, useState } from "react";
import { PasswordInput } from "@/components/admin/password-input";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { GlowButton } from "@/components/ui/vendor/louis/glow-button";
import { setPassword, type SetPasswordState } from "./actions";

/** Strength hints, shown live as the person types. */
function rules(pw: string) {
  return [
    { ok: pw.length >= 10, label: "At least 10 characters" },
    { ok: /[a-z]/i.test(pw) && /\d/.test(pw), label: "Letters and numbers" },
    { ok: pw.length >= 14 || /[^a-z0-9]/i.test(pw), label: "A symbol, or 14+ characters" },
  ];
}

export function SetPasswordForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState<SetPasswordState, FormData>(setPassword, {});
  const [pw, setPw] = useState("");
  const checks = rules(pw);
  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <p role="alert" className="reveal flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
          {state.error}
        </p>
      )}
      <label className="block text-[13px] text-neutral-600">
        Your name (shown to the team)
        <input name="full_name" required defaultValue={defaultName} autoComplete="name" className="input mt-2 h-12 text-[15px]" />
      </label>
      <label className="block text-[13px] text-neutral-600">
        New password
        <PasswordInput
          name="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="input mt-2 h-12 text-[15px]"
          aria-describedby="pw-rules"
        />
      </label>
      <ul id="pw-rules" className="space-y-1.5 text-xs">
        {checks.map((c) => (
          <li key={c.label} className={`flex items-center gap-2 transition-colors duration-300 ${c.ok ? "text-white" : "text-muted"}`}>
            <span className={`grid h-4 w-4 place-items-center rounded-full border transition-all duration-300 ${c.ok ? "scale-100 border-white bg-white text-black" : "scale-90 border-line"}`}>
              {c.ok && <Check className="h-3 w-3" aria-hidden="true" />}
            </span>
            {c.label}
          </li>
        ))}
      </ul>
      <label className="block text-[13px] text-neutral-600">
        Confirm password
        <PasswordInput name="confirm" required minLength={10} autoComplete="new-password" className="input mt-2 h-12 text-[15px]" />
      </label>
      <GlowButton type="submit" disabled={pending} trigger="always" colors={["#9a9a9a", "#ffffff"]} className="mt-2 w-full text-[15px]">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving…
          </>
        ) : (
          <>
            Join the newsroom <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </GlowButton>
    </form>
  );
}
