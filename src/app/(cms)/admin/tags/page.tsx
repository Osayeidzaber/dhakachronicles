import { requirePageSession } from "@/lib/auth/session";
import { HoldSubmit } from "@/components/admin/form-controls";
import { SubmitButton } from "@/components/admin/submit-button";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";
import { deleteTagAction, saveTagAction } from "../actions";
import type { Tag } from "@/lib/db/types";

export const metadata = { title: "Tags" };

function Fields({ t }: { t?: Tag }) {
  return (
    <>
      <input name="name_en" defaultValue={t?.name_en} placeholder="Name (English)" aria-label="Name (English)" required className="input" />
      <input name="name_bn" defaultValue={t?.name_bn} placeholder="নাম (বাংলা)" aria-label="Name (Bangla)" required className="input" lang="bn" />
      <input name="slug" defaultValue={t?.slug} placeholder="slug" aria-label="Slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="input font-mono" />
    </>
  );
}

/** Tags as pills (design/claude-design/Tags.dc.html): add in the header, click a pill to edit. */
export default async function TagsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; q?: string }> }) {
  const sp = await searchParams;
  await requirePageSession("taxonomy.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("*, article_tags(count)").order("name_en");
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 60);
  const rows = ((data ?? []) as (Tag & { article_tags: { count: number }[] })[]).filter(
    (t) => !q || t.name_en.toLowerCase().includes(q) || t.name_bn.includes(q) || t.slug.includes(q),
  );

  return (
    <>
      <PageHeader title="Tags" kicker={`${data?.length ?? 0} tags`} />
      <Flash ok={sp.ok} error={sp.error} />

      <form action={saveTagAction.bind(null, null)} className="card reveal mb-6 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
        <Fields />
        <SubmitButton className="btn btn-primary" pendingLabel="Adding…">Add tag</SubmitButton>
      </form>

      <form className="mb-6 max-w-md" role="search">
        <label className="sr-only" htmlFor="tag-filter">
          Filter tags
        </label>
        <input id="tag-filter" name="q" type="search" defaultValue={sp.q} placeholder="Filter tags…" className="input" />
      </form>

      {rows.length === 0 ? (
        <Empty>{q ? "No tags match that filter." : "No tags yet. Add the first one above."}</Empty>
      ) : (
        <ul className="flex flex-wrap gap-2.5">
          {rows.map((t, i) => (
            <li key={t.id} className="reveal" style={{ animationDelay: `${Math.min(i, 20) * 15}ms` }}>
              <details className="group">
                <summary className="flex h-10 cursor-pointer list-none items-center gap-2.5 rounded-full border border-line pr-2 pl-4 text-sm transition hover:border-white/40 group-open:border-white [&::-webkit-details-marker]:hidden">
                  #{t.name_en}
                  <span className="text-xs text-muted" lang="bn">
                    {t.name_bn}
                  </span>
                  <span className="rounded-full bg-white/[0.08] px-2 py-px text-[11px] text-neutral-700">{t.article_tags?.[0]?.count ?? 0}</span>
                </summary>
                <div className="card mt-2 w-[min(92vw,420px)] space-y-2">
                  <form action={saveTagAction.bind(null, t.id)} className="grid gap-2">
                    <Fields t={t} />
                    <SubmitButton className="btn btn-primary" pendingLabel="Saving…">Save</SubmitButton>
                  </form>
                  <form action={deleteTagAction.bind(null, t.id)}>
                    <HoldSubmit className="w-full" doneLabel="Deleting…">Hold to delete tag</HoldSubmit>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
