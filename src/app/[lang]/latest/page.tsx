import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLang, t } from "@/lib/i18n";
import { isConfigured } from "@/lib/public-data";
import { listLatest } from "@/lib/articles/queries";
import { ArticleListPage, pageParam } from "@/components/public/article-list-page";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: t(lang, "latest"), alternates: { canonical: `/${lang}/latest` } } : {};
}

export default async function LatestPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ page?: string }> }) {
  const [{ lang }, sp] = await Promise.all([params, searchParams]);
  if (!isLang(lang)) notFound();
  if (!isConfigured()) return null;
  const page = await listLatest(lang, { page: pageParam(sp.page) });
  return <ArticleListPage lang={lang} kicker={t(lang, "liveFeed")} title={t(lang, "latest")} intro={<p>{t(lang, "latestIntro")}</p>} page={page} href={(p) => `/${lang}/latest?page=${p}`} />;
}
