"use client";

import { useEffect, useRef } from "react";

/** Counts one impression once at least half the ad has been on screen for a second. */
export function AdTracker({ id, children }: { id: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sent = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (sent) return;
        if (entry.isIntersecting) {
          timer = setTimeout(() => {
            sent = true;
            io.disconnect();
            const body = JSON.stringify({ id, kind: "impression" });
            const queued = navigator.sendBeacon?.("/api/ads/event", new Blob([body], { type: "application/json" }));
            if (!queued) fetch("/api/ads/event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
          }, 1000);
        } else clearTimeout(timer);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      clearTimeout(timer);
      io.disconnect();
    };
  }, [id]);
  return <div ref={box}>{children}</div>;
}
