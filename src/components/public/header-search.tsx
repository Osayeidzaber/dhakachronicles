"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";
import type { Lang } from "@/lib/db/types";

type Hit = { id: string; title: string; href: string; section: string | null; when: string; thumb: string | null };

/**
 * Header search with instant previews: results drop down as you type (debounced),
 * Enter opens the full search page, Escape closes the panel.
 */
export function HeaderSearch({ lang, label, placeholder }: { lang: Lang; label: string; placeholder: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search?lang=${lang}&q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const d = (await r.json()) as { items: Hit[]; total: number };
        setHits(d.items ?? []);
        setTotal(d.total ?? 0);
        setOpen(true);
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q, lang]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={box} className="relative hidden md:block">
      <form action={`/${lang}/search`} role="search" onSubmit={() => setOpen(false)}>
        <label className="group flex h-11 items-center gap-2 rounded-full border border-line bg-transparent px-4 text-sm text-muted transition-[border-color,background-color] duration-300 ease-out focus-within:border-white/50 focus-within:bg-white/[0.04] hover:border-white/30">
          {loading ? (
            <Spinner className="size-4" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          )}
          <span className="sr-only">{label}</span>
          <input
            name="q"
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (e.target.value.trim().length < 2) setOpen(false);
            }}
            onFocus={() => q.trim().length >= 2 && setOpen(true)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            placeholder={placeholder}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showPanel}
            aria-controls="header-search-results"
            className="w-40 bg-transparent text-white outline-none transition-[width] duration-300 ease-out placeholder:text-muted focus:w-60 lg:w-48 lg:focus:w-72 [&::-webkit-search-cancel-button]:appearance-none"
          />
        </label>
      </form>

      <div
        id="header-search-results"
        role="listbox"
        aria-label={label}
        className={`absolute top-[calc(100%+8px)] right-0 z-50 w-[min(420px,90vw)] origin-top-right rounded-2xl border border-line bg-[#0a0a0a]/95 p-2 shadow-2xl backdrop-blur-xl transition duration-200 ${
          showPanel ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
        }`}
      >
        {hits.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted">{loading ? "Searching…" : lang === "bn" ? "কিছু পাওয়া যায়নি" : "No stories match yet"}</p>
        ) : (
          <ul>
            {hits.map((h) => (
              <li key={h.id} role="option" aria-selected={false}>
                <Link href={h.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.05]">
                  {h.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small R2 thumbnail
                    <img src={h.thumb} alt="" className="h-14 w-11 shrink-0 rounded-lg object-cover object-top" />
                  ) : (
                    <span className="h-14 w-11 shrink-0 rounded-lg bg-surface-3" />
                  )}
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[14px] leading-snug text-white">{h.title}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">{[h.section, h.when].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {hits.length > 0 && (
          <Link
            href={`/${lang}/search?q=${encodeURIComponent(q.trim())}`}
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-xl px-3 py-2.5 text-center text-[13px] text-neutral-700 transition hover:bg-white/[0.05] hover:text-white"
          >
            {lang === "bn" ? `সব ফল দেখুন (${total}) →` : `See all ${total} results →`}
          </Link>
        )}
      </div>
    </div>
  );
}
