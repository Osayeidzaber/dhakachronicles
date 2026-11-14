import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n";
import { isConfigured } from "@/lib/public-data";
import { listPartners } from "@/lib/articles/queries";
import { PartnerGrid } from "@/components/public/partner-grid";
import { AdEnquiryForm } from "@/components/public/ad-enquiry-form";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    title: lang === "bn" ? "বিজ্ঞাপন ও অংশীদারত্ব" : "Advertise with us",
    description:
      lang === "bn"
        ? "ঢাকা ক্রনিকলসে বিজ্ঞাপন দিন: ওয়েবসাইট ব্যানার, ইনস্টাগ্রাম পোস্ট, রিল ও স্পনসরড প্রতিবেদন।"
        : "Advertise on Dhaka Chronicles: website banners, Instagram posts, reels and sponsored articles.",
    alternates: { canonical: `/${lang}/advertise`, languages: { en: "/en/advertise", bn: "/bn/advertise" } },
  };
}

const T = {
  en: {
    kicker: "Partnerships",
    title: "Advertise with Dhaka Chronicles",
    lede: "Reach more than 78,000 followers on Instagram and readers of dhakachronicles.com, in English and Bangla.",
    cta: "Start a campaign",
    worked: "Brands we've worked with",
    ways: "Ways to advertise",
    sizes: "Website banner sizes",
    sizesNote: "Send any or all three. The site shows the right one for each screen. PNG, JPG or WebP; we optimise them.",
    how: "How it works",
    steps: [
      ["Tell us", "Fill in the form below or message us on Instagram."],
      ["Plan", "We agree the format, dates and price with you."],
      ["Go live", "We publish, clearly labelled as paid content."],
      ["Report", "You get a private link with live views and clicks for your banner."],
    ],
    formTitle: "Send an enquiry",
    formNote: "We reply within two working days.",
    rule: "Our rule",
    ruleBody: "Everything paid for is clearly labelled “Sponsored” or “Advertisement”. Our news coverage is never for sale.",
    dm: "Prefer Instagram?",
    dmBtn: "Message us on Instagram",
  },
  bn: {
    kicker: "অংশীদারত্ব",
    title: "আমাদের সঙ্গে বিজ্ঞাপন দিন",
    lede: "৭৮ হাজারের বেশি ইনস্টাগ্রাম অনুসারী ও ওয়েবসাইটের পাঠকদের কাছে পৌঁছান, বাংলা ও ইংরেজিতে।",
    cta: "ক্যাম্পেইন শুরু করুন",
    worked: "যাঁদের সঙ্গে কাজ করেছি",
    ways: "বিজ্ঞাপনের ধরন",
    sizes: "ওয়েবসাইট ব্যানারের মাপ",
    sizesNote: "একটি বা তিনটিই পাঠাতে পারেন। প্রতিটি স্ক্রিনে সঠিকটি দেখানো হয়। PNG, JPG বা WebP।",
    how: "যেভাবে কাজ করে",
    steps: [
      ["জানান", "নিচের ফর্ম পূরণ করুন বা ইনস্টাগ্রামে মেসেজ দিন।"],
      ["পরিকল্পনা", "ধরন, তারিখ ও মূল্য আমরা একসঙ্গে ঠিক করি।"],
      ["প্রকাশ", "স্পষ্টভাবে পেইড কনটেন্ট হিসেবে চিহ্নিত করে প্রকাশ করি।"],
      ["রিপোর্ট", "আপনার ব্যানারের ভিউ ও ক্লিকের একটি ব্যক্তিগত লিংক পাবেন।"],
    ],
    formTitle: "যোগাযোগ করুন",
    formNote: "দুই কর্মদিবসের মধ্যে উত্তর দিই।",
    rule: "আমাদের নীতি",
    ruleBody: "অর্থের বিনিময়ে প্রকাশিত সব কনটেন্টে স্পষ্টভাবে “স্পনসরড” বা “বিজ্ঞাপন” লেখা থাকে। আমাদের খবর কখনো বিক্রি হয় না।",
    dm: "ইনস্টাগ্রামে কথা বলতে চান?",
    dmBtn: "ইনস্টাগ্রামে মেসেজ",
  },
} as const;

const FORMATS = {
  en: [
    ["Website banner", "Your banner on the homepage or inside articles, with a live report of views and clicks."],
    ["Instagram post", "A single image or carousel on @dhakachronicles, marked as a paid partnership."],
    ["Reel", "Short video for our Instagram audience, produced with you or from your footage."],
    ["Sponsored article", "A story on dhakachronicles.com, labelled “Sponsored” and kept separate from news."],
    ["Event coverage", "Our team covers your launch, festival or event on Instagram and the site."],
  ],
  bn: [
    ["ওয়েবসাইট ব্যানার", "হোমপেজে বা প্রতিবেদনের ভেতরে আপনার ব্যানার, ভিউ ও ক্লিকের লাইভ রিপোর্টসহ।"],
    ["ইনস্টাগ্রাম পোস্ট", "@dhakachronicles-এ ছবি বা ক্যারোসেল, পেইড পার্টনারশিপ হিসেবে চিহ্নিত।"],
    ["রিল", "আমাদের ইনস্টাগ্রাম দর্শকদের জন্য ছোট ভিডিও।"],
    ["স্পনসরড প্রতিবেদন", "ওয়েবসাইটে “স্পনসরড” লেবেলসহ প্রতিবেদন, খবর থেকে আলাদা।"],
    ["ইভেন্ট কভারেজ", "আপনার লঞ্চ, উৎসব বা অনুষ্ঠান ইনস্টাগ্রাম ও ওয়েবসাইটে কভার করা হয়।"],
  ],
} as const;

