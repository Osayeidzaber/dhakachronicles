"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Lang } from "@/lib/db/types";

/**
 * Switches language keeping the same section where the slug is shared
 * (categories, authors, tags, search). Article pages link to their actual
 * translation themselves, so here they fall back to the other homepage.
 */
export function LanguageSwitcher({ lang, label }: { lang: Lang; label: string }) {
  const pathname = usePathname() ?? `/${lang}`;
  const other: Lang = lang === "bn" ? "en" : "bn";
  const rest = pathname.replace(/^\/(bn|en)/, "");
  const target = rest.startsWith("/news/") ? `/${other}` : `/${other}${rest}`;
  return (
    <Link href={target} hrefLang={other} lang={other} className="rounded border border-border px-2 py-1 text-sm hover:bg-neutral-50">
      {label}
    </Link>
  );
}
