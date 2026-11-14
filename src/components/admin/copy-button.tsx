"use client";

import { useState } from "react";

/** Copies a value and says so. */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  return (
    <button
      type="button"
      className="btn shrink-0"
      aria-live="polite"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState("done");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2000);
      }}
    >
      {state === "done" ? "Copied" : state === "failed" ? "Select and copy" : label}
    </button>
  );
}
