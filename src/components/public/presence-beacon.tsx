"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { Lang } from "@/lib/db/types";

function sessionId(): string {
  try {
    let id = sessionStorage.getItem("dc-presence");
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "");
      sessionStorage.setItem("dc-presence", id);
    }
    return id;
  } catch {
    return crypto.randomUUID().replace(/-/g, "");
  }
}

/**
 * "Reading now" heartbeat: every 30s while the tab is visible, sends a random
 * per-tab id and the article being read (from [data-article-id]). No personal data.
 */
export function PresenceBeacon({ lang }: { lang: Lang }) {
  const path = usePathname();
  useEffect(() => {
    const id = sessionId();
    const send = () => {
      if (document.visibilityState !== "visible") return;
      const articleId = document.querySelector<HTMLElement>("[data-article-id]")?.dataset.articleId ?? null;
      void fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id, articleId, language: lang }),
        keepalive: true,
      }).catch(() => undefined);
    };
    const first = window.setTimeout(send, 1500);
    const timer = window.setInterval(send, 30_000);
    document.addEventListener("visibilitychange", send);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", send);
    };
  }, [path, lang]);
  return null;
}
