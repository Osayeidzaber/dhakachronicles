import Link from "next/link";
import { HoldSubmit } from "@/components/admin/form-controls";
import { SubmitButton } from "@/components/admin/submit-button";
import { ImageField } from "@/components/admin/image-field";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";
import { requirePageSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { TeamMember } from "@/lib/db/types";
import { deleteTeamMemberAction, saveTeamMemberAction } from "../actions";

export const metadata = { title: "Team page" };

/** People shown on the public /team page. Edited by hand, not generated from staff accounts. */
export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; edit?: string; new?: string }> }) {
  const sp = await searchParams;
  await requirePageSession("team.manage");
  const supabase = await createClient();
  const [{ data: rows }, { data: authorRows }] = await Promise.all([
    supabase.from("team_members").select("*, photo:media(public_url)").order("sort_order").order("name_en"),
    supabase.from("authors").select("id, name_en").order("name_en"),
  ]);
  const people = (rows ?? []) as (TeamMember & { photo: { public_url: string } | null })[];
  const authors = (authorRows ?? []) as { id: string; name_en: string }[];
  const selected = sp.new ? null : (people.find((p) => p.id === sp.edit) ?? null);
  const showForm = !!sp.new || !!selected;

  return (
    <>
      <PageHeader title="Team page" kicker="Public site">
        <Link href="/en/team" target="_blank" className="btn">
          View page ↗
        </Link>
        <Link href="/admin/people?new=1" className="btn btn-primary">
          Add person
        </Link>
      </PageHeader>
      <p className="-mt-4 mb-6 text-sm text-muted">Who appears on the public “Our team” page, in this order. Staff accounts are managed separately under Staff.</p>
      <Flash ok={sp.ok} error={sp.error} />

      <div className="flex flex-col gap-6 xl:flex-row">
        <section className="min-w-0 flex-1">
          {people.length === 0 ? (
            <Empty>Nobody on the Team page yet. Add the first person.</Empty>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {people.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/people?edit=${p.id}`}
                    className={`card flex items-center gap-4 transition hover:border-white/30 ${selected?.id === p.id ? "border-white" : ""} ${p.visible ? "" : "opacity-60"}`}
                  >
                    {p.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
                      <img src={p.photo.public_url} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" loading="lazy" />
                    ) : (
                      <span className="font-display grid h-14 w-14 shrink-0 place-items-center rounded-full border border-line text-xl" aria-hidden="true">
                        {p.name_en.slice(0, 1)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name_en}</span>
                      <span className="block truncate text-[13px] text-muted">{p.role_en ?? "No role"}</span>
                    </span>
                    <span className="text-xs text-subtle tabular-nums">{p.visible ? `#${p.sort_order}` : "Hidden"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {showForm && (
          <aside className="reveal order-first w-full shrink-0 xl:order-none xl:w-[400px]">
            <form key={selected?.id ?? "new"} action={saveTeamMemberAction.bind(null, selected?.id ?? null)} className="card flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="kicker">{selected ? "Edit person" : "New person"}</p>
                <Link href="/admin/people" className="text-xs text-muted hover:text-white">
                  Close
                </Link>
              </div>
              <ImageField name="photo_media_id" label="Photo" aspect="round" defaultId={selected?.photo_media_id} defaultUrl={selected?.photo?.public_url} hint="Square photo, face centred" />
              <div className="grid gap-2 sm:grid-cols-2">
                <input name="name_en" defaultValue={selected?.name_en} placeholder="Name (English)" required maxLength={120} className="input" aria-label="Name in English" />
                <input name="name_bn" lang="bn" defaultValue={selected?.name_bn ?? ""} placeholder="নাম (বাংলা)" maxLength={120} className="input" aria-label="Name in Bangla" />
                <input name="role_en" defaultValue={selected?.role_en ?? ""} placeholder="Role, e.g. Editor" maxLength={120} className="input" aria-label="Role in English" />
                <input name="role_bn" lang="bn" defaultValue={selected?.role_bn ?? ""} placeholder="পদবি" maxLength={120} className="input" aria-label="Role in Bangla" />
              </div>
              <textarea name="bio_en" defaultValue={selected?.bio_en ?? ""} placeholder="Short bio (English)" rows={3} maxLength={600} className="input" aria-label="Bio in English" />
              <textarea name="bio_bn" lang="bn" defaultValue={selected?.bio_bn ?? ""} placeholder="সংক্ষিপ্ত পরিচিতি (বাংলা)" rows={3} maxLength={600} className="input" aria-label="Bio in Bangla" />
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <input name="instagram" defaultValue={selected?.instagram ?? ""} placeholder="Instagram handle" maxLength={31} className="input" aria-label="Instagram handle" />
                <input name="sort_order" type="number" min={0} max={9999} defaultValue={selected?.sort_order ?? people.length} className="input" aria-label="Order" title="Order on the page (lower first)" />
              </div>
              <label className="flex flex-col gap-1.5 text-xs text-muted">
                Byline profile (links to their stories)
                <select name="author_id" defaultValue={selected?.author_id ?? ""} className="input">
                  <option value="">None</option>
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name_en}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" name="visible" defaultChecked={selected?.visible ?? true} className="accent-white" /> Show on the Team page
              </label>
              <SubmitButton className="btn btn-primary" pendingLabel="Saving…">
                {selected ? "Save person" : "Add person"}
              </SubmitButton>
            </form>
            {selected && (
              <form action={deleteTeamMemberAction.bind(null, selected.id)} className="mt-2">
                <HoldSubmit className="w-full" doneLabel="Removing…">
                  Hold to remove from page
                </HoldSubmit>
              </form>
            )}
          </aside>
        )}
      </div>
    </>
  );
}
