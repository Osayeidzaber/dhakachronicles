import type { Page, ArticleCard as Card } from "@/lib/articles/queries";
import type { Lang } from "@/lib/db/types";
import { t } from "@/lib/i18n";
import { ArticleCard } from "./article-card";
import { Pagination } from "./pagination";

/**
 * Shared listing layout for latest, section, tag, author and search pages
 * (design/claude-design/Latest, Category, Tag, Author). "feature" puts a lead story
 * and two cards above the row list on the first page.
 */
export function ArticleListPage({
  lang,
  title,
  kicker,
  intro,
  page,
  href,
  layout = "rows",
}: {
  lang: Lang;
  title: string;
  kicker?: string;
  intro?: React.ReactNode;
  page: Page<Card>;
  href: (p: number) => string;
  layout?: "rows" | "feature";
}) {
  const feature = layout === "feature" && page.page === 1 && page.items.length >= 3;
  const [lead, ...others] = page.items;
  const side = feature ? others.slice(0, 2) : [];
  const rows = feature ? others.slice(2) : page.items;

  return (
    <div className="flex flex-col gap-12">
      <header className="reveal flex flex-wrap items-end justify-between gap-6 border-b border-white pb-7">
        <div className="flex flex-col gap-3">
          {kicker && <span className="kicker">{kicker}</span>}
          <h1 className="font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">{title}</h1>
        </div>
        {intro && <div className="max-w-md text-base leading-relaxed text-neutral-600">{intro}</div>}
      </header>

      {page.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-8 py-16 text-center">
          <p className="font-display text-3xl">{t(lang, "noResults")}</p>
          <p className="mt-2 text-sm text-muted">{lang === "bn" ? "কম শব্দে আবার চেষ্টা করুন, বা অন্য সংস্করণে খুঁজুন।" : "Try fewer words, or search the other edition."}</p>
        </div>
      ) : (
        <>
          {feature && lead && (
            <section className="grid gap-10 lg:grid-cols-12">
              <div className="reveal lg:col-span-8">
                <ArticleCard a={lead} variant="lead" priority />
              </div>
              <div className="flex flex-col gap-8 lg:col-span-4">
                {side.map((a, i) => (
                  <div key={a.id} className="reveal" style={{ animationDelay: `${(i + 1) * 90}ms` }}>
                    <ArticleCard a={a} variant="compact" />
                  </div>
                ))}
              </div>
            </section>
          )}
          {rows.length > 0 && (
            <div className="border-t border-white/[0.08]">
              {rows.map((a) => (
                <ArticleCard key={a.id} a={a} variant="row" />
              ))}
            </div>
          )}
        </>
      )}
      <Pagination lang={lang} page={page.page} totalPages={page.totalPages} href={href} />
    </div>
  );
}

export function pageParam(v: string | undefined): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1;
}
