import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    title: lang === "bn" ? "বিজ্ঞাপন ও অংশীদারত্ব" : "Advertise with us",
    alternates: { canonical: `/${lang}/advertise`, languages: { en: "/en/advertise", bn: "/bn/advertise" } },
  };
}

const FORMATS = {
  en: [
    ["Instagram post", "A single image or carousel on @dhakachronicles, marked as a paid partnership."],
    ["Reel", "Short video for our Instagram audience, produced with you or from your footage."],
    ["Sponsored article", "A story on dhakachronicles.com, clearly labelled “Sponsored” and kept separate from news."],
    ["Event coverage", "Our team covers your launch, festival or event on Instagram and the site."],
  ],
  bn: [
    ["ইনস্টাগ্রাম পোস্ট", "@dhakachronicles-এ ছবি বা ক্যারোসেল, পেইড পার্টনারশিপ হিসেবে চিহ্নিত।"],
    ["রিল", "আমাদের ইনস্টাগ্রাম দর্শকদের জন্য ছোট ভিডিও।"],
    ["স্পনসরড প্রতিবেদন", "ওয়েবসাইটে “স্পনসরড” লেবেলসহ প্রতিবেদন, খবর থেকে আলাদা।"],
    ["ইভেন্ট কভারেজ", "আপনার লঞ্চ, উৎসব বা অনুষ্ঠান ইনস্টাগ্রাম ও ওয়েবসাইটে কভার করা হয়।"],
  ],
} as const;

/** Public partners page; the deals themselves are tracked in Admin → Brand deals. */
export default async function AdvertisePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const bn = lang === "bn";
  return (
    <div className="flex flex-col gap-14">
      <header className="reveal flex flex-col gap-4 border-b border-white pb-8">
        <span className="kicker">{bn ? "অংশীদারত্ব" : "Partnerships"}</span>
        <h1 className="font-display max-w-3xl text-[clamp(3rem,8vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">{bn ? "আমাদের সঙ্গে বিজ্ঞাপন দিন" : "Advertise with Dhaka Chronicles"}</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-neutral-600">
          {bn ? "৭৮ হাজারের বেশি ইনস্টাগ্রাম অনুসারী ও ওয়েবসাইটের পাঠকদের কাছে পৌঁছান।" : "Reach more than 78,000 followers on Instagram and readers of dhakachronicles.com."}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {FORMATS[lang].map(([title, body], i) => (
          <div key={title} className="card reveal flex flex-col gap-2" style={{ animationDelay: `${i * 60}ms` }}>
            <h2 className="font-display text-2xl">{title}</h2>
            <p className="text-[15px] leading-relaxed text-neutral-600">{body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-8 rounded-2xl border border-line p-8 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-3xl">{bn ? "আমাদের নীতি" : "Our rule"}</h2>
          <p className="text-[15px] leading-relaxed text-neutral-600">
            {bn ? "অর্থের বিনিময়ে প্রকাশিত সব কনটেন্টে স্পষ্টভাবে “স্পনসরড” লেখা থাকে। আমাদের খবর কখনো বিক্রি হয় না।" : "Everything paid for is clearly labelled “Sponsored”. Our news coverage is never for sale."}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3">
          <h2 className="font-display text-3xl">{bn ? "যোগাযোগ" : "Get in touch"}</h2>
          <p className="text-[15px] leading-relaxed text-neutral-600">{bn ? "ইনস্টাগ্রামে মেসেজ দিন, আমরা দ্রুত উত্তর দেব।" : "Send us a message on Instagram and we will get back to you."}</p>
          <a href="https://ig.me/m/dhakachronicles" target="_blank" rel="noopener noreferrer" className="btn btn-primary h-11 px-5">
            {bn ? "ইনস্টাগ্রামে মেসেজ" : "Message us on Instagram"}
          </a>
        </div>
      </section>
    </div>
  );
}
