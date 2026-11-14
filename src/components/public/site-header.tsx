import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import type { ArticleCard, } from "@/lib/articles/queries";
import type { Category, Lang } from "@/lib/db/types";
import { localized, t } from "@/lib/i18n";
import { articlePath } from "@/lib/seo/defaults";
import { LanguageSwitcher } from "./language-switcher";
import { MobileMenu } from "./mobile-menu";
import { NavLink } from "./nav-link";
import { StaffLink } from "./staff-link";
import { HeaderSearch } from "./header-search";

function today(lang: Lang) {
  return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date());
}

export function SiteHeader({ lang, siteName, categories, breaking = [] }: { lang: Lang; siteName: string; categories: Category[]; breaking?: ArticleCard[] }) {
  const nav = categories.slice(0, 9);
  return (
    <header className="border-b border-white/[0.08] bg-black">
      <div className="border-b border-white/[0.08] text-xs text-muted">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 md:px-8">
          <span>{today(lang)} · {lang === "bn" ? "ঢাকা" : "Dhaka"}</span>
          <div className="flex items-center gap-4">
            <LanguageSwitcher lang={lang} label={t(lang, "otherEdition")} />
            <StaffLink label={t(lang, "staff")} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 pt-4 md:px-8 md:pt-8">
        <div className="flex items-center justify-between gap-4">
          <MobileMenu lang={lang} categories={nav.map((c) => ({ slug: c.slug, name: localized(c, "name", lang) }))} />
          <Link href={`/${lang}`} aria-label={siteName} className="flex flex-1 justify-center transition-opacity duration-300 hover:opacity-85">
            <Logo height={56} priority label={siteName} className="max-w-[62vw] md:max-w-none" />
          </Link>
          <HeaderSearch lang={lang} label={t(lang, "search")} placeholder={t(lang, "searchPlaceholder")} />
          <Link href={`/${lang}/search`} aria-label={t(lang, "search")} className="grid h-11 w-11 place-items-center rounded-full border border-line md:hidden">
            <SearchIcon />
          </Link>
        </div>
        <p className="mt-2 hidden text-center text-[11px] tracking-[0.2em] text-subtle uppercase sm:block">{t(lang, "tagline")}</p>
        <nav aria-label={t(lang, "sectionsLabel")} className="-mx-4 mt-4 overflow-x-auto border-t border-white/[0.08] [scrollbar-width:none] md:mx-0 md:mt-5 [&::-webkit-scrollbar]:hidden">
          <ul className="flex w-max min-w-full gap-6 px-4 py-3 text-sm whitespace-nowrap md:justify-center md:gap-7 md:px-0 md:py-3.5">
            <li>
              <NavLink href={`/${lang}`} exact>
                {t(lang, "home")}
              </NavLink>
            </li>
            <li>
              <NavLink href={`/${lang}/latest`}>{t(lang, "latest")}</NavLink>
            </li>
            {nav.map((c) => (
              <li key={c.id}>
                <NavLink href={`/${lang}/category/${c.slug}`}>{localized(c, "name", lang)}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {breaking.length > 0 && (
        <div className="mx-auto max-w-[1280px] px-4 pb-4 md:px-8">
          <div className="flex items-center gap-4 overflow-hidden rounded-xl border border-white/10 px-4 py-3">
            <span className="flex shrink-0 items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase">
              <span className="live-dot" aria-hidden="true" />
              {t(lang, "breaking")}
            </span>
            <div className="ticker relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_4%,#000_96%,transparent)]">
              <ul className="ticker-track flex w-max gap-10 text-sm text-neutral-700">
                {[...breaking, ...breaking].map((b, i) => (
                  <li key={`${b.id}-${i}`} aria-hidden={i >= breaking.length || undefined}>
                    <Link href={articlePath(b.language, b.slug)} tabIndex={i >= breaking.length ? -1 : undefined} className="hover:text-white">
                      {b.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter({ lang, siteName, social, categories }: { lang: Lang; siteName: string; social: Record<string, string>; categories: Category[] }) {
  return (
    <footer className="mt-24 border-t border-white/[0.08]">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-14 md:grid-cols-5 md:px-8">
        <div className="md:col-span-2">
          <Logo height={64} label={siteName} />
          <p className="mt-3 text-sm text-muted">{t(lang, "tagline")}</p>
          {Object.keys(social).length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {Object.entries(social).map(([k, url]) => (
                <li key={k}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="btn h-9 text-xs capitalize">
                    {k}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <FooterCol title={t(lang, "sectionsLabel")} links={categories.slice(0, 6).map((c) => [localized(c, "name", lang), `/${lang}/category/${c.slug}`])} />
        <FooterCol
          title={siteName}
          links={[
            [t(lang, "latest"), `/${lang}/latest`],
            [t(lang, "search"), `/${lang}/search`],
            [t(lang, "otherEdition"), `/${lang === "bn" ? "en" : "bn"}`],
          ]}
        />
        <FooterCol
          title={t(lang, "more")}
          links={[
            [lang === "bn" ? "আমাদের দল" : "Our team", `/${lang}/team`],
            [lang === "bn" ? "বিজ্ঞাপন দিন" : "Advertise", `/${lang}/advertise`],
            [t(lang, "privacy"), `/${lang}/privacy`],
            ["RSS", `/${lang}/rss.xml`],
            [t(lang, "staff"), "/login"],
          ]}
        />
      </div>
      <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-3 border-t border-white/5 px-4 py-5 text-xs text-subtle md:px-8">
        <span>
          © {new Date().getFullYear()} {siteName}. {t(lang, "allRights")}.
        </span>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="flex flex-col gap-2.5 text-sm">
      <span className="kicker" aria-hidden={title === "—" || undefined}>
        {title === "—" ? " " : title}
      </span>
      {links.map(([l, href]) => (
        <Link key={href} href={href} className="text-neutral-600 transition hover:text-white">
          {l}
        </Link>
      ))}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
