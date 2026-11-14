import { requirePageSession } from "@/lib/auth/session";
import { HoldSubmit } from "@/components/admin/form-controls";
import { SubmitButton } from "@/components/admin/submit-button";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";
import { deleteCategoryAction, saveCategoryAction } from "../actions";
import type { Category } from "@/lib/db/types";

export const metadata = { title: "Categories" };

function Fields({ c }: { c?: Category }) {
  return (
    <div className="grid gap-2 md:grid-cols-6">
      <input name="name_en" defaultValue={c?.name_en} placeholder="Name (English)" required className="input" />
      <input name="name_bn" defaultValue={c?.name_bn} placeholder="নাম (বাংলা)" required className="input" lang="bn" />
      <input name="slug" defaultValue={c?.slug} placeholder="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="input font-mono" />
      <input name="description_en" defaultValue={c?.description_en ?? ""} placeholder="Description (EN)" className="input" />
      <input name="description_bn" defaultValue={c?.description_bn ?? ""} placeholder="বিবরণ (BN)" className="input" lang="bn" />
      <input name="sort_order" type="number" min={0} defaultValue={c?.sort_order ?? 0} className="input" aria-label="Sort order" />
    </div>
  );
}

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  await requirePageSession("taxonomy.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order").order("name_en");
  const rows = (data ?? []) as Category[];
  return (
    <>
      <PageHeader title="Categories" />
      <Flash ok={sp.ok} error={sp.error} />
      <form action={saveCategoryAction.bind(null, null)} className="card mb-6 space-y-2">
        <h2 className="font-semibold">Add category</h2>
        <Fields />
        <SubmitButton className="btn btn-primary" pendingLabel="Adding…">Add</SubmitButton>
      </form>
      {rows.length === 0 ? (
        <Empty>No categories yet.</Empty>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <div key={c.id} className="card space-y-2">
              <form action={saveCategoryAction.bind(null, c.id)} className="space-y-2">
                <Fields c={c} />
                <button className="btn">Save</button>
              </form>
              <form action={deleteCategoryAction.bind(null, c.id)}>
                <HoldSubmit className="" doneLabel="Deleting…">Hold to delete</HoldSubmit>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
