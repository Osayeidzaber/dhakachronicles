import Link from "next/link";
import { requirePageSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { Flash, PageHeader, fmt } from "@/components/admin/ui";
import { markNotificationsReadAction } from "./actions";
import type { ArticleStatus } from "@/lib/db/types";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await requirePageSession();
  const supabase = await createClient();

  const [{ data: counts }, { data: notifications }, { data: activity }, { data: ig }, igFailedRes] = await Promise.all([
    supabase.rpc("article_status_counts"),
    supabase.from("notifications").select("*").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(8),
    can(session.profile.role, "audit.view")
      ? supabase.from("audit_logs").select("action, target_type, target_id, created_at, user:profiles(full_name)").order("created_at", { ascending: false }).limit(12)
      : supabase.from("articles").select("id, title, status, updated_at").order("updated_at", { ascending: false }).limit(12),
    can(session.profile.role, "instagram.view")
      ? supabase.from("instagram_accounts").select("username, status, last_successful_sync_at, last_error, auto_import").limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    can(session.profile.role, "instagram.view")
      ? supabase.from("instagram_imports").select("id", { count: "exact", head: true }).eq("status", "failed")
      : Promise.resolve({ count: 0 }),
  ]);

  const byStatus = Object.fromEntries(((counts ?? []) as { status: ArticleStatus; total: number }[]).map((c) => [c.status, Number(c.total)]));
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const tiles: [string, number, string][] = [
    ["Total articles", total, "/admin/articles"],
    ["Published", byStatus.published ?? 0, "/admin/articles?status=published"],
    ["Drafts", byStatus.draft ?? 0, "/admin/articles?status=draft"],
    ["Pending review", byStatus.pending_review ?? 0, "/admin/articles?status=pending_review"],
    ["Scheduled", byStatus.scheduled ?? 0, "/admin/articles?status=scheduled"],
  ];
  const failedImports = igFailedRes.count ?? 0;

  return (
    <>
      <PageHeader title="Dashboard">
        <Link href="/admin/articles/new" className="btn btn-primary">
          New article
        </Link>
      </PageHeader>
      <Flash error={error === "forbidden" ? "You do not have permission to open that page." : undefined} />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map(([label, value, href]) => (
          <Link key={label} href={href} className="card hover:border-neutral-400">
            <div className="text-2xl font-semibold">{value}</div>
            <div className="text-sm text-neutral-500">{label}</div>
          </Link>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Notifications</h2>
            {notifications?.some((n: { read_at: string | null }) => !n.read_at) && (
              <form action={markNotificationsReadAction}>
                <button className="btn">Mark all read</button>
              </form>
            )}
          </div>
          {!notifications?.length ? (
            <p className="text-sm text-neutral-500">No notifications.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {notifications.map((n: { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }) => (
                <li key={n.id} className={n.read_at ? "text-neutral-500" : ""}>
                  {n.link ? <Link href={n.link} className="font-medium underline">{n.title}</Link> : <span className="font-medium">{n.title}</span>}
                  {n.body && <span> — {n.body}</span>}
                  <div className="text-xs text-neutral-400">{fmt(n.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {can(session.profile.role, "instagram.view") && (
          <section className="card">
            <h2 className="mb-3 font-semibold">Instagram</h2>
            {ig ? (
              <dl className="grid grid-cols-2 gap-1 text-sm">
                <dt className="text-neutral-500">Account</dt>
                <dd>@{ig.username}</dd>
                <dt className="text-neutral-500">Status</dt>
                <dd>{ig.status}</dd>
                <dt className="text-neutral-500">Last successful sync</dt>
                <dd>{fmt(ig.last_successful_sync_at)}</dd>
                <dt className="text-neutral-500">Failed imports</dt>
                <dd>{failedImports}</dd>
                <dt className="text-neutral-500">Auto-import</dt>
                <dd>{ig.auto_import ? "On" : "Off"}</dd>
                {ig.last_error && (
                  <>
                    <dt className="text-neutral-500">Last error</dt>
                    <dd className="text-red-700">{ig.last_error}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-sm text-neutral-500">Not connected.</p>
            )}
            <Link href="/admin/instagram" className="btn mt-3">
              Open Instagram
            </Link>
          </section>
        )}

        <section className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Recent activity</h2>
          <ul className="space-y-1 text-sm">
            {(activity ?? []).map((a: Record<string, unknown>, i: number) =>
              "action" in a ? (
                <li key={i}>
                  <span className="text-neutral-400">{fmt(a.created_at as string)}</span>{" "}
                  {((a.user as { full_name?: string } | null)?.full_name ?? "System")} · {a.action as string} · {a.target_type as string}
                </li>
              ) : (
                <li key={i}>
                  <span className="text-neutral-400">{fmt(a.updated_at as string)}</span>{" "}
                  <Link className="underline" href={`/admin/articles/${a.id as string}`}>{a.title as string}</Link> ({a.status as string})
                </li>
              ),
            )}
          </ul>
        </section>
      </div>
    </>
  );
}
