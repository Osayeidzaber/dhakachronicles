import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n";
import { isConfigured } from "@/lib/public-data";
import { listTeamMembers } from "@/lib/articles/queries";
import { ResponsiveImage } from "@/components/public/responsive-image";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: lang === "bn" ? "আমাদের দল" : "Our team", alternates: { canonical: `/${lang}/team`, languages: { en: "/en/team", bn: "/bn/team" } } };
}

/** Public newsroom page. People are edited by hand in Admin → Team page. */
export default async function TeamPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const people = isConfigured() ? await listTeamMembers().catch(() => []) : [];
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
            const name = (bn && p.name_bn) || p.name_en;
            const role = (bn && p.role_bn) || p.role_en;
            const bio = (bn && p.bio_bn) || p.bio_en;
            return (
              <li key={p.id} className="reveal card flex h-full flex-col gap-4" style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}>
                <div className="flex items-center gap-4">
                  {p.photo ? (
                    <ResponsiveImage image={p.photo} alt={name} sizes="72px" className="h-[72px] w-[72px] shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="font-display grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-2xl" aria-hidden="true">
                      {name.slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-display text-2xl leading-tight">{name}</p>
                    {role && <p className="mt-1 text-[13px] text-muted">{role}</p>}
                  </div>
                </div>
                {bio && <p className="text-[15px] leading-relaxed text-neutral-600">{bio}</p>}
                {(p.author || p.instagram) && (
                  <div className="mt-auto flex flex-wrap gap-4 text-[13px]">
                    {p.author && (
                      <Link href={`/${lang}/author/${p.author.slug}`} className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
                        {bn ? "লেখাগুলো পড়ুন" : "Read their stories"}
                      </Link>
                    )}
                    {p.instagram && (
                      <a href={`https://www.instagram.com/${p.instagram}/`} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-white">
                        @{p.instagram}
                      </a>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
