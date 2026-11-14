import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang, localized } from "@/lib/i18n";
import { isConfigured } from "@/lib/public-data";
import { listAuthors } from "@/lib/articles/queries";
import { ResponsiveImage } from "@/components/public/responsive-image";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: lang === "bn" ? "আমাদের দল" : "Our team", alternates: { canonical: `/${lang}/team`, languages: { en: "/en/team", bn: "/bn/team" } } };
}

/** Public newsroom page. People and bios are edited in Admin → Authors. */
export default async function TeamPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const people = isConfigured() ? await listAuthors().catch(() => []) : [];
  const bn = lang === "bn";
  return (
    <div className="flex flex-col gap-12">
      <header className="reveal flex flex-wrap items-end justify-between gap-6 border-b border-white pb-7">
        <div className="flex flex-col gap-3">
          <span className="kicker">{bn ? "নিউজরুম" : "Newsroom"}</span>
          <h1 className="font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">{bn ? "আমাদের দল" : "Our team"}</h1>
        </div>
        <p className="max-w-md text-base leading-relaxed text-neutral-600">
          {bn ? "যাঁরা ঢাকা ক্রনিকলসের প্রতিটি খবর লেখেন, যাচাই করেন ও প্রকাশ করেন।" : "The people who report, check and publish every Dhaka Chronicles story."}
        </p>
      </header>
      {people.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-8 py-16 text-center text-muted">{bn ? "শিগগিরই আসছে।" : "Coming soon."}</p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p, i) => {
            const name = localized(p, "name", lang);
            const bio = localized(p, "bio", lang);
            return (
              <li key={p.id} className="reveal" style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}>
                <Link href={`/${lang}/author/${p.slug}`} className="card group flex h-full flex-col gap-4 transition hover:border-white/25">
                  <div className="flex items-center gap-4">
                    {p.avatar ? (
                      <ResponsiveImage image={p.avatar} alt={name} sizes="64px" className="h-16 w-16 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="font-display grid h-16 w-16 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-2xl" aria-hidden="true">
                        {name.slice(0, 1)}
                      </span>
                    )}
                    <span className="font-display text-2xl leading-tight transition group-hover:text-neutral-700">{name}</span>
                  </div>
                  {bio && <p className="line-clamp-4 text-[15px] leading-relaxed text-neutral-600">{bio}</p>}
                  <span className="mt-auto text-[13px] text-muted">{bn ? "লেখাগুলো পড়ুন →" : "Read their stories →"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
