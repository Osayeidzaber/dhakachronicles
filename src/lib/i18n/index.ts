import type { Lang } from "@/lib/db/types";

export const LOCALES = ["bn", "en"] as const satisfies readonly Lang[];
export const DEFAULT_LOCALE: Lang = "bn";

export function isLang(value: string): value is Lang {
  return (LOCALES as readonly string[]).includes(value);
}

export const otherLang = (lang: Lang): Lang => (lang === "bn" ? "en" : "bn");

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
  },
  en: {
    home: "Home",
    latest: "Latest",
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
