"use client";

import { useEffect } from "react";

const KEY = "dc-keep-scroll";

/**
 * Hold the page at scroll position `y` while it reloads or re-renders after a save.
 * Keeps correcting until the page has fully loaded and the position has held for 1.5 s (max 15 s).
 * Stops the moment the reader scrolls, types or touches the page themselves.
 */
function holdScroll(y: number): () => void {
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  const opts = { passive: true } as const;
  window.addEventListener("wheel", stop, opts);
  window.addEventListener("touchmove", stop, opts);
  window.addEventListener("keydown", stop);
  const started = Date.now();
  const page = location.pathname; // a save that opens another page should start at its top
  let lastFix = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    if (location.pathname !== page || stopped || now - started > 15_000) return cleanup();
    // Done once the page has loaded and the position has held for 1.5 s.
    if (document.readyState === "complete" && now - lastFix > 1500) {
      cleanup();
      try {
        sessionStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    const room = document.documentElement.scrollHeight - window.innerHeight;
    if (Math.abs(window.scrollY - Math.min(y, room)) > 2 && room > 0) {
      window.scrollTo({ top: Math.min(y, room), behavior: "instant" as ScrollBehavior });
      lastFix = now;
    }
  }, 50);
  function cleanup() {
    clearInterval(timer);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchmove", stop);
    window.removeEventListener("keydown", stop);
  }
  return cleanup;
}

/** Keeps your place on the page after saving (or filtering), instead of jumping to the top. */
export function KeepScroll() {
  useEffect(() => {
    let release: (() => void) | null = null;

    // After a full page load (e.g. a plain form), restore the position saved just before it.
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { path: string; y: number; at: number } | null;
      // Kept until the restore finishes, so React's double start in development can't lose it.
      if (saved && saved.path === location.pathname && Date.now() - saved.at < 60_000 && saved.y > 0) release = holdScroll(saved.y);
    } catch {
      /* storage unavailable */
    }

    // On every submit: remember the spot (for full reloads) and hold it while the save re-renders the page.
    const onSubmit = () => {
      const y = window.scrollY;
      if (y <= 0) return;
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ path: location.pathname, y, at: Date.now() }));
      } catch {
        /* ignore */
      }
      release?.();
      release = holdScroll(y);
    };
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      release?.();
    };
  }, []);

  return null;
}
