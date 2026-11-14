"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/spinner";

/**
 * Form submit button with a pending state: disables itself and shows a spinner
 * plus "Saving…" (or a custom label) while the server action runs.
 */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className = "btn btn-primary",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-busy={pending} className={`${className} disabled:cursor-wait`}>
      {pending ? (
        <>
          <Spinner className="size-3.5" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
