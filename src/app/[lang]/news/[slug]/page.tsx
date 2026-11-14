import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { formatDate, isLang, localDigits, localized, readMinutes, t } from "@/lib/i18n";
import { siteUrl } from "@/lib/env";
import { getSiteChrome, isConfigured } from "@/lib/public-data";
import { getPublishedArticle, listMostRead, listRelated } from "@/lib/articles/queries";
import { siteName } from "@/lib/settings";
import { buildArticleMetadata } from "@/lib/seo/metadata";
import { articlePath, resolveSeo } from "@/lib/seo/defaults";
import { breadcrumbJsonLd, newsArticleJsonLd, safeJsonLd } from "@/lib/seo/jsonld";
import { RichText } from "@/components/content/rich-text";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ResponsiveImage } from "@/components/public/responsive-image";
import { ArticleCard } from "@/components/public/article-card";
import { ViewBeacon } from "@/components/public/view-beacon";
import { ReadingProgress, ShareBar } from "@/components/public/article-tools";

export const revalidate = 300;

/** No articles are prerendered at build; each is rendered on first request, then cached (ISR). */
export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ lang: string; slug: string }>;

const load = cache(async (lang: string, rawSlug: string) => {
  if (!isLang(lang) || !isConfigured()) return null;
  return getPublishedArticle(lang, decodeURIComponent(rawSlug));
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, slug } = await params;
  const a = await load(lang, slug);
  if (!a) return {};
  const { settings } = await getSiteChrome();
  const og = a.og_image ?? a.featured_image;
  const ogVariant = og?.variants.filter((v) => v.format === "webp").sort((x, y) => y.width - x.width)[0];
  return buildArticleMetadata(
    {
      ...a,
      ogImageUrl: og?.public_url ?? null,
      ogImageWidth: og?.width ?? ogVariant?.width,
      ogImageHeight: og?.height ?? ogVariant?.height,
      authorName: a.author ? localized(a.author, "name", a.language) : null,
      section: a.category ? localized(a.category, "name", a.language) : null,
      tags: a.tags.map((tg) => localized(tg, "name", a.language)),
    },
    siteUrl(),
    siteName(settings, a.language),
  );
}

