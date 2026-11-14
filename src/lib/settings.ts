import type { Lang } from "@/lib/db/types";

/** Typed accessors for site_settings values (pure; safe to use anywhere). */
export function siteName(settings: Record<string, unknown>, lang: Lang): string {
  const v = settings.site_name as { en?: string; bn?: string } | undefined;
  return v?.[lang] || v?.en || "Dhaka Chronicles";
}

/** The newsroom's official accounts and email. Settings can override or add to the links. */
export const OFFICIAL_SOCIAL: Record<string, string> = {
  instagram: "https://www.instagram.com/dhakachronicles/",
  facebook: "https://www.facebook.com/profile.php?id=61563127311472",
};
export const CONTACT_EMAIL = "dhakachronicles@gmail.com";

export function socialLinks(settings: Record<string, unknown>): Record<string, string> {
  const v = settings.social_links;
  const stored = v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === "string" && /^https:\/\//.test(e[1]))) : {};
  return { ...OFFICIAL_SOCIAL, ...stored };
}

export function seoDefaults(settings: Record<string, unknown>): { title_suffix: string; description_en: string; description_bn: string } {
  const v = (settings.seo_defaults ?? {}) as Partial<{ title_suffix: string; description_en: string; description_bn: string }>;
  return { title_suffix: v.title_suffix ?? "", description_en: v.description_en ?? "", description_bn: v.description_bn ?? "" };
}

export function logoMediaId(settings: Record<string, unknown>): string | null {
  return typeof settings.logo_media_id === "string" ? settings.logo_media_id : null;
}
