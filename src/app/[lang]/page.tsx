import Link from "next/link";
import { notFound } from "next/navigation";
import { BANGLA_ENABLED, isLang, localized, otherLang, t } from "@/lib/i18n";
import type { Lang } from "@/lib/db/types";
import { getSiteChrome, isConfigured } from "@/lib/public-data";
import { getCardById, getTagBySlug, listActiveAds, listFeatured, listLatest, listMostRead, listPartners, type ArticleCard as Card } from "@/lib/articles/queries";
import { AdSlot } from "@/components/public/ad-slot";
import { PartnerGrid } from "@/components/public/partner-grid";
import { IntervieweeGrid } from "@/components/public/interviewee-grid";
import { INTERVIEWEES, withPastBrands } from "@/lib/portfolio";
import { highlightedArticleId } from "@/lib/highlight";
import { log } from "@/lib/logger";
import { ArticleCard } from "@/components/public/article-card";
import { Reveal } from "@/components/public/reveal";
import { InstagramStrip } from "@/components/public/instagram-strip";
import { articlePath } from "@/lib/seo/defaults";

export const revalidate = 60;

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    // Database unreachable or not migrated yet: render what we can instead of failing the build.
    log.error("home.load_failed", { err });
    return fallback;
  }
}

const INSTAGRAM_URL = "https://www.instagram.com/dhakachronicles/";
const INSTAGRAM_HIGHLIGHTS = ["Int. Women’s Day", "IndieFest ‘26", "OTB Series"];

/**
 * Front page, laid out as in design/claude-design/Main.dc.html:
 * lead + featured column → latest grid → section rows + most read → Instagram band → more sections → other edition.
 */
