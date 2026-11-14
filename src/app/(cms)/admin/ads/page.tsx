import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { HoldSubmit } from "@/components/admin/form-controls";
import { SubmitButton } from "@/components/admin/submit-button";
import { ImageField } from "@/components/admin/image-field";
import { CopyButton } from "@/components/admin/copy-button";
import { Empty, Flash, PageHeader } from "@/components/admin/ui";
import { requirePageSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
import type { Ad, AdSize } from "@/lib/db/types";
import { deleteAdAction, saveAdAction } from "../actions";

export const metadata = { title: "Ads" };

const SIZES: { size: AdSize; label: string; hint: string; aspect: "wide" | "square" }[] = [
  { size: "wide", label: "Desktop banner", hint: "1200 × 300 px (4:1). Homepage and wide screens.", aspect: "wide" },
  { size: "mobile", label: "Phone banner", hint: "640 × 320 px (2:1). Shown on phones instead.", aspect: "wide" },
  { size: "square", label: "Square", hint: "600 × 600 px. Shown inside articles.", aspect: "square" },
];
const PLACEMENT = { home: "Homepage", article: "Inside articles", both: "Homepage + articles" } as const;

function dhakaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
}

function status(ad: Ad, today: string): { label: string; variant: "success" | "warning" | "outline" | "secondary" } {
  if (!ad.active) return { label: "Paused", variant: "outline" };
  if (ad.ends_on && ad.ends_on < today) return { label: "Ended", variant: "secondary" };
  if (ad.starts_on && ad.starts_on > today) return { label: "Scheduled", variant: "warning" };
  return { label: "Running", variant: "success" };
}

const n = (x: number) => x.toLocaleString("en-IN");
const ctr = (clicks: number, imps: number) => (imps ? `${((clicks / imps) * 100).toFixed(1)}%` : "—");

