import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { HoldSubmit } from "@/components/admin/form-controls";
import { SubmitButton } from "@/components/admin/submit-button";
import { requirePageSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";
import { BRAND_DEAL_STAGES } from "@/lib/articles/validation";
import type { BrandDeal, BrandDealStage, Profile } from "@/lib/db/types";
import { deleteBrandDealAction, saveBrandDealAction } from "../actions";

export const metadata = { title: "Brand deals" };

const STAGE_LABEL: Record<BrandDealStage, string> = {
  lead: "Lead",
  negotiating: "Negotiating",
  contracted: "Contracted",
  in_production: "In production",
  published: "Published",
  cancelled: "Cancelled",
};

function money(amount: number | null, currency: string) {
  if (amount == null) return "—";
  return `${currency} ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount)}`;
}

function day(d: string | null) {
  if (!d) return "No date";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T00:00:00`));
}

/** Today and a week from today as YYYY-MM-DD (Dhaka time), read once per request. */
function dateWindow() {
  const iso = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(t));
  const now = Date.now();
  return { today: iso(now), weekAhead: iso(now + 7 * 864e5) };
}

type Sp ={ ok?: string; error?: string; view?: string; deal?: string; new?: string };

export default async function BrandDealsPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const sp = await searchParams;
  const session = await requirePageSession("brand_deals.manage");
  const supabase = await createClient();
  const [{ data: dealRows }, { data: staffRows }, { data: articleRows }] = await Promise.all([
    supabase.from("brand_deals").select("*").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("profiles").select("id, full_name").not("role", "is", null).order("full_name"),
    supabase.from("articles").select("id, title, language").order("updated_at", { ascending: false }).limit(50),
  ]);
  const deals = (dealRows ?? []) as BrandDeal[];
  const staff = (staffRows ?? []) as Pick<Profile, "id" | "full_name">[];
  const articles = (articleRows ?? []) as { id: string; title: string; language: string }[];

  const view = sp.view === "list" ? "list" : "board";
  const selected = sp.new ? null : (deals.find((d) => d.id === sp.deal) ?? null);
  const showPanel = !!sp.new || !!selected;
  const href = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (view === "list") p.set("view", "list");
    for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/brand-deals${s ? `?${s}` : ""}`;
  };

  const open = deals.filter((d) => d.stage !== "published" && d.stage !== "cancelled");
  const sum = (list: BrandDeal[]) => {
    const byCur = new Map<string, number>();
    for (const d of list) if (d.fee_amount != null) byCur.set(d.currency, (byCur.get(d.currency) ?? 0) + Number(d.fee_amount));
    return byCur.size ? [...byCur].map(([c, a]) => money(a, c)).join(" + ") : "—";
  };
  const { today, weekAhead } = dateWindow();
  const stats = [
    { k: "Open deals", v: String(open.length) },
    { k: "Contracted value", v: sum(deals.filter((d) => ["contracted", "in_production", "published"].includes(d.stage))) },
    { k: "Due this week", v: String(open.filter((d) => d.due_date && d.due_date >= today && d.due_date <= weekAhead).length) },
    { k: "Awaiting payment", v: sum(deals.filter((d) => d.invoice_sent && !d.paid)) },
  ];

  return (
    <>
      <PageHeader title="Brand deals">
        <Link href={href({ new: "1" })} className="btn btn-primary">
          New deal
        </Link>
      </PageHeader>
      <p className="-mt-4 mb-6 text-sm text-muted">Sponsored posts, reels and articles. Paid content must always be labelled “Sponsored”.</p>
      <Flash ok={sp.ok} error={sp.error} />

      <div className="reveal mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.k} className="card">
            <p className="kicker">{s.k}</p>
            <p className="font-display mt-2 truncate text-3xl leading-none">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        <section className="min-w-0 flex-1">
          <div role="tablist" aria-label="View" className="mb-4 flex gap-1 border-b border-white/[0.08]">
            {(["board", "list"] as const).map((v) => (
              <Link
                key={v}
                role="tab"
                aria-selected={view === v}
                href={v === "list" ? "/admin/brand-deals?view=list" : "/admin/brand-deals"}
                className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm transition ${view === v ? "border-white text-white" : "border-transparent text-muted hover:text-white"}`}
              >
                {v === "board" ? "Pipeline" : "List"}
              </Link>
            ))}
          </div>

          {deals.length === 0 ? (
            <Empty>No deals yet. Add the first one with “New deal”.</Empty>
          ) : view === "board" ? (
            <div className="flex gap-3 overflow-x-auto pb-3">
              {BRAND_DEAL_STAGES.filter((s) => s !== "cancelled").map((stage) => {
                const col = deals.filter((d) => d.stage === stage);
                return (
                  <div key={stage} className="flex w-60 shrink-0 flex-col gap-2.5">
                    <div className="flex justify-between px-1 text-xs text-muted">
                      <span className="kicker">{STAGE_LABEL[stage]}</span>
                      <span>{col.length}</span>
                    </div>
                    {col.map((d) => (
                      <Link
                        key={d.id}
                        href={href({ deal: d.id })}
                        className={`flex flex-col gap-1.5 rounded-2xl border bg-surface p-3.5 transition hover:border-white/40 ${selected?.id === d.id ? "border-white" : "border-white/[0.08]"}`}
                      >
                        <span className="text-sm font-medium">{d.brand_name}</span>
                        {d.deliverables && <span className="line-clamp-2 text-xs text-neutral-600">{d.deliverables}</span>}
                        <span className="flex justify-between text-xs text-muted">
                          <span>{money(d.fee_amount, d.currency)}</span>
                          <span>{day(d.due_date)}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    {["Brand", "Deliverables", "Stage", "Fee", "Due", "Paid"].map((h) => (
                      <th key={h} scope="col" className="px-4 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d) => (
                    <tr key={d.id} className="border-t border-white/[0.06]">
                      <td className="px-4 py-3.5">
                        <Link href={href({ deal: d.id })} className="hover:underline">
                          {d.brand_name}
                        </Link>
                      </td>
                      <td className="max-w-xs truncate px-4 py-3.5 text-neutral-600">{d.deliverables ?? "—"}</td>
                      <td className="px-4 py-3.5">
                        <Badge variant={d.stage === "published" ? "success" : d.stage === "cancelled" ? "destructive" : d.stage === "lead" ? "outline" : "secondary"}>{STAGE_LABEL[d.stage]}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-neutral-600">{money(d.fee_amount, d.currency)}</td>
                      <td className="px-4 py-3.5 text-muted">{day(d.due_date)}</td>
                      <td className="px-4 py-3.5">{d.paid ? <Badge variant="success">Paid</Badge> : d.invoice_sent ? <Badge variant="warning">Invoiced</Badge> : <span className="text-muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {showPanel && (
          <aside className="reveal w-full shrink-0 xl:w-[380px]">
            <form action={saveBrandDealAction.bind(null, selected?.id ?? null)} className="card flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="kicker">{selected ? STAGE_LABEL[selected.stage] : "New deal"}</p>
                <Link href={href({})} className="text-xs text-muted hover:text-white">
                  Close
                </Link>
              </div>
              <input name="brand_name" defaultValue={selected?.brand_name} placeholder="Brand name" required maxLength={200} className="input font-display text-xl" aria-label="Brand name" />
              <div className="grid grid-cols-2 gap-2">
                <input name="contact_name" defaultValue={selected?.contact_name ?? ""} placeholder="Contact name" className="input" aria-label="Contact name" />
                <input name="contact_email" type="email" defaultValue={selected?.contact_email ?? ""} placeholder="Contact email" className="input" aria-label="Contact email" />
              </div>
              <label className="flex flex-col gap-1.5 text-xs text-muted">
                Stage
                <select name="stage" defaultValue={selected?.stage ?? "lead"} className="input">
                  {BRAND_DEAL_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <textarea name="deliverables" defaultValue={selected?.deliverables ?? ""} placeholder="Deliverables (e.g. one reel, one sponsored article)" rows={2} className="input" aria-label="Deliverables" />
              <div className="grid grid-cols-[1fr_88px] gap-2">
                <input name="fee_amount" type="number" min={0} step="0.01" defaultValue={selected?.fee_amount ?? ""} placeholder="Fee" className="input" aria-label="Fee amount" />
                <input name="currency" defaultValue={selected?.currency ?? "BDT"} maxLength={3} className="input uppercase" aria-label="Currency" />
              </div>
              <label className="flex flex-col gap-1.5 text-xs text-muted">
                Due date
                <input name="due_date" type="date" defaultValue={selected?.due_date ?? ""} className="input" />
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-muted">
                Owner
                <select name="owner_id" defaultValue={selected?.owner_id ?? session.userId} className="input">
                  <option value="">Nobody</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || "Unnamed staff"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-muted">
                Linked article
                <select name="article_id" defaultValue={selected?.article_id ?? ""} className="input">
                  <option value="">None</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.language}] {a.title}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.08] p-3 text-sm">
                <legend className="px-1 text-xs text-muted">Checklist</legend>
                {(
                  [
                    ["brief_approved", "Brief approved"],
                    ["brand_signoff", "Brand sign-off"],
                    ["invoice_sent", "Invoice sent"],
                    ["paid", "Paid"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-neutral-700">
                    <input type="checkbox" name={k} defaultChecked={!!selected?.[k]} className="accent-white" /> {label}
                  </label>
                ))}
              </fieldset>
              <textarea name="notes" defaultValue={selected?.notes ?? ""} placeholder="Notes" rows={3} className="input" aria-label="Notes" />
              <SubmitButton className="btn btn-primary" pendingLabel="Adding…">{selected ? "Save deal" : "Add deal"}</SubmitButton>
            </form>
            {selected && session.profile.role === "admin" && (
              <form action={deleteBrandDealAction.bind(null, selected.id)} className="mt-2">
                <HoldSubmit className="w-full" doneLabel="Deleting…">Hold to delete deal</HoldSubmit>
              </form>
            )}
          </aside>
        )}
      </div>
    </>
  );
}