export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  if (!isConfigured()) return null;
  const other = otherLang(lang);

  const empty = { items: [] as Card[], page: 1, pageSize: 0, total: 0, totalPages: 1 };
  const [pinnedId, featured, latest, mostRead, otherLatest, { categories }, ads, partners] = await Promise.all([
    safe(highlightedArticleId(lang), null),
    safe(listFeatured(lang, 6), []),
    safe(listLatest(lang, { pageSize: 30 }), empty),
    safe(listMostRead(lang, 3, 5), []),
    safe(listLatest(other, { pageSize: 4 }), empty),
    getSiteChrome(),
    safe(listActiveAds("home"), []),
    safe(listPartners(), []).then(withPastBrands),
  ]);
  // Second wave, all in parallel: the pinned story, Sponsored stories and every section's latest.
  const sponsored = async () => {
    // Ad slot: stories tagged Sponsored (brand deals and detected collaborations), labelled as such.
    const tag = await safe(getTagBySlug("sponsored"), null);
    return tag ? (await safe(listLatest(lang, { tagId: tag.id, pageSize: 3 }), empty)).items : [];
  };
  const [pinned, partner, sectionLists] = await Promise.all([
    pinnedId ? safe(getCardById(pinnedId), null) : Promise.resolve(null),
    sponsored(),
    Promise.all(categories.slice(0, 6).map(async (c) => ({ c, list: (await safe(listLatest(lang, { categoryId: c.id, pageSize: 5 }), empty)).items }))),
  ]);

  const used = new Set<string>();
  const take = (list: Card[], n: number) => {
    const out: Card[] = [];
    for (const a of list) {
      if (out.length >= n) break;
      if (used.has(a.id)) continue;
      used.add(a.id);
      out.push(a);
    }
    return out;
  };

  const lead = pinned ?? featured[0] ?? latest.items[0];
  if (!lead) return <p className="py-24 text-center text-muted">{t(lang, "noResults")}</p>;
  used.add(lead.id);
  const featuredList = take([...featured, ...latest.items], 4);
  const latestGrid = take(latest.items, 8);
  const mostReadList = mostRead.length ? mostRead : latest.items.slice(0, 5);

  // Sections with stories: the first one gets the big "rows + most read" block, the next three a compact column each.
  const withStories = sectionLists.filter((s) => s.list.length);
  const mainSection = withStories[0];
  const moreSections = withStories.slice(1, 4);
  // Until stories have sections, keep the column full with the next recent stories.
  const moreStories = mainSection ? [] : take(latest.items, 4);

  return (
    <div className="flex flex-col gap-16 md:gap-20">
      {/* Lead + Featured */}
      <section className="grid gap-10 lg:grid-cols-12">
        <div className="reveal lg:col-span-8">
          <ArticleCard a={lead} variant="lead" priority />
        </div>
        {featuredList.length > 0 && (
          <div className="reveal flex flex-col gap-5 lg:col-span-4 lg:border-l lg:border-white/[0.08] lg:pl-8" style={{ animationDelay: "120ms" }}>
            <h2 className="kicker">{t(lang, "featured")}</h2>
            {featuredList.map((a) => (
              <ArticleCard key={a.id} a={a} variant="compact" />
            ))}
          </div>
        )}
      </section>

      <AdSlot ad={ads[0]} lang={lang} />

      {/* Latest */}
      {latestGrid.length > 0 && (
        <Reveal>
          <section>
            <SectionTitle title={t(lang, "latest")} href={`/${lang}/latest`} linkLabel={`${t(lang, "allStories")} →`} />
            <div className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {latestGrid.map((a) => (
                <ArticleCard key={a.id} a={a} />
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* Section rows + Most read */}
      <Reveal>
        <section className="grid gap-12 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            {!mainSection && moreStories.length > 0 && (
              <>
                <SectionTitle title={lang === "bn" ? "আরও খবর" : "More stories"} href={`/${lang}/latest`} linkLabel={`${t(lang, "more")} →`} />
                <div>
                  {moreStories.map((a) => (
                    <ArticleCard key={a.id} a={a} variant="row" />
                  ))}
                </div>
              </>
            )}
            {mainSection && (
              <>
                <SectionTitle
                  title={localized(mainSection.c, "name", lang)}
                  href={`/${lang}/category/${mainSection.c.slug}`}
                  linkLabel={`${t(lang, "more")} →`}
                />
                <div>
                  {mainSection.list.slice(0, 4).map((a) => (
                    <ArticleCard key={a.id} a={a} variant="row" />
                  ))}
                </div>
              </>
            )}
          </div>
          <aside className="lg:col-span-4">
            <div className="card sticky top-6 p-7">
              <h2 className="font-display text-3xl leading-none">{t(lang, "mostRead")}</h2>
              <p className="mt-2 text-xs text-muted">{t(lang, "rankedByViews")}</p>
              <ol className="mt-4">
                {mostReadList.map((a, i) => (
                  <li key={a.id} className="grid grid-cols-[36px_1fr] gap-3">
                    <span className="font-display pt-3.5 text-[34px] leading-none text-subtle" aria-hidden="true">
                      {numeral(i + 1, lang)}
                    </span>
                    <ArticleCard a={a} variant="text" />
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </section>
      </Reveal>

      {/* Instagram band */}
      <Reveal>
        <section className="flex flex-col gap-6 rounded-2xl border border-line py-8">
          <InstagramStrip
            label={t(lang, "onInstagram")}
            items={latest.items
              .filter((a) => a.featured_image?.public_url)
              .slice(0, 14)
              .map((a) => ({ href: articlePath(a.language, a.slug), src: posterUrl(a), alt: a.title }))}
          />
          <div className="flex flex-wrap items-center justify-between gap-6 px-8">
          <div className="flex flex-col gap-1.5">
            <span className="kicker">{t(lang, "onInstagram")}</span>
            <span className="font-display text-3xl">@dhakachronicles</span>
          </div>
          <ul className="flex flex-wrap gap-2">
            {INSTAGRAM_HIGHLIGHTS.map((h) => (
              <li key={h} className="rounded-full border border-line px-3.5 py-2 text-[13px] text-neutral-700">
                {h}
              </li>
            ))}
          </ul>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary h-11 px-5">
            {t(lang, "follow")}
          </a>
          </div>
        </section>
      </Reveal>

      {/* Partner content (ad slot) */}
      {partner.length > 0 && (
        <Reveal>
          <section aria-label={lang === "bn" ? "স্পনসরড কনটেন্ট" : "Partner content"} className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.03] p-6 md:p-8">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[11px] font-semibold tracking-[0.14em] text-amber-200 uppercase">{lang === "bn" ? "স্পনসরড কনটেন্ট" : "Partner content · Sponsored"}</h2>
              <Link href={`/${lang}/advertise`} className="text-[13px] text-muted hover:text-white">
                {lang === "bn" ? "বিজ্ঞাপন দিন →" : "Advertise with us →"}
              </Link>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {partner.map((a) => (
                <ArticleCard key={a.id} a={a} />
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* Brands we've worked with */}
      {partners.length > 0 && (
        <Reveal>
          <section aria-labelledby="partners-h" className="flex flex-col gap-5">
            <div className="flex items-baseline justify-between border-b border-white pb-2.5">
              <h2 id="partners-h" className="text-[13px] font-semibold tracking-[0.14em] uppercase">
                {lang === "bn" ? "যাঁদের সঙ্গে কাজ করেছি" : "Brands we've worked with"}
              </h2>
              <Link href={`/${lang}/advertise`} className="text-[13px] text-muted hover:text-white">
                {lang === "bn" ? "বিস্তারিত →" : "See the work →"}
              </Link>
            </div>
            <PartnerGrid partners={partners.slice(0, 12)} lang={lang} />
          </section>
        </Reveal>
      )}

      {/* People we've interviewed: those with photos first, two rows on wide screens */}
      <Reveal>
        <section aria-labelledby="interviewed-h" className="flex flex-col gap-5">
          <div className="flex items-baseline justify-between border-b border-white pb-2.5">
            <h2 id="interviewed-h" className="text-[13px] font-semibold tracking-[0.14em] uppercase">
              {lang === "bn" ? "যাঁদের সাক্ষাৎকার নিয়েছি" : "People we've interviewed"}
            </h2>
            <Link href={`/${lang}/advertise#interviewed-h`} className="text-[13px] text-muted hover:text-white">
              {lang === "bn" ? `সবাই (${INTERVIEWEES.length}) →` : `All ${INTERVIEWEES.length} →`}
            </Link>
          </div>
          <IntervieweeGrid people={[...INTERVIEWEES].sort((a, b) => Number(!!b.photo) - Number(!!a.photo)).slice(0, 10)} lang={lang} />
        </section>
      </Reveal>

      {ads[1] && <AdSlot ad={ads[1]} lang={lang} />}

      {/* More sections */}
      {moreSections.length > 0 && (
        <Reveal>
          <section className="grid gap-10 md:grid-cols-3">
            {moreSections.map(({ c, list }) => (
              <div key={c.id}>
                <div className="flex items-baseline justify-between border-b border-white pb-2.5">
                  <h2 className="text-[13px] font-semibold tracking-[0.14em] uppercase">{localized(c, "name", lang)}</h2>
                  <Link href={`/${lang}/category/${c.slug}`} className="text-[13px] text-muted hover:text-white">
                    {t(lang, "more")} →
                  </Link>
                </div>
                <div className="pt-5">
                  <ArticleCard a={list[0]} />
                </div>
                <div className="mt-4">
                  {list.slice(1, 4).map((a) => (
                    <ArticleCard key={a.id} a={a} variant="text" />
                  ))}
                </div>
              </div>
            ))}
          </section>
        </Reveal>
      )}

      {/* The other edition */}
      {BANGLA_ENABLED && otherLatest.items.length > 0 && (
        <Reveal>
          <section lang={other} className="border-t border-white/[0.08] pt-8">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-3xl">{t(lang, "readOther")}</h2>
              <Link href={`/${other}`} className="text-sm text-muted hover:text-white">
                {t(lang, "otherEdition")} →
              </Link>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {otherLatest.items.map((a) => (
                <ArticleCard key={a.id} a={a} variant="compact" />
              ))}
            </div>
          </section>
        </Reveal>
      )}
    </div>
  );
}

function numeral(n: number, lang: Lang) {
  return lang === "bn" ? String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]) : String(n);
}

function SectionTitle({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-baseline justify-between border-t border-white pt-4">
      <h2 className="font-display text-[clamp(2rem,3.5vw,2.5rem)] leading-none">{title}</h2>
      {href && (
        <Link href={href} className="text-sm text-muted transition hover:text-white">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

/** Smallest WebP variant that is still sharp at 120px wide, else the original. */
function posterUrl(a: Card): string {
  const img = a.featured_image!;
  const v = (img.variants ?? []).filter((x) => x.format === "webp" && x.width >= 240).sort((x, y) => x.width - y.width)[0];
  return v?.url ?? img.public_url;
}
