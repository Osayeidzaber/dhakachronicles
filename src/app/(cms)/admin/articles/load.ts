import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Author, Category, Tag } from "@/lib/db/types";

/** Reference data needed by the article editor. */
export async function loadEditorOptions() {
  const supabase = await createClient();
  const [{ data: categories }, { data: authors }, { data: tags }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order").order("name_en"),
    supabase.from("authors").select("*").order("name_en"),
    supabase.from("tags").select("*").order("name_en"),
  ]);
  return {
    categories: (categories ?? []) as Category[],
    authors: (authors ?? []) as Author[],
    tags: (tags ?? []) as Tag[],
  };
}
