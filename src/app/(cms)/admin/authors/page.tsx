import { requirePageSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";
import { deleteAuthorAction, saveAuthorAction } from "../actions";
import type { Author, Profile } from "@/lib/db/types";

export const metadata = { title: "Authors" };

function Fields({ a, staff }: { a?: Author; staff: Pick<Profile, "id" | "full_name">[] }) {
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
        <input name="avatar_media_id" defaultValue={a?.avatar_media_id ?? ""} placeholder="Avatar media ID (from Media library)" className="input font-mono text-xs" />
      </div>
    </div>
  );
}

export default async function AuthorsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  await requirePageSession("authors.manage");
  const supabase = await createClient();
  const [{ data }, { data: staff }] = await Promise.all([
    supabase.from("authors").select("*").order("name_en"),
    supabase.from("profiles").select("id, full_name").not("role", "is", null).order("full_name"),
  ]);
  const rows = (data ?? []) as Author[];
  const staffList = (staff ?? []) as Pick<Profile, "id" | "full_name">[];
  return (
    <>
      <PageHeader title="Authors" />
      <p className="mb-4 text-sm text-neutral-500">Authors are public bylines. They can optionally be linked to a staff account.</p>
      <Flash ok={sp.ok} error={sp.error} />
      <form action={saveAuthorAction.bind(null, null)} className="card mb-6 space-y-2">
        <h2 className="font-semibold">Add author</h2>
        <Fields staff={staffList} />
        <button className="btn btn-primary">Add</button>
      </form>
      {rows.length === 0 ? (
        <Empty>No authors yet.</Empty>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <div key={a.id} className="card space-y-2">
              <form action={saveAuthorAction.bind(null, a.id)} className="space-y-2">
                <Fields a={a} staff={staffList} />
                <div className="flex gap-2">
                  <button className="btn">Save</button>
                  <a className="btn" href={`/en/author/${a.slug}`} target="_blank" rel="noreferrer">
                    Public page
                  </a>
                </div>
              </form>
              <form action={deleteAuthorAction.bind(null, a.id)}>
                <button className="btn btn-danger">Delete</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
