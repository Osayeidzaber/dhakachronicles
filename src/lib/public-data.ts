import "server-only";
import { cache } from "react";
import { supabaseConfig } from "@/lib/env";
import { getPublicSettings, listCategories } from "@/lib/articles/queries";
import { log } from "@/lib/logger";
import type { Category } from "@/lib/db/types";

/** Site chrome data (settings + categories), deduplicated per request; tolerant of a missing config. */
export const getSiteChrome = cache(async (): Promise<{ settings: Record<string, unknown>; categories: Category[]; configured: boolean }> => {
  if (!supabaseConfig()) return { settings: {}, categories: [], configured: false };
  try {
    const [settings, categories] = await Promise.all([getPublicSettings(), listCategories()]);
    return { settings, categories, configured: true };
  } catch (err) {
    log.error("public.chrome_failed", { err });
    return { settings: {}, categories: [], configured: false };
  }
});

export function isConfigured(): boolean {
  return supabaseConfig() !== null;
}