/** Website banner ads: several image sizes each, with impressions, clicks and a shareable report. */
export default async function AdsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; ad?: string; new?: string }> }) {
  const sp = await searchParams;
  await requirePageSession("brand_deals.manage");
  const supabase = await createClient();
  const [{ data: adRows }, { data: creativeRows }, { data: statRows }, { data: dealRows }] = await Promise.all([
    supabase.from("ads").select("*").order("created_at", { ascending: false }),
    supabase.from("ad_creatives").select("ad_id, size, media_id, media:media(public_url)"),
    supabase.from("ad_stats").select("ad_id, day, impressions, clicks"),
    supabase.from("brand_deals").select("id, brand_name").order("brand_name"),
  ]);
  const ads = (adRows ?? []) as Ad[];
  const creatives = (creativeRows ?? []) as unknown as { ad_id: string; size: AdSize; media_id: string; media: { public_url: string } | null }[];
  const stats = (statRows ?? []) as { ad_id: string; day: string; impressions: number; clicks: number }[];
  const deals = (dealRows ?? []) as { id: string; brand_name: string }[];
  const today = dhakaToday();

  const totals = (adId?: string) =>
    stats.filter((s) => !adId || s.ad_id === adId).reduce((t, s) => ({ imp: t.imp + s.impressions, clk: t.clk + s.clicks }), { imp: 0, clk: 0 });
  const all = totals();
  const running = ads.filter((a) => status(a, today).label === "Running").length;

  const selected = sp.new ? null : (ads.find((a) => a.id === sp.ad) ?? null);
  const showForm = !!sp.new || !!selected;
  const creative = (size: AdSize) => creatives.find((c) => c.ad_id === selected?.id && c.size === size);
  const reportUrl = selected ? `${siteUrl()}/en/ad-report/${selected.report_token}` : "";
  const selStats = selected ? totals(selected.id) : null;

  return (
    <>
      <PageHeader title="Ads" kicker="Website banners">
        <Link href="/en/advertise" target="_blank" className="btn">
          Advertise page ↗
        </Link>
        <Link href="/admin/ads?new=1" className="btn btn-primary">
          New ad
        </Link>
      </PageHeader>
      <p className="-mt-4 mb-6 text-sm text-muted">Banners on the homepage and inside articles, always labelled “Advertisement”. Upload each size you have; the site picks the right one per screen.</p>
      <Flash ok={sp.ok} error={sp.error} />

      <div className="reveal mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { k: "Running now", v: String(running) },
          { k: "Impressions", v: n(all.imp) },
          { k: "Clicks", v: n(all.clk) },
          { k: "Click rate", v: ctr(all.clk, all.imp) },
        ].map((s) => (
          <div key={s.k} className="card">
            <p className="kicker">{s.k}</p>
            <p className="font-display mt-2 truncate text-3xl leading-none">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        <section className="min-w-0 flex-1">
          {ads.length === 0 ? (
            <Empty>No ads yet. Create one with “New ad”.</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {ads.map((ad) => {
                const st = status(ad, today);
                const t = totals(ad.id);
                const thumb = creatives.find((c) => c.ad_id === ad.id && c.size === "wide") ?? creatives.find((c) => c.ad_id === ad.id);
                return (
                  <li key={ad.id}>
                    <Link href={`/admin/ads?ad=${ad.id}`} className={`card flex flex-col gap-4 transition hover:border-white/30 sm:flex-row sm:items-center ${selected?.id === ad.id ? "border-white" : ""}`}>
                      <div className="aspect-[4/1] w-full shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] sm:w-48">
                        {thumb?.media && (
                          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                          <img src={thumb.media.public_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{ad.name}</span>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </div>
                        <p className="mt-1 truncate text-[13px] text-muted">
                          {ad.advertiser} · {PLACEMENT[ad.placement]}
                          {ad.ends_on ? ` · until ${ad.ends_on}` : ""}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-right text-[13px] tabular-nums sm:w-56">
                        <span>
                          <b className="block font-medium">{n(t.imp)}</b>
                          <span className="text-xs text-subtle">views</span>
                        </span>
                        <span>
                          <b className="block font-medium">{n(t.clk)}</b>
                          <span className="text-xs text-subtle">clicks</span>
                        </span>
                        <span>
                          <b className="block font-medium">{ctr(t.clk, t.imp)}</b>
                          <span className="text-xs text-subtle">rate</span>
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {showForm && (
          <aside className="reveal order-first w-full shrink-0 xl:order-none xl:w-[420px]">
            {selected && selStats && (
              <div className="card mb-3 flex flex-col gap-3">
                <p className="kicker">Report for the advertiser</p>
                <p className="text-[13px] text-neutral-600">
                  {n(selStats.imp)} views · {n(selStats.clk)} clicks · {ctr(selStats.clk, selStats.imp)} click rate. Share this private link; it shows only this ad&apos;s numbers.
                </p>
                <div className="flex gap-2">
                  <input readOnly value={reportUrl} className="input min-w-0 flex-1 font-mono text-xs" aria-label="Report link" />
                  <CopyButton value={reportUrl} />
                </div>
                <a href={reportUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] text-muted hover:text-white">
                  Open report ↗
                </a>
              </div>
            )}
            <form key={selected?.id ?? "new"} action={saveAdAction.bind(null, selected?.id ?? null)} className="card flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="kicker">{selected ? "Edit ad" : "New ad"}</p>
                <Link href="/admin/ads" className="text-xs text-muted hover:text-white">
                  Close
                </Link>
              </div>
              <input name="name" defaultValue={selected?.name} placeholder="Ad name, e.g. Eid sale banner" required maxLength={160} className="input" aria-label="Ad name" />
              <input name="advertiser" defaultValue={selected?.advertiser} placeholder="Advertiser (shown to readers)" required maxLength={160} className="input" aria-label="Advertiser" />
              <input name="link_url" type="url" defaultValue={selected?.link_url} placeholder="Link, https://…" required className="input" aria-label="Link" />
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1.5 text-xs text-muted">
                  Placement
                  <select name="placement" defaultValue={selected?.placement ?? "home"} className="input">
                    {Object.entries(PLACEMENT).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-muted">
                  Brand deal
                  <select name="brand_deal_id" defaultValue={selected?.brand_deal_id ?? ""} className="input">
                    <option value="">None</option>
                    {deals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.brand_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-muted">
                  Starts
                  <input name="starts_on" type="date" defaultValue={selected?.starts_on ?? ""} className="input" />
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-muted">
                  Ends
                  <input name="ends_on" type="date" defaultValue={selected?.ends_on ?? ""} className="input" />
                </label>
              </div>
              <fieldset className="flex flex-col gap-4 rounded-xl border border-white/[0.08] p-3">
                <legend className="px-1 text-xs text-muted">Images (at least one)</legend>
                {SIZES.map((s) => (
                  <ImageField
                    key={s.size}
                    name={`creative_${s.size}`}
                    label={s.label}
                    hint={s.hint}
                    aspect={s.aspect}
                    defaultId={creative(s.size)?.media_id}
                    defaultUrl={creative(s.size)?.media?.public_url}
                  />
                ))}
              </fieldset>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" name="active" defaultChecked={selected?.active ?? true} className="accent-white" /> Running (untick to pause)
              </label>
              <SubmitButton className="btn btn-primary" pendingLabel="Saving…">
                {selected ? "Save ad" : "Create ad"}
              </SubmitButton>
            </form>
            {selected && (
              <form action={deleteAdAction.bind(null, selected.id)} className="mt-2">
                <HoldSubmit className="w-full" doneLabel="Deleting…">
                  Hold to delete ad
                </HoldSubmit>
              </form>
            )}
          </aside>
        )}
      </div>
    </>
  );
}
