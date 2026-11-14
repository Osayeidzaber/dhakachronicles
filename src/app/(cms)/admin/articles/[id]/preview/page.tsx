import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RichText } from "@/components/content/rich-text";
import { formatDate } from "@/lib/i18n";
import type { Article } from "@/lib/db/types";

export const metadata = { title: "Preview", robots: { index: false } };

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "In review",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

/**
 * Staff-only preview of any status (RLS decides what the user may read), styled like the
 * public article page with the design's white "Preview" bar on top.
 */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select("*, featured:media!articles_featured_image_id_fkey(public_url), category:categories(name_en, name_bn)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const a = data as Article & { featured: { public_url: string } | null; category: { name_en: string; name_bn: string } | null };
  const live = a.status === "published";
  const section = a.category ? (a.language === "bn" ? a.category.name_bn : a.category.name_en) : null;

  return (
    <div className="-mx-4 -my-6 md:-mx-9 md:-my-8">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-3 text-sm text-black md:px-8">
        <span>
          <strong className="font-semibold">Preview</strong> · {STATUS_LABEL[a.status] ?? a.status}
          {live ? ", visible to readers." : ", not public. Readers can’t see this page yet."}
        </span>
        <span className="flex gap-2">
          {live && (
            <Link href={`/${a.language}/news/${a.slug}`} target="_blank" className="inline-flex h-9 items-center rounded-full border border-black/20 px-4 text-[13px]">
              Open live page ↗
            </Link>
          )}
          <Link href={`/admin/articles/${a.id}`} className="inline-flex h-9 items-center rounded-full bg-black px-4 text-[13px] text-white">
            Back to editor
          </Link>
        </span>
      </div>

      <article className="mx-auto flex max-w-[880px] flex-col gap-6 px-5 py-12 md:px-8" lang={a.language}>
        {section && <p className="text-[13px] text-neutral-700">{section}</p>}
        <h1 className="font-display text-[clamp(2.3rem,5vw,4rem)] leading-[1.04]">{a.title}</h1>
        {a.subtitle && <p className="text-xl leading-relaxed text-neutral-600">{a.subtitle}</p>}
        <p className="border-y border-white/[0.08] py-4 text-[13px] text-muted">{formatDate(a.published_at ?? a.updated_at, a.language)}</p>
        {a.featured && (
          // eslint-disable-next-line @next/next/no-img-element -- preview of an R2 image
          <img src={a.featured.public_url} alt={a.featured_image_alt ?? ""} className="mx-auto max-h-[80vh] w-auto rounded-2xl border border-white/[0.06]" />
        )}
        <div className="prose-article mx-auto w-full max-w-[720px]">
          <RichText doc={a.content} />
        </div>
      </article>
    </div>
  );
}
