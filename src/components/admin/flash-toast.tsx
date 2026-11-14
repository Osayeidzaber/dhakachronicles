"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SwipeToast from "@/components/ui/vendor/reactbits/SwipeToast";
import StatusMark from "@/components/ui/vendor/reactbits/StatusMark";

/**
 * Shows the ?ok= / ?error= result of a form action as a swipe-to-dismiss toast,
 * then tidies the URL so a refresh doesn't show it again.
 */
export function FlashToast({ ok, error }: { ok?: string; error?: string }) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (!params.has("ok") && !params.has("error")) return;
    const next = new URLSearchParams(params);
    next.delete("ok");
    next.delete("error");
    const qs = next.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  }, [params, path, router]);

  if (!ok && !error) return null;
  return (
    <div className="fixed right-4 bottom-4 z-[60]">
      <SwipeToast
        open={open}
        onClose={() => setOpen(false)}
        title={error ? "Something went wrong" : ok}
        description={error ?? undefined}
        icon={<StatusMark status={error ? "failed" : "done"} size={18} />}
        duration={error ? 8000 : 3500}
        fuseColor={error ? "#fca5a5" : "#ffffff"}
      />
    </div>
  );
}
