import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
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
  return (
    <html lang={lang}>
      <body className="flex min-h-screen flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationJsonLd({ name, url: siteUrl(), sameAs: Object.values(social) })) }}
        />
        <SiteHeader lang={lang} siteName={name} categories={categories} />
        {!configured && <p className="bg-amber-50 p-3 text-center text-sm text-amber-800">{t(lang, "notConfigured")}</p>}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <SiteFooter lang={lang} siteName={name} social={social} />
      </body>
    </html>
  );
}
