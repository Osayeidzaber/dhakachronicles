"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import type { RetryState } from "@/app/(cms)/admin/actions";

/** Retry an import in place: spinner while it runs, result inline, then a soft data refresh (tab and scroll stay put). */
export function RetryButton({ action }: { action: (prev: RetryState) => Promise<RetryState> }) {
  const [state, run, pending] = useActionState<RetryState>(action, {});
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);
  if (state.ok) return <span className="text-xs text-emerald-300">Imported ✓</span>;
  return (
    <form action={run} className="flex flex-col items-start gap-1">
      <button disabled={pending} className="btn h-9 text-xs">
        {pending ? <Spinner className="size-3.5" /> : null}
        {pending ? "Retrying…" : "Retry"}
      </button>
      {state.error && <span className="max-w-[16rem] text-xs text-red-300">{state.error}</span>}
    </form>
  );
}
