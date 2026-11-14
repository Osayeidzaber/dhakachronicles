"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Lang } from "@/lib/db/types";
import { t } from "@/lib/i18n";

/** Compact sections menu: a small panel that drops down under the button (not a full-screen takeover). */
export function MobileMenu({ lang, categories }: { lang: Lang; categories: { slug: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const path = usePathname();

  useEffect(() => {
    if (!open) return;
    const btn = button.current;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !btn?.contains(target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    panel.current?.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      btn?.focus({ preventScroll: true });
    };
  }, [open]);

  const links = [
    { name: t(lang, "home"), href: `/${lang}`, exact: true },
    { name: t(lang, "latest"), href: `/${lang}/latest` },
    ...categories.map((c) => ({ name: c.name, href: `/${lang}/category/${c.slug}` })),
    { name: t(lang, "search"), href: `/${lang}/search` },
  ];

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-label={t(lang, "menu")}
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen((v) => !v)}
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border transition ${open ? "border-white bg-white text-black" : "border-line hover:border-white/40"}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h10" />}
        </svg>
      </button>

      {/* Light dim behind the panel; the page stays visible. */}
      <div aria-hidden="true" className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />

      <div
        ref={panel}
        id="site-menu"
        role="dialog"
        aria-label={t(lang, "menu")}
        className={`absolute top-[calc(100%+10px)] left-0 z-50 w-[min(320px,calc(100vw-2rem))] origin-top-left rounded-2xl border border-line bg-[#0a0a0a]/95 p-2 shadow-2xl backdrop-blur-xl transition duration-200 ease-out ${
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
        }`}
      >
        <p className="kicker px-3 pt-2 pb-1.5">{t(lang, "sectionsLabel")}</p>
        <ul className="max-h-[65vh] overflow-y-auto">
          {links.map((l) => {
            const active = l.exact ? path === l.href : path === l.href || path.startsWith(`${l.href}/`);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  tabIndex={open ? 0 : -1}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-[15px] transition ${active ? "bg-white/[0.08] text-white" : "text-neutral-700 hover:bg-white/[0.05] hover:text-white"}`}
                >
                  {l.name}
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
