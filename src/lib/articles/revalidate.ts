import "server-only";
import { revalidatePath } from "next/cache";
import type { Lang } from "@/lib/db/types";

/** Invalidate every public page that can show this article. */
export function revalidateArticle(a: { language: Lang; slug: string }) {
  revalidatePath(`/${a.language}`, "layout");
  revalidatePath(`/${a.language}/news/${a.slug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/news-sitemap.xml");
  revalidatePath(`/${a.language}/rss.xml`);
}

export function revalidatePublic() {
  revalidatePath("/", "layout");
}
