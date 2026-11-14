import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { altLanguages, isLang } from "@/lib/i18n";
import type { Lang } from "@/lib/db/types";

export const revalidate = 86400;

const UPDATED = "2026-11-13";

const content: Record<Lang, { title: string; updated: string; sections: { h: string; p: string[] }[] }> = {
  en: {
    title: "Privacy Policy",
    updated: "Last updated",
    sections: [
      {
        h: "Who we are",
        p: ["Dhaka Chronicles (dhakachronicles.com) is a news publication. This policy explains what information our website collects and how we use it."],
      },
      {
        h: "Readers",
        p: [
          "You can read the site without an account. We do not run advertising trackers and we do not sell personal information.",
          "We count article views as anonymous daily totals. Your IP address is processed briefly for security (rate limiting) and is not stored with your reading history.",
          "Our hosting and media providers (Vercel and Cloudflare) process standard request data, such as IP address and browser type, to deliver the site securely.",
        ],
      },
      {
        h: "Staff accounts",
        p: [
          "Editorial staff sign in with an email address and password, handled by our authentication provider. A secure, httpOnly cookie keeps them signed in. These accounts are created by our administrators only.",
          "We keep an audit log of editorial actions (for example, publishing an article) to protect the integrity of our journalism.",
        ],
      },
      {
        h: "Instagram integration",
        p: [
          "We use Meta's official Instagram API only to read posts from our own Instagram account, @dhakachronicles. We import those posts' captions, images, timestamps and links into our editorial system as drafts.",
          "We do not access, collect or store data about other Instagram users. The access token for our account is stored encrypted and is used only by our servers.",
        ],
      },
      {
        h: "Data deletion",
        p: [
          "To disconnect our Instagram account, an administrator uses the Disconnect option in our dashboard, which deletes the stored access token. You can also remove the app from Instagram under Settings → Website permissions → Apps and websites.",
          "Staff may ask an administrator to delete their account. Readers may contact us to ask about any data related to them.",
        ],
      },
      {
        h: "Contact",
        p: ["For privacy questions or deletion requests, contact us through our Instagram account @dhakachronicles."],
      },
    ],
  },
  bn: {
    title: "গোপনীয়তা নীতি",
    updated: "সর্বশেষ হালনাগাদ",
    sections: [
      {
        h: "আমরা কারা",
        p: ["ঢাকা ক্রনিকলস (dhakachronicles.com) একটি সংবাদমাধ্যম। আমাদের ওয়েবসাইট কোন তথ্য সংগ্রহ করে এবং কীভাবে তা ব্যবহার করা হয়, এই নীতিতে তা ব্যাখ্যা করা হয়েছে।"],
      },
      {
        h: "পাঠক",
        p: [
          "অ্যাকাউন্ট ছাড়াই আপনি সাইটটি পড়তে পারেন। আমরা কোনো বিজ্ঞাপন ট্র্যাকার ব্যবহার করি না এবং ব্যক্তিগত তথ্য বিক্রি করি না।",
          "আমরা প্রতিবেদনের পাঠসংখ্যা শুধু দৈনিক বেনামি মোট হিসেবে গণনা করি। নিরাপত্তার (রেট লিমিটিং) জন্য আপনার আইপি ঠিকানা স্বল্প সময়ের জন্য প্রক্রিয়া করা হয়, তা আপনার পড়ার ইতিহাসের সঙ্গে সংরক্ষণ করা হয় না।",
          "সাইটটি নিরাপদে পৌঁছে দিতে আমাদের হোস্টিং ও মিডিয়া সেবাদাতারা (Vercel ও Cloudflare) আইপি ঠিকানা ও ব্রাউজারের ধরনের মতো সাধারণ অনুরোধ-তথ্য প্রক্রিয়া করে।",
        ],
      },
      {
        h: "কর্মীদের অ্যাকাউন্ট",
        p: [
          "সম্পাদকীয় কর্মীরা আমাদের অথেনটিকেশন সেবাদাতার মাধ্যমে ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করেন। একটি নিরাপদ httpOnly কুকি তাঁদের লগইন অবস্থায় রাখে। এই অ্যাকাউন্টগুলো শুধু আমাদের প্রশাসকেরা তৈরি করেন।",
          "সাংবাদিকতার সততা রক্ষায় আমরা সম্পাদকীয় কাজের (যেমন প্রতিবেদন প্রকাশ) একটি অডিট লগ রাখি।",
        ],
      },
      {
        h: "ইনস্টাগ্রাম সংযোগ",
        p: [
          "আমরা Meta-র অফিসিয়াল Instagram API শুধু আমাদের নিজস্ব ইনস্টাগ্রাম অ্যাকাউন্ট @dhakachronicles-এর পোস্ট পড়তে ব্যবহার করি। সেই পোস্টের ক্যাপশন, ছবি, সময় ও লিংক আমাদের সম্পাদকীয় ব্যবস্থায় খসড়া হিসেবে আনা হয়।",
          "আমরা অন্য কোনো ইনস্টাগ্রাম ব্যবহারকারীর তথ্য দেখি, সংগ্রহ বা সংরক্ষণ করি না। আমাদের অ্যাকাউন্টের অ্যাক্সেস টোকেন এনক্রিপ্ট করে সংরক্ষিত এবং শুধু আমাদের সার্ভার তা ব্যবহার করে।",
        ],
      },
      {
        h: "তথ্য মুছে ফেলা",
        p: [
          "ইনস্টাগ্রাম সংযোগ বিচ্ছিন্ন করতে প্রশাসক ড্যাশবোর্ডের Disconnect অপশন ব্যবহার করেন, এতে সংরক্ষিত অ্যাক্সেস টোকেন মুছে যায়। ইনস্টাগ্রামের Settings → Website permissions → Apps and websites থেকেও অ্যাপটি সরানো যায়।",
          "কর্মীরা প্রশাসককে তাঁদের অ্যাকাউন্ট মুছে ফেলতে বলতে পারেন। পাঠকেরা তাঁদের সম্পর্কিত যেকোনো তথ্য নিয়ে আমাদের সঙ্গে যোগাযোগ করতে পারেন।",
        ],
      },
      {
        h: "যোগাযোগ",
        p: ["গোপনীয়তা সংক্রান্ত প্রশ্ন বা তথ্য মুছে ফেলার অনুরোধের জন্য আমাদের ইনস্টাগ্রাম অ্যাকাউন্ট @dhakachronicles-এ যোগাযোগ করুন।"],
      },
    ],
  },
};

