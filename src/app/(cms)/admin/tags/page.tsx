import { requirePageSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";
import { deleteTagAction, saveTagAction } from "../actions";
import type { Tag } from "@/lib/db/types";

export const metadata = { title: "Tags" };

function Fields({ t }: { t?: Tag }) {
  return (
    <>
      <input name="name_en" defaultValue={t?.name_en} placeholder="Name (English)" required className="input" />
      <input name="name_bn" defaultValue={t?.name_bn} placeholder="নাম (বাংলা)" required className="input" lang="bn" />
      <input name="slug" defaultValue={t?.slug} placeholder="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="input font-mono" />
    </>
  );
}

export default async function TagsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  await requirePageSession("taxonomy.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("*").order("name_en");
  const rows = (data ?? []) as Tag[];
  return (
    <>
      <PageHeader title="Tags" />
      <Flash ok={sp.ok} error={sp.error} />
      <form action={saveTagAction.bind(null, null)} className="card mb-6 grid gap-2 md:grid-cols-4">
        <Fields />
        <button className="btn btn-primary">Add tag</button>
      </form>
      {rows.length === 0 ? (
        <Empty>No tags yet.</Empty>
      ) : (
        <div className="space-y-2">
          {rows.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2">
              <form action={saveTagAction.bind(null, t.id)} className="grid flex-1 gap-2 md:grid-cols-4">
                <Fields t={t} />
                <button className="btn">Save</button>
              </form>
              <form action={deleteTagAction.bind(null, t.id)}>
                <button className="btn btn-danger">Delete</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
