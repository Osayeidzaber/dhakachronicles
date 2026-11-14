import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { altLanguages, isLang } from "@/lib/i18n";
import { isConfigured } from "@/lib/public-data";
import { createPublicClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
import { safeJsonLd } from "@/lib/seo/jsonld";
import { OZ, ozOrganizationJsonLd } from "@/lib/oz";
import ozMark from "../../../../public/brand/oz/oz-studio-white.png";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    title: "Credits: designed and built by OZ Studios",
    description: "The Dhaka Chronicles website and newsroom were designed and built by OZ Studios, a web design and development studio in Dhaka.",
    alternates: { canonical: `/${lang}/oz`, languages: altLanguages("/oz") },
  };
}

async function siteNumbers() {
  if (!isConfigured()) return null;
  try {
    const sb = createPublicClient();
    const [stories, sections] = await Promise.all([
      sb.from("articles").select("id", { count: "exact", head: true }).eq("status", "published").lte("published_at", new Date().toISOString()),
      sb.from("categories").select("id", { count: "exact", head: true }),
    ]);
    return { stories: stories.count ?? 0, sections: sections.count ?? 0 };
  } catch {
    return null;
  }
}

const SERVICES = ["News websites", "Newsrooms & CMS", "Shopify themes", "Admin portals", "Delivery platforms", "Event websites"];

const CREDITS: [string, string, string][] = [
  ["I.", "Design & art direction", OZ.name],
  ["II.", "Website development (Next.js, TypeScript)", OZ.name],
  ["III.", "Newsroom, CMS & publishing workflow", OZ.name],
  ["IV.", "Instagram import, alerts & analytics", OZ.name],
  ["V.", "SEO, performance & accessibility", OZ.name],
  ["VI.", "Journalism & photography", "Dhaka Chronicles"],
];

const mono = "font-mono text-[11px] tracking-[0.22em] uppercase";

/** Credits page: who designed and built this site. Linked only from the 404 page and the browser console. */
export default async function OzCreditsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const n = await siteNumbers();
  const base = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${base}/${lang}/oz`,
    url: `${base}/${lang}/oz`,
    name: "Credits: Dhaka Chronicles was designed and built by OZ Studios",
    about: { "@id": `${base}/#website` },
    mainEntity: ozOrganizationJsonLd(),
  };

  return (
    <div className="flex flex-col gap-20 md:gap-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <header className="reveal flex flex-col gap-10">
        <div className={`flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5 text-neutral-600 ${mono}`}>
          <span>00 — Credits / Dhaka Chronicles / Dhaka</span>
          <span>OZ — Vol. 26</span>
        </div>
        <div className="grid items-end gap-10 md:grid-cols-[1.4fr_1fr]">
          <h1 className="text-[clamp(3.5rem,11vw,9rem)] leading-[0.88] font-semibold tracking-[-0.05em]">
            <span className="block font-light">OZ Studios</span>
            <span className="block">made this.</span>
          </h1>
          <Image src={ozMark} alt="OZ Studio" className="h-auto w-40 justify-self-start md:w-56 md:justify-self-end" priority />
        </div>
        <p className="text-center text-neutral-600" aria-hidden="true">
          * * *
        </p>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <p className="max-w-xl text-xl leading-relaxed text-neutral-700">
            The Dhaka Chronicles website and newsroom, designed and built by <b className="font-medium text-white">OZ Studios</b>.
          </p>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <span className={`flex items-center gap-2 text-neutral-600 ${mono}`}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" /> Taking on a few projects for &apos;26
            </span>
            <div className="flex gap-2">
              <a href={OZ.instagram} target="_blank" rel="noopener" className="btn h-11 px-5">
                Instagram ↗
              </a>
              <a href={OZ.url} target="_blank" rel="noopener" className="btn btn-primary h-11 px-5">
                Studio ↗
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="relative -mx-4 overflow-hidden border-y border-white/10 py-5 md:-mx-8" aria-label="What OZ Studios builds">
        <div className="oz-marquee flex w-max gap-10 whitespace-nowrap">
          {[0, 1].map((k) => (
            <div key={k} className="flex gap-10" aria-hidden={k === 1}>
              {[...SERVICES, ...SERVICES].map((s, i) => (
                <span key={`${k}-${i}`} className="flex items-center gap-10 text-[clamp(1.4rem,3vw,2.2rem)] font-light tracking-tight text-neutral-700">
                  {s} <span className="text-neutral-500">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="grid gap-8 md:grid-cols-[220px_1fr]">
        <span className={`text-neutral-600 ${mono}`}>01 — The build</span>
        <div className="flex max-w-3xl flex-col gap-6">
          <h2 className="text-[clamp(2.2rem,5vw,3.75rem)] leading-[1] font-semibold tracking-[-0.03em]">Code and pixels, by hand.</h2>
          <p className="text-lg leading-relaxed text-neutral-600">
            A bilingual news site written from scratch in Next.js and TypeScript, in English and Bangla, with every page designed for phones first. Stories
            arrive from Instagram in a click, are filed into sections and tagged automatically, and are published with full search engine and social
            sharing markup.
          </p>
          <p className="text-lg leading-relaxed text-neutral-600">
            Behind it sits a complete newsroom: writing and review, scheduling, a media library, translation, live readership numbers, brand deals and
            website ads with reports for advertisers. Everything the team touches day to day can be edited without a developer.
          </p>
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-[220px_1fr]">
        <span className={`text-neutral-600 ${mono}`}>02 — Credits</span>
        <ol className="max-w-3xl">
          {CREDITS.map(([num, role, who]) => (
            <li key={role} className="grid grid-cols-[48px_1fr] gap-4 border-t border-white/10 py-5 sm:grid-cols-[48px_1fr_auto]">
              <span className="font-mono text-sm text-neutral-500">{num}</span>
              <span className="text-[17px]">{role}</span>
              <span className="col-start-2 text-[15px] text-neutral-600 sm:col-start-auto">{who}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-8 md:grid-cols-[220px_1fr]">
        <span className={`text-neutral-600 ${mono}`}>03 — In numbers</span>
        <dl className="grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
          {[
            ["Stories", n ? n.stories.toLocaleString("en-IN") : "—"],
            ["Sections", n ? String(n.sections) : "—"],
            ["Languages", "2"],
            ["Season", "’26"],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-2 bg-black p-6">
              <dt className={`text-neutral-600 ${mono}`}>{k}</dt>
              <dd className="text-[clamp(2.2rem,5vw,3.5rem)] leading-none font-semibold tracking-tight">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-8 border-t border-white/10 pt-12 md:grid-cols-[220px_1fr]">
        <span className={`text-neutral-600 ${mono}`}>04 — Next</span>
        <div className="flex flex-col gap-6">
          <h2 className="text-[clamp(2.8rem,8vw,6.5rem)] leading-[0.92] font-semibold tracking-[-0.04em]">Like how this feels?</h2>
          <p className="text-xl text-neutral-600">OZ Studios builds for the web. Design + development, all in one place.</p>
          <div className="flex flex-wrap gap-2">
            <a href={OZ.url} target="_blank" rel="noopener" className="btn btn-primary h-12 px-6">
              See more work ↗
            </a>
            <a href={OZ.instagram} target="_blank" rel="noopener" className="btn h-12 px-6">
              Instagram ↗
            </a>
            <Link href={`/${lang}`} className="btn h-12 px-6">
              Back to the news
            </Link>
          </div>
        </div>
      </section>

      <div className={`flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5 text-neutral-600 ${mono}`}>
        <span>© {OZ.year} OZ Studios</span>
        <span>The internet, with intention.</span>
      </div>
    </div>
  );
}
