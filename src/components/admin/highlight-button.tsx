"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { setHighlightAction } from "@/app/(cms)/admin/newsroom-actions";

/** One-click "pin to homepage" for a published story. */
export function HighlightButton({ articleId, active = false, compact = false }: { articleId: string; active?: boolean; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (active) {
    return (
      <span title="Highlighted on the homepage" className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-medium text-black">
        <Star className="h-3 w-3 fill-current" aria-hidden="true" />
        {!compact && "Highlighted"}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        aria-label="Highlight on homepage"
        title="Highlight on homepage"
        onClick={() =>
          start(async () => {
            const res = await setHighlightAction(articleId, 0);
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
        className="btn h-8 px-3 text-xs"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Star className="h-3 w-3" aria-hidden="true" />}
        {!compact && "Highlight"}
      </button>
      {error && <span className="mt-1 text-[11px] text-red-300">{error}</span>}
    </span>
  );
}
