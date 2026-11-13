import Link from "next/link";
import { Camera as Instagram, Plus, Star } from "lucide-react";
import { requirePageSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { describeActivity, formatBytes, getDashboardData, pctChange, type Range } from "@/lib/analytics";
import { readHighlight } from "@/lib/highlight";
import { Flash, fmt, timeAgo } from "@/components/admin/ui";
import { Avatar } from "@/components/admin/avatar";
import { Delta, LiveReaders, Stagger, ViewsChart } from "@/components/admin/dashboard/widgets";
import { HighlightPicker } from "@/components/admin/dashboard/highlight-picker";
import { clearHighlightAction } from "./newsroom-actions";
import { markNotificationsReadAction } from "./actions";

export const metadata = { title: "Overview" };

const RANGES: { id: Range; label: string; compare: string }[] = [
  { id: "today", label: "Today", compare: "vs yesterday" },
  { id: "7d", label: "7 days", compare: "vs previous 7 days" },
  { id: "30d", label: "30 days", compare: "vs previous 30 days" },
];
const STORAGE_LIMIT = 10 * 1024 ** 3; // Cloudflare R2 free tier

export default async function Overview({ searchParams }: { searchParams: Promise<{ range?: string; error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const session = await requirePageSession();
  const range: Range = sp.range === "7d" || sp.range === "30d" ? sp.range : "today";
  const compare = RANGES.find((r) => r.id === range)!.compare;
  const role = session.profile.role;
  const supabase = await createClient();

  const [d, highlight, { data: notifications }] = await Promise.all([
    getDashboardData(range),
    readHighlight(),
    supabase.from("notifications").select("id, title, body, link, created_at, read_at").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(5),
  ]);
  const { data: hl } = highlight
    ? await supabase
        .from("articles")
        .select("id, title, language, status, category:categories(name_en), featured_image:media!articles_featured_image_id_fkey(public_url)")
        .eq("id", highlight.article_id)
        .maybeSingle()
    : { data: null };
  const hlArticle = hl as unknown as { id: string; title: string; language: string; category: { name_en: string } | null; featured_image: { public_url: string } | null } | null;

  const first = (session.profile.full_name || "").split(" ")[0] || "there";
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Dhaka" }).format(new Date());
  const langTotal = d.language.bn + d.language.en;
  const bnPct = langTotal ? Math.round((d.language.bn / langTotal) * 100) : 0;
  const catMax = Math.max(1, ...d.byCategory.map((c) => c.views));
  const lead = d.top[0];
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;

  return (
    <>
      <header className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{today}</p>
          <h1 className="font-display mt-1 text-[clamp(2.4rem,4vw,3.3rem)] leading-none">Welcome back, {first}.</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="seg" aria-label="Range">
            {RANGES.map((r) => (
              <Link key={r.id} href={r.id === "today" ? "/admin" : `/admin?range=${r.id}`} aria-current={range === r.id ? "true" : undefined}>
                {r.label}
              </Link>
            ))}
          </nav>
          <Link href="/admin/articles/new" className="btn btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> New article
          </Link>
        </div>
      </header>
      <Flash ok={sp.ok} error={sp.error === "forbidden" ? "You do not have permission to open that page." : sp.error} />

      <Stagger className="mt-7 grid gap-4">
        {/* KPIs */}
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <div className="card flex flex-col gap-3.5 border-white/10">
            <div className="flex items-center justify-between text-[13px] text-muted">
              <span>Reading now</span>
              <span className="live-dot" aria-hidden="true" />
            </div>
            <LiveReaders initial={d.live.total} />
            <span className="text-xs text-muted">Live · last 90 seconds</span>
          </div>
          <Kpi label={range === "today" ? "Views today" : `Views · ${RANGES.find((r) => r.id === range)!.label}`} value={d.views.current.toLocaleString()} pct={pctChange(d.views.current, d.views.previous)} compare={compare} />
          <Kpi label="Stories published" value={d.publishedInRange.current.toLocaleString()} pct={pctChange(d.publishedInRange.current, d.publishedInRange.previous)} compare={compare} />
          <Kpi
            label="Avg. views per story"
            value={(d.top.length ? Math.round(d.views.current / Math.max(1, d.top.filter((t) => t.views).length)) : 0).toLocaleString()}
            pct={null}
            compare=""
            note="Across stories read in this period"
          />
        </section>

        {/* Highlight */}
        {can(role, "article.publish") && (
          <section aria-label="Homepage highlight" className="card grid gap-6 border-white/15 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[15px] font-medium">
                  <Star className="h-4 w-4" aria-hidden="true" /> Highlighted on the homepage
                </h2>
                {highlight?.until && <span className="text-xs text-muted">Until {fmt(highlight.until)}</span>}
              </div>
              {hlArticle ? (
                <>
                  <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                    {hlArticle.featured_image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- R2 image
                      <img src={hlArticle.featured_image.public_url} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
                    ) : (
                      <div className="aspect-[4/3] rounded-xl bg-surface-3" />
                    )}
                    <div className="min-w-0">
                      <p className="kicker">{[hlArticle.category?.name_en, hlArticle.language === "bn" ? "বাংলা" : "English"].filter(Boolean).join(" · ")}</p>
                      <Link href={`/admin/articles/${hlArticle.id}`} lang={hlArticle.language} className="font-display mt-1 line-clamp-3 block text-2xl leading-tight hover:underline">
                        {hlArticle.title}
                      </Link>
                      <p className="mt-2 text-xs text-muted">Lead story in both languages when a translation exists.</p>
                    </div>
                  </div>
                  <form action={clearHighlightAction}>
                    <button className="btn h-9 text-xs">Unpin</button>
                  </form>
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">
                  Nothing is pinned. The homepage leads with the newest featured story. Pick one on the right to pin it.
                </p>
              )}
            </div>
            <div className="border-white/5 lg:col-span-7 lg:border-l lg:pl-6">
              <HighlightPicker currentId={highlight?.article_id ?? null} />
            </div>
          </section>
        )}

        {/* Chart + most read */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="card lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15px] font-medium">Views</h2>
              <div className="flex gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 bg-white" /> This period
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 bg-[#555]" /> Previous
                </span>
              </div>
            </div>
            <ViewsChart points={d.series} />
          </div>
          <div className="card flex flex-col gap-4">
            <h2 className="text-[15px] font-medium">Most read</h2>
            {lead ? (
              <>
                {lead.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- R2 image
                  <img src={lead.imageUrl} alt="" className="aspect-video w-full rounded-xl object-cover" />
                ) : (
                  <div className="aspect-video rounded-xl bg-gradient-to-br from-[#1c1c1c] to-black" />
                )}
                <Link href={`/admin/articles/${lead.id}`} lang={lead.language} className="font-display text-2xl leading-tight hover:underline">
                  {lead.title}
                </Link>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted">
                  <Stat n={lead.views.toLocaleString()} l="views" />
                  <Stat n={String(lead.live)} l="reading now" />
                  <Stat n={fmtPct(pctChange(lead.views, lead.previous))} l={compare.replace("vs ", "vs ")} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">No reads yet in this period.</p>
            )}
          </div>
        </section>

        {/* Top articles + sections */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="card lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[15px] font-medium">Top articles</h2>
              <Link href="/admin/articles" className="text-[13px] text-muted hover:text-white">
                All articles →
              </Link>
            </div>
            {d.top.length ? (
              <div className="overflow-x-auto">
                <table className="table min-w-[560px]">
                  <thead>
                    <tr>
                      <th className="w-8">#</th>
                      <th>Article</th>
                      <th>Lang</th>
                      <th className="text-right">Now</th>
                      <th className="text-right">Views</th>
                      <th className="text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.top.map((t, i) => {
                      const p = pctChange(t.views, t.previous);
                      return (
                        <tr key={t.id}>
                          <td className="text-subtle">{i + 1}</td>
                          <td>
                            <Link href={`/admin/articles/${t.id}`} lang={t.language} className="hover:underline">
                              {t.title}
                            </Link>
                            <div className="text-xs text-subtle">{t.category ?? "—"}</div>
                          </td>
                          <td className="text-muted">{t.language === "bn" ? "বাংলা" : "EN"}</td>
                          <td className="text-right tabular-nums">{t.live || "—"}</td>
                          <td className="text-right tabular-nums">{t.views.toLocaleString()}</td>
                          <td className="text-right text-neutral-700 tabular-nums">{p === null ? "new" : `${p > 0 ? "↑" : p < 0 ? "↓" : "→"} ${Math.abs(p)}%`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted">Stories will appear here once readers arrive.</p>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <div className="card">
              <h2 className="mb-4 text-[15px] font-medium">By section</h2>
              {d.byCategory.length ? (
                d.byCategory.map((c) => (
                  <div key={c.name} className="mb-3.5">
                    <div className="flex justify-between text-[13px]">
                      <span>{c.name}</span>
                      <span className="text-muted tabular-nums">{c.views.toLocaleString()}</span>
                    </div>
                    <div className="mt-2 h-1 rounded bg-white/10">
                      <div className="h-1 rounded bg-white" style={{ width: `${(c.views / catMax) * 100}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No data yet.</p>
              )}
            </div>
            <div className="card flex items-center gap-5">
              <svg width="84" height="84" viewBox="0 0 36 36" role="img" aria-label={`Bangla ${bnPct} percent, English ${100 - bnPct} percent`}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="4" />
                {langTotal > 0 && <circle cx="18" cy="18" r="15.9" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray={`${bnPct} ${100 - bnPct}`} transform="rotate(-90 18 18)" />}
              </svg>
              <div className="flex flex-col gap-1.5 text-[13px]">
                <span lang="bn">
                  বাংলা <b className="font-medium">{bnPct}%</b>
                </span>
                <span className="text-muted">English {langTotal ? 100 - bnPct : 0}%</span>
                <span className="text-xs text-subtle">Share of views</span>
              </div>
            </div>
          </div>
        </section>

        {/* Pipeline, Instagram, storage, activity */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="card">
            <h2 className="mb-3 text-[15px] font-medium">Pipeline</h2>
            {[
              ["Drafts", d.pipeline.draft ?? 0, "draft"],
              ["In review", d.pipeline.pending_review ?? 0, "pending_review"],
              ["Scheduled", d.pipeline.scheduled ?? 0, "scheduled"],
              ["Published", d.pipeline.published ?? 0, "published"],
            ].map(([l, n, s]) => (
              <Link key={String(s)} href={`/admin/articles?status=${s}`} className="flex justify-between border-t border-white/5 py-3 text-sm text-neutral-700 hover:text-white">
                <span>{l}</span>
                <span className="font-medium text-white tabular-nums">{n}</span>
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            {can(role, "instagram.view") && (
              <Link href="/admin/instagram" className="card block transition hover:border-white/20">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-[15px] font-medium">
                    <Instagram className="h-4 w-4" aria-hidden="true" /> Instagram
                  </h2>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${d.instagram.connected ? "bg-white" : "border border-muted"}`} />
                    {d.instagram.connected ? `@${d.instagram.username}` : "Not connected"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted">
                  <Stat n={String(d.instagram.imported)} l="imported" />
                  <Stat n={String(d.instagram.published)} l="published" />
                  <Stat n={String(d.instagram.failed)} l="failed" />
                </div>
                <p className="mt-3 text-xs text-subtle">
                  {d.instagram.mode === "publish" ? "Publishing automatically" : "Saving as drafts"} · last sync {d.instagram.lastSync ? timeAgo(d.instagram.lastSync) : "never"}
                </p>
              </Link>
            )}
            <div className="card">
              <div className="flex justify-between text-[13px]">
                <span className="text-muted">Storage</span>
                <span className="tabular-nums">
                  {formatBytes(d.storage.bytes)} <span className="text-subtle">/ 10 GB</span>
                </span>
              </div>
              <div className="mt-3 h-1.5 rounded bg-white/10">
                <div className="h-1.5 rounded bg-white" style={{ width: `${Math.min(100, (d.storage.bytes / STORAGE_LIMIT) * 100).toFixed(1)}%` }} />
              </div>
              <p className="mt-2 text-xs text-subtle">
                {d.storage.files.toLocaleString()} files · {d.storage.instagramFiles} from Instagram
              </p>
            </div>
          </div>
          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[15px] font-medium">{unread ? `Notifications · ${unread} new` : "Team activity"}</h2>
              {unread ? (
                <form action={markNotificationsReadAction}>
                  <button className="text-xs text-muted hover:text-white">Mark read</button>
                </form>
              ) : (
                <Link href="/admin/profile" className="text-xs text-muted hover:text-white">
                  Yours →
                </Link>
              )}
            </div>
            <ul>
              {unread
                ? (notifications ?? [])
                    .filter((n) => !n.read_at)
                    .map((n) => (
                      <li key={n.id} className="border-t border-white/5 py-2.5 text-[13px]">
                        <Link href={n.link ?? "/admin"} className="hover:underline">
                          {n.title}
                        </Link>
                        <span className="block text-xs text-subtle">
                          {n.body} · {timeAgo(n.created_at)}
                        </span>
                      </li>
                    ))
                : d.activity.slice(0, 6).map((a) => (
                    <li key={a.id} className="flex gap-2.5 border-t border-white/5 py-2.5 text-[13px]">
                      <Avatar name={a.who} url={a.avatar} size={28} />
                      <span className="leading-snug text-neutral-700">
                        <b className="font-medium text-white">{a.who}</b> {describeActivity(a.action, a.meta)}
                        <span className="block text-xs text-subtle">{timeAgo(a.at)}</span>
                      </span>
                    </li>
                  ))}
              {!unread && d.activity.length === 0 && <li className="py-6 text-sm text-muted">No activity yet.</li>}
            </ul>
          </div>
        </section>
      </Stagger>
    </>
  );
}

function Kpi({ label, value, pct, compare, note }: { label: string; value: string; pct: number | null; compare: string; note?: string }) {
  return (
    <div className="card flex flex-col gap-3.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[40px] leading-none font-medium tracking-[-0.03em] tabular-nums">{value}</span>
      {note ? <span className="text-xs text-muted">{note}</span> : <Delta pct={pct} suffix={compare} />}
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="text-xl font-medium text-white tabular-nums">{n}</div>
      {l}
    </div>
  );
}

function fmtPct(p: number | null) {
  return p === null ? "new" : `${p > 0 ? "↑" : p < 0 ? "↓" : ""} ${Math.abs(p)}%`;
}
