import type { Lang } from "@/lib/db/types";

export const LOCALES = ["en", "bn"] as const satisfies readonly Lang[];
export const DEFAULT_LOCALE: Lang = "en";

export function isLang(value: string): value is Lang {
  return (LOCALES as readonly string[]).includes(value);
}

export const otherLang = (lang: Lang): Lang => (lang === "bn" ? "en" : "bn");

/**
 * The Bangla edition is switched off for now: /bn addresses redirect to English (src/proxy.ts),
 * links to it are hidden, and it is left out of hreflang tags and sitemaps. Set to true to bring it back.
 * The newsroom can still write and store Bangla stories.
 */
export const BANGLA_ENABLED = false;

/** Languages readers can visit. */
export const PUBLIC_LOCALES: readonly Lang[] = BANGLA_ENABLED ? LOCALES : ["en"];

/** hreflang map for a public path that exists in every language, e.g. altLanguages("/team"). */
export function altLanguages(path = ""): Record<string, string> {
  return Object.fromEntries([...PUBLIC_LOCALES.map((l) => [l, `/${l}${path}`]), ["x-default", `/en${path}`]]);
}

/** Pick a language-specific column: localized(cat, "name", "bn") -> cat.name_bn (falls back to the other language). */
export function localized(row: object, field: string, lang: Lang): string {
  const rec = row as Record<string, unknown>;
  const v = rec[`${field}_${lang}`] || rec[`${field}_${otherLang(lang)}`];
  return typeof v === "string" ? v : "";
}

const dict = {
  bn: {
    home: "প্রচ্ছদ",
    latest: "সর্বশেষ",
    liveFeed: "সরাসরি",
    section: "বিভাগ",
    topic: "বিষয়",
    latestIntro: "প্রকাশের সঙ্গে সঙ্গে সব খবর, সবচেয়ে নতুনটি আগে।",
    featured: "নির্বাচিত",
    breaking: "ব্রেকিং",
    search: "অনুসন্ধান",
    searchPlaceholder: "খবর খুঁজুন…",
    noResults: "কোনো খবর পাওয়া যায়নি।",
    related: "সম্পর্কিত খবর",
    by: "লিখেছেন",
    published: "প্রকাশিত",
    updated: "হালনাগাদ",
    next: "পরবর্তী",
    previous: "পূর্ববর্তী",
    categories: "বিভাগ",
    allRights: "সর্বস্বত্ব সংরক্ষিত",
    notFound: "পাতাটি পাওয়া যায়নি",
    error: "কিছু একটা সমস্যা হয়েছে",
    tryAgain: "আবার চেষ্টা করুন",
    loading: "লোড হচ্ছে…",
    source: "মূল সূত্র",
    articlesBy: "লেখকের সব খবর",
    switchLang: "English",
    notConfigured: "সাইটটি এখনো কনফিগার করা হয়নি।",
    mostRead: "সর্বাধিক পঠিত",
    topNews: "শীর্ষ খবর",
    stream: "এইমাত্র",
    spotlight: "বিশেষ প্রতিবেদন",
    more: "আরও",
    onInstagram: "ইনস্টাগ্রামে",
    follow: "ফলো করুন",
    rankedByViews: "গত ৩ দিনে সবচেয়ে বেশি পঠিত",
    allStories: "সব খবর",
    live: "লাইভ",
    staff: "স্টাফ লগইন",
    menu: "মেনু",
    close: "বন্ধ",
    minRead: "মিনিটে পড়ুন",
    share: "শেয়ার",
    copyLink: "লিংক কপি",
    copied: "কপি হয়েছে",
    readOther: "Read in English",
    otherEdition: "English edition",
    tagline: "ঢাকা থেকে সাংবাদিকতা, বাংলা ও ইংরেজিতে",
    photo: "ছবি",
    justNow: "এইমাত্র",
    minAgo: "মিনিট আগে",
    hAgo: "ঘণ্টা আগে",
    privacy: "গোপনীয়তা নীতি",
    sectionsLabel: "বিভাগসমূহ",
  },
  en: {
    home: "Home",
    latest: "Latest",
    liveFeed: "Live feed",
    section: "Section",
    topic: "Topic",
    latestIntro: "Every story as it is published, newest first.",
    featured: "Featured",
    breaking: "Breaking",
    search: "Search",
    searchPlaceholder: "Search news…",
    noResults: "No articles found.",
    related: "Related articles",
    by: "By",
    published: "Published",
    updated: "Updated",
    next: "Next",
    previous: "Previous",
    categories: "Categories",
    allRights: "All rights reserved",
    notFound: "Page not found",
    error: "Something went wrong",
    tryAgain: "Try again",
    loading: "Loading…",
    source: "Original source",
    articlesBy: "Articles by",
    switchLang: "বাংলা",
    notConfigured: "The site is not configured yet.",
    mostRead: "Most read",
    topNews: "Top news",
    stream: "The stream",
    spotlight: "Spotlight",
    more: "More",
    onInstagram: "On Instagram",
    follow: "Follow",
    rankedByViews: "Most viewed in the last 3 days",
    allStories: "All stories",
    live: "Live",
    staff: "Staff sign in",
    menu: "Menu",
    close: "Close",
    minRead: "min read",
    share: "Share",
    copyLink: "Copy link",
    copied: "Copied",
    readOther: "বাংলায় পড়ুন",
    otherEdition: "বাংলা সংস্করণ",
    tagline: "Journalism from Dhaka",
    photo: "Photo",
    justNow: "just now",
    minAgo: "min ago",
    hAgo: "h ago",
    privacy: "Privacy",
    sectionsLabel: "Sections",
  },
} as const;

export type DictKey = keyof (typeof dict)["en"];
export const t = (lang: Lang, key: DictKey): string => dict[lang][key];

export function formatDate(iso: string | null, lang: Lang): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(new Date(iso));
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export function localDigits(n: number | string, lang: Lang): string {
  const s = String(n);
  return lang === "bn" ? s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : s;
}

/** "12 min ago" for the last day, then a short date. */
export function relativeTime(iso: string | null, lang: Lang, now = Date.now()): string {
  if (!iso) return "";
  const m = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (m < 1) return t(lang, "justNow");
  if (m < 60) return `${localDigits(m, lang)} ${t(lang, "minAgo")}`;
  if (m < 24 * 60) return `${localDigits(Math.round(m / 60), lang)} ${t(lang, "hAgo")}`;
  return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

/** Reading time from plain text (about 200 words a minute). */
export function readMinutes(text: string | null | undefined): number {
  const words = (text ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
