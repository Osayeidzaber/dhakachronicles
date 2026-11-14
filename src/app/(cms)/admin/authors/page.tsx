import { requirePageSession } from "@/lib/auth/session";
import { HoldSubmit } from "@/components/admin/form-controls";
import { SubmitButton } from "@/components/admin/submit-button";
import { ImageField } from "@/components/admin/image-field";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";
import { deleteAuthorAction, saveAuthorAction } from "../actions";
import type { Author, Profile } from "@/lib/db/types";

export const metadata = { title: "Authors" };

function Fields({ a, staff }: { a?: Author & { avatar?: { public_url: string } | null }; staff: Pick<Profile, "id" | "full_name">[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      <input name="name_en" defaultValue={a?.name_en} placeholder="Name (English)" required className="input" />
      <input name="name_bn" defaultValue={a?.name_bn} placeholder="নাম (বাংলা)" required className="input" lang="bn" />
      <input name="slug" defaultValue={a?.slug} placeholder="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="input font-mono" />
      <textarea name="bio_en" defaultValue={a?.bio_en ?? ""} placeholder="Bio (English)" className="input" rows={2} />
      <textarea name="bio_bn" defaultValue={a?.bio_bn ?? ""} placeholder="পরিচিতি (বাংলা)" className="input" rows={2} lang="bn" />
      <div className="space-y-2">
        <input name="email" type="email" defaultValue={a?.email ?? ""} placeholder="Public email (optional)" className="input" />
        <select name="profile_id" defaultValue={a?.profile_id ?? ""} className="input" aria-label="Linked staff account">
          <option value="">No linked staff account</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name || s.id}
            </option>
          ))}
        </select>
        <ImageField name="avatar_media_id" label="Photo" aspect="round" defaultId={a?.avatar_media_id} defaultUrl={a?.avatar?.public_url} />
      </div>
    </div>
  );
}

/** Author cards (design/claude-design/Authors.dc.html): click Edit to open the form inside the card. */
export default async function AuthorsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; new?: string }> }) {
  const sp = await searchParams;
  await requirePageSession("authors.manage");
  const supabase = await createClient();
  const [{ data }, { data: staff }] = await Promise.all([
    supabase.from("authors").select("*, articles(count), avatar:media(public_url)").order("name_en"),
    supabase.from("profiles").select("id, full_name").not("role", "is", null).order("full_name"),
  ]);
  const rows = (data ?? []) as (Author & { articles: { count: number }[]; avatar: { public_url: string } | null })[];
  const staffList = (staff ?? []) as Pick<Profile, "id" | "full_name">[];
  const staffName = (id: string | null) => staffList.find((s) => s.id === id)?.full_name ?? null;
  const initials = (n: string) =>
    n
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <>
      <PageHeader title="Authors" kicker="Bylines, and the public “Our team” page">
        <details className="group relative">
          <summary className="btn btn-primary cursor-pointer list-none [&::-webkit-details-marker]:hidden">New author</summary>
          <form action={saveAuthorAction.bind(null, null)} className="card absolute right-0 z-20 mt-2 w-[min(92vw,640px)] space-y-3 shadow-2xl">
            <Fields staff={staffList} />
            <SubmitButton className="btn btn-primary" pendingLabel="Adding…">Add author</SubmitButton>
          </form>
        </details>
      </PageHeader>
      <Flash ok={sp.ok} error={sp.error} />
      {rows.length === 0 ? (
        <Empty>No authors yet. Use “New author” to add the first byline.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((a, i) => (
            <article key={a.id} className="card reveal flex flex-col gap-4" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              <div className="flex items-center gap-3.5">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-line bg-gradient-to-br from-[#1f1f1f] to-black text-[15px]" aria-hidden="true">
                  {initials(a.name_en)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-medium">{a.name_en}</p>
                  <p className="truncate text-sm text-neutral-600" lang="bn">
                    {a.name_bn}
                  </p>
                </div>
              </div>
              <div className="flex justify-between text-[13px] text-muted">
                <span>{staffName(a.profile_id) ? `Linked to ${staffName(a.profile_id)}` : "Not linked to staff"}</span>
                <span>{a.articles?.[0]?.count ?? 0} articles</span>
              </div>
              <details className="group">
                <summary className="flex cursor-pointer list-none gap-2 [&::-webkit-details-marker]:hidden">
                  <span className="btn h-8 text-xs group-open:bg-white group-open:text-black">Edit</span>
                  <a className="btn h-8 text-xs" href={`/en/author/${a.slug}`} target="_blank" rel="noreferrer">
                    View page ↗
                  </a>
                </summary>
                <div className="mt-4 space-y-3 border-t border-white/[0.08] pt-4">
                  <form action={saveAuthorAction.bind(null, a.id)} className="space-y-3">
                    <Fields a={a} staff={staffList} />
                    <SubmitButton className="btn btn-primary" pendingLabel="Saving…">Save</SubmitButton>
                  </form>
                  <form action={deleteAuthorAction.bind(null, a.id)}>
                    <HoldSubmit className="w-full" doneLabel="Deleting…">Hold to delete author</HoldSubmit>
                  </form>
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