export function generateStaticParams() {
  return [{ lang: "bn" }, { lang: "en" }];
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    title: content[lang].title,
    alternates: { canonical: `/${lang}/privacy`, languages: altLanguages("/privacy") },
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const c = content[lang];
  const updated = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { dateStyle: "long" }).format(new Date(`${UPDATED}T00:00:00Z`));
  const anchor = (i: number) => `section-${i + 1}`;
  return (
    <div className="flex flex-wrap gap-16">
      <nav aria-label={lang === "bn" ? "এই পাতায়" : "On this page"} className="flex flex-[1_1_220px] flex-col gap-3 self-start text-sm lg:sticky lg:top-8">
        <span className="kicker">{lang === "bn" ? "এই পাতায়" : "On this page"}</span>
        {c.sections.map((s, i) => (
          <a key={s.h} href={`#${anchor(i)}`} className="text-neutral-700 transition hover:text-white">
            {s.h}
          </a>
        ))}
      </nav>
      <article className="flex min-w-0 max-w-[720px] flex-[999_1_560px] flex-col gap-9">
        <header className="reveal flex flex-col gap-2.5 border-b border-white pb-6">
          <h1 className="font-display text-[clamp(2.8rem,6vw,4.5rem)] leading-none">{c.title}</h1>
          <p className="text-sm text-muted">
            {c.updated} <time dateTime={UPDATED}>{updated}</time>
          </p>
        </header>
        {c.sections.map((s, i) => (
          <section key={s.h} id={anchor(i)} className="flex scroll-mt-8 flex-col gap-3.5">
            <h2 className="font-display text-3xl">{s.h}</h2>
            {s.p.map((p) => (
              <p key={p} className="text-[17px] leading-[1.75] text-neutral-800">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
