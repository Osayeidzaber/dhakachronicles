import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isLang } from "@/lib/i18n";
import { getAdReport } from "@/lib/articles/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ad report", robots: { index: false, follow: false } };

const PLACEMENT: Record<string, string> = { home: "Homepage", article: "Inside articles", both: "Homepage and articles" };
const n = (x: number) => x.toLocaleString("en-IN");
const day = (d: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${d}T00:00:00`));

/** Private, read-only performance report for one ad, opened with its secret link. */
export default async function AdReportPage({ params }: { params: Promise<{ lang: string; token: string }> }) {
  const { lang, token } = await params;
  if (!isLang(lang) || !z.string().regex(/^[a-f0-9]{32,128}$/).safeParse(token).success) notFound();
  const r = await getAdReport(token).catch(() => null);
  if (!r) notFound();

  const imp = r.stats.reduce((s, d) => s + d.impressions, 0);
  const clk = r.stats.reduce((s, d) => s + d.clicks, 0);
  const max = Math.max(1, ...r.stats.map((d) => d.impressions));
  const recent = r.stats.slice(-30);

  return (
    <div className="flex flex-col gap-10">
      <header className="reveal flex flex-col gap-3 border-b border-white pb-7">
        <span className="kicker">Advertising report · {r.live ? "Running" : "Not running"}</span>
        <h1 className="font-display text-[clamp(2.5rem,7vw,4.5rem)] leading-[0.98]">{r.name}</h1>
        <p className="text-neutral-600">
          {r.advertiser} · {PLACEMENT[r.placement] ?? r.placement}
          {r.starts_on || r.ends_on ? ` · ${r.starts_on ?? "…"} to ${r.ends_on ?? "ongoing"}` : ""}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { k: "Times seen", v: n(imp), note: "Counted when at least half the ad is on screen for a second." },
          { k: "Clicks", v: n(clk), note: "Readers who opened your link." },
          { k: "Click rate", v: imp ? `${((clk / imp) * 100).toFixed(2)}%` : "—", note: "Clicks divided by times seen." },
        ].map((s) => (
          <div key={s.k} className="card">
            <p className="kicker">{s.k}</p>
            <p className="font-display mt-2 text-4xl leading-none">{s.v}</p>
            <p className="mt-3 text-[13px] text-subtle">{s.note}</p>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="mb-5 text-[15px] font-medium">Daily, last {recent.length || 0} days</h2>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No views yet. Numbers appear here as soon as readers see the ad.</p>
        ) : (
          <>
            <div className="flex h-40 items-end gap-1" role="img" aria-label="Daily views chart">
              {recent.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col justify-end" title={`${day(d.day)}: ${n(d.impressions)} views, ${n(d.clicks)} clicks`}>
                  <div className="rounded-t bg-white/80" style={{ height: `${Math.max(2, (d.impressions / max) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="table min-w-[360px]">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th className="text-right">Seen</th>
                    <th className="text-right">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {[...recent].reverse().map((d) => (
                    <tr key={d.day}>
                      <td>{day(d.day)}</td>
                      <td className="text-right tabular-nums">{n(d.impressions)}</td>
                      <td className="text-right tabular-nums">{n(d.clicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <p className="text-[13px] text-subtle">Dhaka Chronicles · figures update live · days are Dhaka time.</p>
    </div>
  );
}