const SIZES = [
  { name: { en: "Desktop banner", bn: "ডেস্কটপ ব্যানার" }, px: "1200 × 300", ratio: "aspect-[4/1]", where: { en: "Homepage, wide screens", bn: "হোমপেজ, বড় স্ক্রিন" } },
  { name: { en: "Phone banner", bn: "ফোন ব্যানার" }, px: "640 × 320", ratio: "aspect-[2/1]", where: { en: "Homepage on phones", bn: "ফোনে হোমপেজ" } },
  { name: { en: "Square", bn: "বর্গাকার" }, px: "600 × 600", ratio: "aspect-square", where: { en: "Inside articles", bn: "প্রতিবেদনের ভেতরে" } },
] as const;

/** Public partners page: proof of past work, the ways to advertise, real banner specs and an enquiry form. */
export default async function AdvertisePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const c = T[lang];
  const partners = isConfigured() ? await listPartners().catch(() => []) : [];
  return (
    <div className="flex flex-col gap-16">
      <header className="reveal flex flex-col gap-5 border-b border-white pb-9">
        <span className="kicker">{c.kicker}</span>
        <h1 className="font-display max-w-3xl text-[clamp(2.8rem,8vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">{c.title}</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-neutral-600">{c.lede}</p>
        <a href="#enquire" className="btn btn-primary h-12 self-start px-6">
          {c.cta}
        </a>
      </header>

      {partners.length > 0 && (
        <section aria-labelledby="worked-h" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white pb-3">
            <h2 id="worked-h" className="font-display text-[clamp(2rem,4vw,2.75rem)] leading-none">
              {c.worked}
            </h2>
            <span className="text-[13px] text-muted">{lang === "bn" ? `${partners.length}টি ব্র্যান্ড` : `${partners.length} brand${partners.length === 1 ? "" : "s"}`}</span>
          </div>
          <PartnerGrid partners={partners} lang={lang} detailed />
        </section>
      )}

      <section aria-labelledby="ways-h" className="flex flex-col gap-6">
        <h2 id="ways-h" className="font-display border-b border-white pb-3 text-[clamp(2rem,4vw,2.75rem)] leading-none">
          {c.ways}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FORMATS[lang].map(([title, body], i) => (
            <div key={title} className="card reveal flex flex-col gap-2" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="text-xs text-subtle tabular-nums">0{i + 1}</span>
              <h3 className="font-display text-2xl">{title}</h3>
              <p className="text-[15px] leading-relaxed text-neutral-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="sizes-h" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 border-b border-white pb-3">
          <h2 id="sizes-h" className="font-display text-[clamp(2rem,4vw,2.75rem)] leading-none">
            {c.sizes}
          </h2>
          <p className="text-[15px] text-neutral-600">{c.sizesNote}</p>
        </div>
        <div className="grid items-end gap-6 md:grid-cols-[2fr_1fr_1fr]">
          {SIZES.map((s) => (
            <figure key={s.px} className="flex flex-col gap-3">
              <div className={`${s.ratio} grid w-full place-items-center rounded-xl border border-dashed border-white/25 bg-white/[0.03] text-sm text-muted tabular-nums`}>{s.px}</div>
              <figcaption className="text-[13px]">
                <b className="font-medium">{s.name[lang]}</b> <span className="text-muted">· {s.where[lang]}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section aria-labelledby="how-h" className="flex flex-col gap-6">
        <h2 id="how-h" className="font-display border-b border-white pb-3 text-[clamp(2rem,4vw,2.75rem)] leading-none">
          {c.how}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.steps.map(([title, body], i) => (
            <li key={title} className="flex flex-col gap-2 border-t border-white/15 pt-4">
              <span className="font-display text-3xl text-subtle">{i + 1}</span>
              <span className="font-medium">{title}</span>
              <span className="text-[14px] leading-relaxed text-neutral-600">{body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="enquire" aria-labelledby="enq-h" className="grid scroll-mt-24 gap-8 rounded-2xl border border-line p-6 sm:p-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <h2 id="enq-h" className="font-display text-[clamp(2rem,4vw,2.75rem)] leading-none">
            {c.formTitle}
          </h2>
          <p className="text-[15px] text-neutral-600">{c.formNote}</p>
          <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-4">
            <span className="text-[13px] font-medium">{c.rule}</span>
            <p className="text-[14px] leading-relaxed text-neutral-600">{c.ruleBody}</p>
          </div>
          <div className="flex flex-col items-start gap-2 border-t border-white/10 pt-4">
            <span className="text-[13px] text-muted">{c.dm}</span>
            <a href="https://ig.me/m/dhakachronicles" target="_blank" rel="noopener noreferrer" className="btn h-11 px-5">
              {c.dmBtn}
            </a>
          </div>
        </div>
        <AdEnquiryForm lang={lang} />
      </section>
    </div>
  );
}
