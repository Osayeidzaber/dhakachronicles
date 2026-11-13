import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLang, t } from "@/lib/i18n";
import { isConfigured } from "@/lib/public-data";
import { searchArticles } from "@/lib/articles/queries";
import { ArticleListPage, pageParam } from "@/components/public/article-list-page";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: t(lang, "search"), robots: { index: false, follow: true } } : {};
}

export default async function SearchPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ q?: string; page?: string }> }) {
  const [{ lang }, sp] = await Promise.all([params, searchParams]);
  if (!isLang(lang)) notFound();
  const q = (sp.q ?? "").slice(0, 100);
  const page = isConfigured() && q.trim()
    ? await searchArticles(lang, q, pageParam(sp.page))
    : { items: [], page: 1, pageSize: 12, total: 0, totalPages: 1 };
  return (
    <ArticleListPage
      lang={lang}
      title={t(lang, "search")}
      intro={
        <form role="search" className="flex max-w-xl gap-2">
          <input name="q" type="search" defaultValue={q} placeholder={t(lang, "searchPlaceholder")} className="flex-1 rounded border border-border px-3 py-2" autoFocus />
          <button className="rounded bg-foreground px-4 py-2 text-background">{t(lang, "search")}</button>
        </form>
      }
      page={page}
      href={(p) => `/${lang}/search?q=${encodeURIComponent(q)}&page=${p}`}
    />
  );
}
