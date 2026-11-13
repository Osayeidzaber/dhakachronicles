import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang, t } from "@/lib/i18n";
import { isConfigured } from "@/lib/public-data";
import { listBreaking, listFeatured, listLatest, type ArticleCard as Card, type Page } from "@/lib/articles/queries";
import { log } from "@/lib/logger";
import { articlePath } from "@/lib/seo/defaults";
import { ArticleCard } from "@/components/public/article-card";

export const revalidate = 60;

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  if (!isConfigured()) return null;

  let data: [Card[], Card[], Page<Card>];
  try {
    data = await Promise.all([listBreaking(lang), listFeatured(lang, 4), listLatest(lang, { pageSize: 13 })]);
  } catch (err) {
    // Database unreachable or not migrated yet: render empty instead of failing the build.
    log.error("home.load_failed", { err });
    data = [[], [], { items: [], page: 1, pageSize: 13, total: 0, totalPages: 1 }];
  }
  const [breaking, featured, latest] = data;
  const featuredIds = new Set(featured.map((f) => f.id));
  const lead = featured[0] ?? latest.items[0];
  const rest = latest.items.filter((a) => a.id !== lead?.id && !featuredIds.has(a.id));

  if (!lead) return <p className="py-16 text-center text-muted">{t(lang, "noResults")}</p>;

  return (
    <>
      {breaking.length > 0 && (
        <section aria-label={t(lang, "breaking")} className="mb-6 flex flex-wrap items-center gap-2 rounded bg-accent px-3 py-2 text-white">
          <strong className="uppercase">{t(lang, "breaking")}</strong>
          <ul className="flex flex-wrap gap-x-4">
            {breaking.map((b) => (
              <li key={b.id}>
                <Link href={articlePath(b.language, b.slug)} className="underline">
                  {b.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <ArticleCard a={lead} size="lg" />
        </div>
        <div className="space-y-4">
          <h2 className="border-b border-border pb-1 text-sm font-bold uppercase">{t(lang, "featured")}</h2>
          {featured
            .filter((f) => f.id !== lead.id)
            .map((f) => (
              <ArticleCard key={f.id} a={f} size="sm" />
            ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 border-b border-border pb-1 text-sm font-bold uppercase">{t(lang, "latest")}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>
        {latest.totalPages > 1 && (
          <p className="mt-6 text-center">
            <Link href={`/${lang}/latest?page=2`} className="underline">
              {t(lang, "next")} →
            </Link>
          </p>
        )}
      </section>
    </>
  );
}
