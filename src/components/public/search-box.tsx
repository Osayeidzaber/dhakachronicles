"use client";

import { useRouter } from "next/navigation";
import { PlaceholdersAndVanishInput } from "@/components/ui/vendor/aceternity/placeholders-and-vanish-input";
import type { Lang } from "@/lib/db/types";

const EXAMPLES: Record<Lang, string[]> = {
  en: ["Search the news…", "Try “Hasina”", "Try “Dhaka”", "Try “GTA 6”", "Try “election”"],
  bn: ["খবর খুঁজুন…", "লিখুন “ঢাকা”", "লিখুন “নির্বাচন”", "লিখুন “খেলা”"],
};

/** The search page's main field: vanishing input that navigates to ?q=… */
export function SearchBox({ lang, defaultValue }: { lang: Lang; defaultValue: string }) {
  const router = useRouter();
  return (
    <PlaceholdersAndVanishInput
      placeholders={EXAMPLES[lang]}
      defaultValue={defaultValue}
      label={lang === "bn" ? "খুঁজুন" : "Search"}
      className="max-w-none"
      onSubmit={(q) => router.push(q ? `/${lang}/search?q=${encodeURIComponent(q)}` : `/${lang}/search`)}
    />
  );
}
