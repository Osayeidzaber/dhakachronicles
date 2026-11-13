import type { Page, ArticleCard as Card } from "@/lib/articles/queries";
import type { Lang } from "@/lib/db/types";
import { t } from "@/lib/i18n";
import { ArticleCard } from "./article-card";
import { Pagination } from "./pagination";

/** Shared listing layout for latest, category, tag, author and search pages. */
export function ArticleListPage({ lang, title, intro, page, href }: { lang: Lang; title: string; intro?: React.ReactNode; page: Page<Card>; href: (p: number) => string }) {
  return (
    <>
      <h1 className="mb-2 text-3xl font-bold">{title}</h1>
      {intro}
      {page.items.length === 0 ? (
        <p className="py-16 text-center text-muted">{t(lang, "noResults")}</p>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>
      )}
      <Pagination lang={lang} page={page.page} totalPages={page.totalPages} href={href} />
    </>
  );
}

export function pageParam(v: string | undefined): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1;
}
