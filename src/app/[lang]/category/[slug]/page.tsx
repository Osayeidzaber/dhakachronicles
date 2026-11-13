import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLang, localized, t } from "@/lib/i18n";
import { siteUrl } from "@/lib/env";
import { isConfigured } from "@/lib/public-data";
import { getCategoryBySlug, listLatest } from "@/lib/articles/queries";
import { breadcrumbJsonLd, safeJsonLd } from "@/lib/seo/jsonld";
import { ArticleListPage, pageParam } from "@/components/public/article-list-page";

type Params = Promise<{ lang: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang) || !isConfigured()) return {};
  const c = await getCategoryBySlug(slug);
  if (!c) return {};
  return {
    title: localized(c, "name", lang),
    description: localized(c, "description", lang) || undefined,
    alternates: { canonical: `/${lang}/category/${slug}`, languages: { bn: `/bn/category/${slug}`, en: `/en/category/${slug}` } },
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: Promise<{ page?: string }> }) {
  const [{ lang, slug }, sp] = await Promise.all([params, searchParams]);
  if (!isLang(lang)) notFound();
  if (!isConfigured()) return null;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  const page = await listLatest(lang, { categoryId: category.id, page: pageParam(sp.page) });
  const name = localized(category, "name", lang);
  const base = siteUrl();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(breadcrumbJsonLd([{ name: t(lang, "home"), url: `${base}/${lang}` }, { name, url: `${base}/${lang}/category/${slug}` }])),
        }}
      />
      <ArticleListPage
        lang={lang}
        title={name}
        intro={localized(category, "description", lang) ? <p className="text-muted">{localized(category, "description", lang)}</p> : null}
        page={page}
        href={(p) => `/${lang}/category/${slug}?page=${p}`}
      />
    </>
  );
}
