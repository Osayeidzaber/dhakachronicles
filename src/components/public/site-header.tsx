import Link from "next/link";
import type { Category, Lang } from "@/lib/db/types";
import { localized, t } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";

export function SiteHeader({ lang, siteName, categories }: { lang: Lang; siteName: string; categories: Category[] }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href={`/${lang}`} className="text-2xl font-extrabold tracking-tight">
          {siteName}
        </Link>
        <div className="flex items-center gap-2">
          <form action={`/${lang}/search`} role="search" className="hidden sm:block">
            <input name="q" type="search" placeholder={t(lang, "searchPlaceholder")} aria-label={t(lang, "search")} className="rounded border border-border px-2 py-1 text-sm" />
          </form>
          <Link href={`/${lang}/search`} className="text-sm underline sm:hidden">
            {t(lang, "search")}
          </Link>
          <LanguageSwitcher lang={lang} label={t(lang, "switchLang")} />
        </div>
      </div>
      <nav aria-label={t(lang, "categories")} className="mx-auto max-w-6xl overflow-x-auto px-4">
        <ul className="flex gap-4 pb-3 text-sm font-medium whitespace-nowrap">
          <li>
            <Link href={`/${lang}`}>{t(lang, "home")}</Link>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/${lang}/category/${c.slug}`}>{localized(c, "name", lang)}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export function SiteFooter({ lang, siteName, social }: { lang: Lang; siteName: string; social: Record<string, string> }) {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted">
        <p>
          © {new Date().getFullYear()} {siteName}. {t(lang, "allRights")}
        </p>
        <ul className="flex gap-4">
          {Object.entries(social).map(([k, url]) => (
            <li key={k}>
              <a href={url} target="_blank" rel="noopener noreferrer" className="capitalize underline">
                {k}
              </a>
            </li>
          ))}
          <li>
            <Link href={`/${lang}/privacy`} className="underline">
              {lang === "bn" ? "গোপনীয়তা নীতি" : "Privacy"}
            </Link>
          </li>
          <li>
            <a href={`/${lang}/rss.xml`} className="underline">
              RSS
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
