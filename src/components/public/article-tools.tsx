"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import WarmTooltip from "@/components/ui/vendor/reactbits/WarmTooltip";

/** Thin white bar at the top that fills as you read. */
export function ReadingProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = document.querySelector("[data-article-body]");
      if (!el || !bar.current) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.6;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      bar.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-40 h-0.5 bg-white/5" aria-hidden="true">
      <div ref={bar} className="h-full origin-left scale-x-0 bg-white" />
    </div>
  );
}

/** Copy link, native share, and WhatsApp / Facebook / X / LinkedIn links. */
export function ShareBar({ url, title, labels }: { url: string; title: string; labels: { share: string; copy: string; copied: string } }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const links = [
    ["WhatsApp", `https://wa.me/?text=${enc(`${title} ${url}`)}`],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
    ["X", `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`],
  ];
  const iconBtn = "grid h-10 w-10 place-items-center rounded-full border border-white/20 transition hover:border-white/60";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <WarmTooltip content={copied ? labels.copied : labels.copy}>
        <button
          type="button"
          aria-label={copied ? labels.copied : labels.copy}
          className={iconBtn}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
        </button>
        </WarmTooltip>
        <WarmTooltip content={labels.share}>
        <button
          type="button"
          aria-label={labels.share}
          className={iconBtn}
          onClick={() => {
            if ("share" in navigator) navigator.share({ title, url }).catch(() => undefined);
            else window.open(`https://wa.me/?text=${enc(`${title} ${url}`)}`, "_blank", "noopener");
          }}
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </button>
        </WarmTooltip>
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {links.map(([name, href]) => (
          <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
            {name}
          </a>
        ))}
      </p>
    </div>
  );
}

const SIZES = [16, 18, 20, 22, 24];

/** A− / A+ reading size for the article body (remembered on this device). */
export function TextSize({ labels }: { labels: { smaller: string; larger: string } }) {
  // Server and first client render use the default; the saved size is applied right after hydration.
  const [i, setI] = useState(1);
  const loaded = useRef(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem("dc-text-size");
        const saved = Number(raw);
        if (raw !== null && saved >= 0 && saved < SIZES.length) setI(saved);
      } catch {
        /* storage blocked */
      }
      loaded.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    // A CSS variable on <html> survives re-renders of the article body (see .prose-article[data-article-body]).
    document.documentElement.style.setProperty("--article-size", `${SIZES[i]}px`);
    if (!loaded.current) return; // don't overwrite the saved size with the default on first render
    try {
      localStorage.setItem("dc-text-size", String(i));
    } catch {
      /* storage blocked */
    }
  }, [i]);
  const btn = "grid h-10 min-w-10 place-items-center rounded-full border border-white/20 px-3 text-sm transition hover:border-white/60 disabled:opacity-40";
  return (
    <div className="flex gap-1" role="group" aria-label="Text size">
      <button type="button" className={btn} onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} aria-label={labels.smaller}>
        A−
      </button>
      <button type="button" className={btn} onClick={() => setI((v) => Math.min(SIZES.length - 1, v + 1))} disabled={i === SIZES.length - 1} aria-label={labels.larger}>
        A+
      </button>
    </div>
  );
}
