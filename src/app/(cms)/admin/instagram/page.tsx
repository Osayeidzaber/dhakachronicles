import Link from "next/link";
import { requirePageSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { instagramConfig } from "@/lib/env";
import { Empty, Flash, PageHeader, fmt } from "@/components/admin/ui";
import { instagramAutoImportAction, instagramDisconnectAction, instagramRetryAction, instagramSyncAction } from "../actions";
import type { InstagramAccount, InstagramImport, SyncRun } from "@/lib/db/types";

export const metadata = { title: "Instagram" };

export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; connected?: string; tab?: string }> }) {
  const sp = await searchParams;
  const session = await requirePageSession("instagram.view");
  const manage = can(session.profile.role, "instagram.manage");
  const supabase = await createClient();
  const cfg = instagramConfig();
  const tab = sp.tab === "failed" ? "failed" : "all";

  let importsQuery = supabase.from("instagram_imports").select("*").order("media_timestamp", { ascending: false }).limit(50);
  if (tab === "failed") importsQuery = importsQuery.eq("status", "failed");
  const [{ data: acc }, { data: runs }, { data: imports }, { count: importedCount }, { count: failedCount }] = await Promise.all([
    supabase.from("instagram_accounts").select("*").limit(1).maybeSingle(),
    supabase.from("instagram_sync_runs").select("*").order("started_at", { ascending: false }).limit(15),
    importsQuery,
    supabase.from("instagram_imports").select("id", { count: "exact", head: true }).eq("status", "imported"),
    supabase.from("instagram_imports").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  const account = acc as InstagramAccount | null;
  const connected = account?.status === "connected" || account?.status === "token_expired" || account?.status === "error";

  return (
    <>
      <PageHeader title="Instagram" />
      <Flash ok={sp.connected ? `Connected @${sp.connected}` : sp.ok} error={sp.error} />

      {!cfg && (
        <div className="mb-6 rounded bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Instagram is not configured.</p>
          <p>
            Set <code>INSTAGRAM_APP_ID</code>, <code>INSTAGRAM_APP_SECRET</code>, <code>INSTAGRAM_REDIRECT_URI</code> and <code>TOKEN_ENCRYPTION_KEY</code>, then follow
            <code> docs/INSTAGRAM_SETUP.md</code>. Nothing is imported until the official Meta app is set up and <b>@dhakachronicles</b> is authorized.
          </p>
        </div>
      )}

      <section className="card mb-6">
        <h2 className="mb-3 font-semibold">Connection</h2>
        <dl className="grid max-w-xl grid-cols-2 gap-1 text-sm">
          <dt className="text-neutral-500">Expected account</dt>
          <dd>@{cfg?.expectedUsername ?? "dhakachronicles"}</dd>
          <dt className="text-neutral-500">Connected account</dt>
          <dd>{account && account.status !== "disconnected" ? `@${account.username}` : "—"}</dd>
          <dt className="text-neutral-500">Instagram account ID</dt>
          <dd className="font-mono text-xs">{account?.ig_user_id ?? "—"}</dd>
          <dt className="text-neutral-500">Status</dt>
          <dd>{account?.status ?? "not connected"}</dd>
          <dt className="text-neutral-500">Token expires</dt>
          <dd>{fmt(account?.token_expires_at)}</dd>
          <dt className="text-neutral-500">Last sync attempt</dt>
          <dd>{fmt(account?.last_synced_at)}</dd>
          <dt className="text-neutral-500">Last successful sync</dt>
          <dd>{fmt(account?.last_successful_sync_at)}</dd>
          <dt className="text-neutral-500">Imported posts</dt>
          <dd>{importedCount ?? 0}</dd>
          <dt className="text-neutral-500">Failed imports</dt>
          <dd>{failedCount ?? 0}</dd>
          {account?.last_error && (
            <>
              <dt className="text-neutral-500">Last error</dt>
              <dd className="text-red-700">{account.last_error}</dd>
            </>
          )}
        </dl>
        {manage && cfg && (
          <div className="mt-4 flex flex-wrap gap-2">
            <form action="/api/instagram/connect" method="get">
              <button className="btn btn-primary">{connected ? "Reconnect" : "Connect Instagram"}</button>
            </form>
            {connected && (
              <form action={instagramDisconnectAction}>
                <button className="btn btn-danger">Disconnect</button>
              </form>
            )}
          </div>
        )}
      </section>

      {manage && connected && account && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <section className="card">
            <h2 className="mb-2 font-semibold">Sync now</h2>
            <form action={instagramSyncAction} className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <label>
                  Max posts
                  <input name="maxPosts" type="number" min={1} max={1000} defaultValue={account.initial_import_completed ? 25 : 100} className="input mt-1" />
                </label>
                <label>
                  Page size
                  <input name="pageSize" type="number" min={1} max={50} defaultValue={25} className="input mt-1" />
                </label>
                <label>
                  Max pages
                  <input name="maxPages" type="number" min={1} max={40} defaultValue={account.initial_import_completed ? 1 : 4} className="input mt-1" />
                </label>
                <label>
                  From date
                  <input name="since" type="date" className="input mt-1" />
                </label>
                <label>
                  To date
                  <input name="until" type="date" className="input mt-1" />
                </label>
              </div>
              {!account.initial_import_completed && <input type="hidden" name="initial" value="1" />}
              <button className="btn btn-primary">{account.initial_import_completed ? "Sync now" : "Run historical import"}</button>
              <p className="text-xs text-neutral-500">Already-imported posts are skipped automatically. Imported posts become drafts; nothing is published automatically.</p>
            </form>
          </section>
          <section className="card">
            <h2 className="mb-2 font-semibold">Automatic synchronization</h2>
            <form action={instagramAutoImportAction} className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="auto_import" defaultChecked={account.auto_import} /> Check for new posts every 15 minutes (Supabase Cron)
              </label>
              <button className="btn">Save</button>
            </form>
          </section>
        </div>
      )}

      <section className="card mb-6">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-semibold">Imported posts</h2>
          <Link href="/admin/instagram" className={`badge ${tab === "all" ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}>
            All
          </Link>
          <Link href="/admin/instagram?tab=failed" className={`badge ${tab === "failed" ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}>
            Failed
          </Link>
        </div>
        {!imports?.length ? (
          <Empty>No imports yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Posted</th>
                  <th>Type</th>
                  <th>Caption</th>
                  <th>Status</th>
                  <th>Draft</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(imports as InstagramImport[]).map((i) => (
                  <tr key={i.id}>
                    <td className="whitespace-nowrap">{fmt(i.media_timestamp)}</td>
                    <td>{i.media_type}</td>
                    <td className="max-w-md">
                      <p className="line-clamp-2">{i.caption || "—"}</p>
                      {i.permalink && (
                        <a href={i.permalink} target="_blank" rel="noreferrer noopener" className="text-xs underline">
                          Permalink
                        </a>
                      )}
                      {i.error_message && <p className="text-xs text-red-700">{i.error_message}</p>}
                    </td>
                    <td>
                      {i.status}
                      {i.status === "failed" && <div className="text-xs text-neutral-500">attempts {i.attempts}{i.next_retry_at ? `, retry ${fmt(i.next_retry_at)}` : ""}</div>}
                    </td>
                    <td>{i.article_id ? <Link className="underline" href={`/admin/articles/${i.article_id}`}>Open draft</Link> : "—"}</td>
                    <td>
                      {manage && i.status === "failed" && (
                        <form action={instagramRetryAction.bind(null, i.id)}>
                          <button className="btn">Retry</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Sync history</h2>
        {!runs?.length ? (
          <Empty>No syncs yet.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Fetched</th>
                <th>Imported</th>
                <th>Skipped</th>
                <th>Failed</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {(runs as SyncRun[]).map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{fmt(r.started_at)}</td>
                  <td>{r.trigger}</td>
                  <td>{r.status}</td>
                  <td>{r.fetched_count}</td>
                  <td>{r.imported_count}</td>
                  <td>{r.skipped_count}</td>
                  <td>{r.failed_count}</td>
                  <td className="text-red-700">{r.error_message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
