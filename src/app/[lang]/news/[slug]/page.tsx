import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { formatDate, isLang, localized, t } from "@/lib/i18n";
import { siteUrl } from "@/lib/env";
import { getSiteChrome, isConfigured } from "@/lib/public-data";
import { getPublishedArticle, listRelated } from "@/lib/articles/queries";
import { siteName } from "@/lib/settings";
import { buildArticleMetadata } from "@/lib/seo/metadata";
import { articlePath, resolveSeo } from "@/lib/seo/defaults";
import { breadcrumbJsonLd, newsArticleJsonLd, safeJsonLd } from "@/lib/seo/jsonld";
import { RichText } from "@/components/content/rich-text";
import { ResponsiveImage } from "@/components/public/responsive-image";
import { ArticleCard } from "@/components/public/article-card";
import { ViewBeacon } from "@/components/public/view-beacon";

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

  const [related, { settings }] = await Promise.all([listRelated(a), getSiteChrome()]);
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <ViewBeacon articleId={a.id} />
      <article className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted">
          <Link href={`/${lang}`}>{t(lang, "home")}</Link>
          {a.category && (
            <>
              {" / "}
              <Link href={`/${lang}/category/${a.category.slug}`}>{categoryName}</Link>
            </>
          )}
        </nav>
        {a.is_breaking && <p className="mb-2 inline-block rounded bg-accent px-2 py-0.5 text-xs font-bold text-white uppercase">{t(lang, "breaking")}</p>}
        <h1 className="text-3xl leading-tight font-extrabold md:text-4xl">{a.title}</h1>
        {a.subtitle && <p className="mt-3 text-xl text-muted">{a.subtitle}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-border py-3 text-sm text-muted">
          {a.author && (
            <span>
              {t(lang, "by")}{" "}
              <Link href={`/${lang}/author/${a.author.slug}`} className="font-semibold text-foreground underline">
                {authorName}
              </Link>
            </span>
          )}
          <span>
            {t(lang, "published")}: <time dateTime={a.published_at}>{formatDate(a.published_at, lang)}</time>
          </span>
          {a.updated_at && new Date(a.updated_at).getTime() - new Date(a.published_at).getTime() > 10 * 60_000 && (
            <span>
              {t(lang, "updated")}: <time dateTime={a.updated_at}>{formatDate(a.updated_at, lang)}</time>
            </span>
          )}
          {translation && (
            <Link href={articlePath(translation.language, translation.slug)} hrefLang={translation.language} lang={translation.language} className="ml-auto underline">
              {t(lang, "switchLang")}
            </Link>
          )}
        </div>

        {a.featured_image && (
          <figure className="my-6">
            <ResponsiveImage image={a.featured_image} alt={heroAlt} priority className="w-full rounded" />
          </figure>
        )}

        <RichText doc={a.content} />

        {a.gallery.length > 1 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {a.gallery.map((g) => (
              <figure key={g.media.id}>
                <ResponsiveImage image={g.media} alt={localized(g.media, "alt_text", lang) || a.title} sizes="(max-width: 640px) 100vw, 50vw" className="w-full rounded" />
                {(g.caption || g.credit) && (
                  <figcaption className="mt-1 text-sm text-muted">
                    {g.caption} {g.credit && <span>({g.credit})</span>}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}

        {a.source_type === "instagram" && a.source_url && (
          <p className="mt-6 text-sm text-muted">
            {t(lang, "source")}:{" "}
            <a href={a.source_url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
              Instagram
            </a>
          </p>
        )}

        {a.tags.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {a.tags.map((tg) => (
              <li key={tg.id}>
                <Link href={`/${lang}/tag/${tg.slug}`} className="rounded bg-neutral-100 px-2 py-1 text-sm">
                  #{localized(tg, "name", lang)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>

      {related.length > 0 && (
        <section className="mx-auto mt-12 max-w-5xl">
          <h2 className="mb-4 border-b border-border pb-1 text-sm font-bold uppercase">{t(lang, "related")}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <ArticleCard key={r.id} a={r} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
