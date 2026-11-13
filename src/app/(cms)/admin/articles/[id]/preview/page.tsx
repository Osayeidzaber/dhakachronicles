import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RichText } from "@/components/content/rich-text";
import { formatDate } from "@/lib/i18n";
import type { Article } from "@/lib/db/types";

export const metadata = { title: "Preview", robots: { index: false } };

/** Staff-only preview of any status (RLS decides what the user may read). */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageSession();
  const supabase = await createClient();
  const { data } = await supabase.from("articles").select("*, featured:media!articles_featured_image_id_fkey(public_url)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as Article & { featured: { public_url: string } | null };
  return (
    <article className="mx-auto max-w-3xl bg-white p-6" lang={a.language}>
      <p className="mb-4 rounded bg-amber-50 p-2 text-sm text-amber-800">Preview · status: {a.status}</p>
      <h1 className="text-3xl font-bold">{a.title}</h1>
      {a.subtitle && <p className="mt-2 text-lg text-neutral-600">{a.subtitle}</p>}
      <p className="mt-2 text-sm text-neutral-500">{formatDate(a.published_at ?? a.updated_at, a.language)}</p>
      {a.featured && (
        // eslint-disable-next-line @next/next/no-img-element -- preview
        <img src={a.featured.public_url} alt={a.featured_image_alt ?? ""} className="my-6 w-full rounded" />
      )}
      <RichText doc={a.content} />
    </article>
  );
}
