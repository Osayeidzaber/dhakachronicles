"use client";

import { useEffect } from "react";

/** Counts one page view per article per browser session (analytics foundation). */
export function ViewBeacon({ articleId }: { articleId: string }) {
  useEffect(() => {
    const key = `viewed:${articleId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage unavailable; still count
    }
    const body = JSON.stringify({ articleId });
    if (!navigator.sendBeacon?.("/api/views", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/views", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
    }
  }, [articleId]);
  return null;
}
