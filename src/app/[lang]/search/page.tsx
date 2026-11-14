import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLang, t } from "@/lib/i18n";
import { isConfigured } from "@/lib/public-data";
import { SearchBox } from "@/components/public/search-box";
import { listLatest, searchArticles } from "@/lib/articles/queries";
import { ArticleListPage, pageParam } from "@/components/public/article-list-page";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: t(lang, "search"), robots: { index: false, follow: true } } : {};
}

export default async function SearchPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ q?: string; page?: string }> }) {
  const [{ lang }, sp] = await Promise.all([params, searchParams]);
  if (!isLang(lang)) notFound();
  const q = (sp.q ?? "").slice(0, 100);
  // No query yet: show the latest stories instead of an empty page.
  const page = !isConfigured()
    ? { items: [], page: 1, pageSize: 12, total: 0, totalPages: 1 }
    : q.trim()
      ? await searchArticles(lang, q, pageParam(sp.page))
      : await listLatest(lang, { page: pageParam(sp.page), pageSize: 12 });
  return (
    <ArticleListPage
      lang={lang}
      title={t(lang, "search")}
      intro={
        <div className="flex flex-col gap-3">
          <SearchBox lang={lang} defaultValue={q} />
          {q.trim() && (
            <p className="flex flex-wrap justify-between gap-2 text-sm text-muted">
              <span aria-live="polite">
                {lang === "bn" ? `“${q}” — ${page.total}টি ফল` : `${page.total} ${page.total === 1 ? "result" : "results"} for “${q}”`}
              </span>
              <a href={`/${lang === "bn" ? "en" : "bn"}/search?q=${encodeURIComponent(q)}`} className="text-neutral-700 hover:text-white">
                {lang === "bn" ? "Search in English" : "বাংলায় খুঁজুন"} →
              </a>
            </p>
          )}
        </div>
      }
      page={page}
      href={(p) => (q.trim() ? `/${lang}/search?q=${encodeURIComponent(q)}&page=${p}` : `/${lang}/search?page=${p}`)}
    />
  );
}