export default async function ArticlePage({ params }: { params: Params }) {
  const { lang, slug } = await params;
  if (!isLang(lang)) notFound();
  const a = await load(lang, slug);
  if (!a) notFound();

  const [related, { settings }, mostRead] = await Promise.all([listRelated(a), getSiteChrome(), listMostRead(a.language, 3, 6).catch(() => [])]);
  const base = siteUrl();
  const url = `${base}${articlePath(a.language, a.slug)}`;
  const seo = resolveSeo(a, base);
  const translation = a.translations.find((tr) => tr.language !== a.language);
  const authorName = a.author ? localized(a.author, "name", lang) : null;
  const categoryName = a.category ? localized(a.category, "name", lang) : null;
  const heroAlt = a.featured_image_alt || (a.featured_image ? localized(a.featured_image, "alt_text", lang) : "") || a.title;

  const jsonLd = [
    newsArticleJsonLd({
      url,
      headline: a.title,
      description: seo.description,
      language: a.language,
      imageUrls: [a.og_image?.public_url, a.featured_image?.public_url].filter((x): x is string => !!x),
      datePublished: a.first_published_at ?? a.published_at,
      dateModified: a.updated_at,
      authorName,
      authorUrl: a.author ? `${base}/${lang}/author/${a.author.slug}` : null,
      publisherName: siteName(settings, lang),
      section: categoryName,
      keywords: a.tags.map((tg) => localized(tg, "name", lang)),
    }),
    breadcrumbJsonLd([
      { name: t(lang, "home"), url: `${base}/${lang}` },
      ...(a.category ? [{ name: categoryName ?? "", url: `${base}/${lang}/category/${a.category.slug}` }] : []),
      { name: a.title, url },
    ]),
  ];

  const minutes = readMinutes(a.content_text);
  const updated = a.updated_at && new Date(a.updated_at).getTime() - new Date(a.published_at).getTime() > 10 * 60_000;
  const byline = authorName || siteName(settings, lang);
  const sideList = mostRead.filter((m) => m.id !== a.id).slice(0, 4);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <ViewBeacon articleId={a.id} />
      <ReadingProgress />
      <article data-article-id={a.id} lang={a.language} className="flex flex-col gap-10">
        <div className="reveal flex flex-wrap items-center gap-x-4 gap-y-1">
          {a.is_breaking && (
            <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase">
              <span className="live-dot" aria-hidden="true" /> {t(lang, "breaking")}
            </span>
          )}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={`/${lang}`} />}>{t(lang, "home")}</BreadcrumbLink>
              </BreadcrumbItem>
              {a.category && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink render={<Link href={`/${lang}/category/${a.category.slug}`} />}>{categoryName}</BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <header className="reveal flex max-w-[880px] flex-col gap-5" style={{ animationDelay: "60ms" }}>
          {a.tags.some((tg) => tg.slug === "sponsored") && (
            <p className="w-fit rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-amber-200 uppercase">
              {lang === "bn" ? "স্পনসরড কনটেন্ট" : "Sponsored content"}
            </p>
          )}
          <h1 className="font-display text-[clamp(2.3rem,5.2vw,4.2rem)] leading-[1.03] tracking-[-0.01em]">{a.title}</h1>
          {a.subtitle && <p className="text-[clamp(1.1rem,1.8vw,1.35rem)] leading-relaxed text-neutral-600">{a.subtitle}</p>}
          <div className="flex flex-wrap items-center justify-between gap-4 border-y border-white/[0.08] py-4">
            {!a.author && a.source_type === "instagram" ? (
              <a href={a.source_url ?? "https://www.instagram.com/dhakachronicles/"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-surface-3" aria-hidden="true">
                  <InstagramGlyph />
                </span>
                <BylineMeta lang={lang} a={a} minutes={minutes} updated={!!updated} by="@dhakachronicles on Instagram" />
              </a>
            ) : a.author ? (
              <Link href={`/${lang}/author/${a.author.slug}`} className="flex items-center gap-3">
                <Byline name={byline} />
                <BylineMeta lang={lang} a={a} minutes={minutes} updated={!!updated} by={byline} />
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <Byline name={byline} />
                <BylineMeta lang={lang} a={a} minutes={minutes} updated={!!updated} by={byline} />
              </div>
            )}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
              <ShareBar url={url} title={a.title} labels={{ share: t(lang, "share"), copy: t(lang, "copyLink"), copied: t(lang, "copied") }} />
              {translation && (
                <Link href={articlePath(translation.language, translation.slug)} hrefLang={translation.language} lang={translation.language} className="btn h-11">
                  {translation.language === "bn" ? "পড়ুন বাংলায়" : "Read in English"}
                </Link>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-wrap gap-16">
          <div className="min-w-0 flex-[999_1_560px]">
            <div className="mx-auto max-w-[720px]">
              {a.featured_image && (
                <figure className="reveal mb-10" style={{ animationDelay: "120ms" }}>
                  <ResponsiveImage
                    image={a.featured_image}
                    alt={heroAlt}
                    priority
                    sizes="(max-width: 768px) 100vw, 720px"
                    className="mx-auto max-h-[85vh] w-auto rounded-2xl border border-white/[0.06]"
                  />
                  {a.featured_image_alt && <figcaption className="mt-3 text-[13px] text-muted">{a.featured_image_alt}</figcaption>}
                </figure>
              )}

              <div data-article-body className="prose-article">
                <RichText doc={a.content} className="" />
              </div>

              {a.gallery.length > 1 && (
                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                  {a.gallery.slice(1).map((g) => (
                    <figure key={g.media.id}>
                      <ResponsiveImage image={g.media} alt={localized(g.media, "alt_text", lang) || a.title} sizes="(max-width: 640px) 100vw, 360px" className="w-full rounded-2xl" />
                      {(g.caption || g.credit) && (
                        <figcaption className="mt-2 text-[13px] text-muted">
                          {g.caption} {g.credit && <span>· {g.credit}</span>}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              )}

              {a.tags.length > 0 && (
                <ul className="mt-10 flex flex-wrap gap-2 border-t border-white/[0.08] pt-6">
                  {a.tags.map((tg) => (
                    <li key={tg.id}>
                      <Link href={`/${lang}/tag/${tg.slug}`} className="inline-block rounded-full border border-line px-3.5 py-2 text-[13px] text-neutral-700 transition hover:border-white/50 hover:text-white">
                        #{localized(tg, "name", lang)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {a.source_type === "instagram" && a.source_url && (
                <a href={a.source_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-6 inline-block text-sm text-neutral-600 transition hover:text-white">
                  {t(lang, "source")}: Instagram →
                </a>
              )}
            </div>
          </div>

          {sideList.length > 0 && (
            <aside className="flex-[1_1_280px] self-start lg:sticky lg:top-6">
              <h2 className="kicker mb-2">{t(lang, "mostRead")}</h2>
              <div className="flex flex-col gap-5 pt-3">
                {sideList.map((m) => (
                  <ArticleCard key={m.id} a={m} variant="compact" />
                ))}
              </div>
            </aside>
          )}
        </div>
      </article>

      {related.length > 0 && (
        <section className="mt-20">
          <div className="flex items-baseline justify-between border-t border-white pt-4">
            <h2 className="font-display text-[clamp(2rem,3.5vw,2.5rem)] leading-none">
              {categoryName ? `${t(lang, "more")}: ${categoryName}` : t(lang, "related")}
            </h2>
          </div>
          <div className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <ArticleCard key={r.id} a={r} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Byline({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="font-display grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-lg" aria-hidden="true">
      {initials}
    </span>
  );
}

function BylineMeta({ lang, a, minutes, updated, by }: { lang: "bn" | "en"; a: { published_at: string; updated_at: string }; minutes: number; updated: boolean; by: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[15px] font-medium">{by}</span>
      <span className="text-[13px] text-muted">
        <time dateTime={a.published_at}>{formatDate(a.published_at, lang)}</time>
        {updated && (
          <>
            {" · "}
            {t(lang, "updated")} <time dateTime={a.updated_at}>{formatDate(a.updated_at, lang)}</time>
          </>
        )}
        {" · "}
        {localDigits(minutes, lang)} {t(lang, "minRead")}
      </span>
    </span>
  );
}

function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
