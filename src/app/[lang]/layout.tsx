import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { fontVars } from "../fonts";
import { PresenceBeacon } from "@/components/public/presence-beacon";
import { listBreaking, type ArticleCard } from "@/lib/articles/queries";
import { LOCALES, isLang, t } from "@/lib/i18n";
import { siteUrl } from "@/lib/env";
import { getSiteChrome } from "@/lib/public-data";
import { seoDefaults, siteName, socialLinks } from "@/lib/settings";
import { organizationJsonLd, safeJsonLd } from "@/lib/seo/jsonld";
import { SiteFooter, SiteHeader } from "@/components/public/site-header";

export const revalidate = 300;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const { settings } = await getSiteChrome();
  const name = siteName(settings, lang);
  const d = seoDefaults(settings);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: name, template: `%s${d.title_suffix || ` | ${name}`}` },
    description: (lang === "bn" ? d.description_bn : d.description_en) || undefined,
    alternates: {
      canonical: `/${lang}`,
      languages: { bn: "/bn", en: "/en", "x-default": "/bn" },
      types: { "application/rss+xml": `/${lang}/rss.xml` },
    },
    openGraph: { siteName: name, locale: lang === "bn" ? "bn_BD" : "en_US", type: "website" },
  };
}

/** Root layout for the public site: one per language so <html lang> is correct. */
export default async function PublicLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const { settings, categories, configured } = await getSiteChrome();
  const name = siteName(settings, lang);
  const social = socialLinks(settings);
  let breaking: ArticleCard[] = [];
  if (configured) {
    try {
      breaking = await listBreaking(lang, 6);
    } catch {
      breaking = [];
    }
  }
  return (
    <html lang={lang} className={fontVars}>
      <body className="flex min-h-screen flex-col bg-black text-white">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-black">
          {lang === "bn" ? "মূল লেখায় যান" : "Skip to content"}
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationJsonLd({ name, url: siteUrl(), sameAs: Object.values(social) })) }}
        />
        <SiteHeader lang={lang} siteName={name} categories={categories} breaking={breaking} />
        {!configured && <p className="border-b border-line p-3 text-center text-sm text-muted">{t(lang, "notConfigured")}</p>}
        <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 md:px-8 md:py-10">
          {children}
        </main>
        <PresenceBeacon lang={lang} />
        <SiteFooter lang={lang} siteName={name} social={social} categories={categories} />
      </body>
    </html>
  );
}
