import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLang, localized } from "@/lib/i18n";
import { isConfigured } from "@/lib/public-data";
import { getTagBySlug, listLatest } from "@/lib/articles/queries";
import { ArticleListPage, pageParam } from "@/components/public/article-list-page";

type Params = Promise<{ lang: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang) || !isConfigured()) return {};
  const tag = await getTagBySlug(slug);
  return tag ? { title: `#${localized(tag, "name", lang)}`, alternates: { canonical: `/${lang}/tag/${slug}` } } : {};
}

export default async function TagPage({ params, searchParams }: { params: Params; searchParams: Promise<{ page?: string }> }) {
  const [{ lang, slug }, sp] = await Promise.all([params, searchParams]);
  if (!isLang(lang)) notFound();
  if (!isConfigured()) return null;
  const tag = await getTagBySlug(slug);
  if (!tag) notFound();
  const page = await listLatest(lang, { tagId: tag.id, page: pageParam(sp.page) });
  return <ArticleListPage lang={lang} title={`#${localized(tag, "name", lang)}`} page={page} href={(p) => `/${lang}/tag/${slug}?page=${p}`} />;
}
