import Link from "next/link";
import { HoldSubmit, SwitchField } from "@/components/admin/form-controls";
import { SubmitButton } from "@/components/admin/submit-button";
import { requirePageSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { instagramConfig } from "@/lib/env";
import { Empty, Flash, PageHeader, fmt } from "@/components/admin/ui";
import { instagramModeAction } from "../newsroom-actions";
import { HighlightButton } from "@/components/admin/highlight-button";
import { readHighlight } from "@/lib/highlight";
import { instagramApproveAction, instagramAutoImportAction, instagramDisconnectAction, instagramImportSelectedAction, instagramTokenConnectAction, instagramRetryAction, instagramSyncAction } from "../actions";
import { InstagramPicker } from "@/components/admin/instagram-picker";
import { browseFeed, type FeedItem } from "@/lib/instagram/sync";
import type { InstagramAccount, InstagramImport, SyncRun } from "@/lib/db/types";

export const metadata = { title: "Instagram" };

export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; connected?: string; tab?: string; after?: string }> }) {
  const sp = await searchParams;
  const session = await requirePageSession("instagram.view");
  const manage = can(session.profile.role, "instagram.manage");
  const supabase = await createClient();
  const cfg = instagramConfig();
  const tab = sp.tab === "failed" || sp.tab === "drafts" || sp.tab === "browse" ? sp.tab : "all";
  const canPublish = can(session.profile.role, "article.publish");

  let importsQuery = supabase.from("instagram_imports").select("*, article:articles(status)").order("media_timestamp", { ascending: false }).limit(50);
  if (tab === "failed") importsQuery = importsQuery.eq("status", "failed");
  if (tab === "drafts") importsQuery = importsQuery.eq("status", "imported");
  const [{ data: acc }, { data: runs }, { data: imports }, { count: importedCount }, { count: failedCount }] = await Promise.all([
    supabase.from("instagram_accounts").select("*").limit(1).maybeSingle(),
    supabase.from("instagram_sync_runs").select("*").order("started_at", { ascending: false }).limit(15),
    importsQuery,
    supabase.from("instagram_imports").select("id", { count: "exact", head: true }).eq("status", "imported"),
    supabase.from("instagram_imports").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  const account = acc as (InstagramAccount & { import_mode?: string }) | null;
  const pinned = (await readHighlight())?.article_id ?? null;
  const connected = account?.status === "connected" || account?.status === "token_expired" || account?.status === "error";

  const { data: cats } = await supabase.from("categories").select("id, name_en").order("sort_order").order("name_en");
  const sectionOptions = ((cats ?? []) as { id: string; name_en: string }[]).map((c) => ({ id: c.id, name: c.name_en }));
  let feed: { items: FeedItem[]; after?: string } | null = null;
  let feedError: string | null = null;
  if (tab === "browse" && connected && manage) {
    try {
      feed = await browseFeed(sp.after && /^[\w=-]{1,400}$/.test(sp.after) ? sp.after : undefined);
    } catch (err) {
      feedError = err instanceof Error ? err.message : "Could not load the Instagram feed.";
    }
  }
  type Row = InstagramImport & { article?: { status: string } | null };
  const rows = ((imports ?? []) as Row[]).filter((i) => tab !== "drafts" || i.article?.status !== "published");
  const draftRows = rows.filter((i) => i.article_id && i.article?.status && i.article.status !== "published");

  return (
    <>
      <PageHeader title="Instagram" />
      <Flash ok={sp.connected ? `Connected @${sp.connected}` : sp.ok} error={sp.error} />

      {!cfg && (
        <div className="mb-6 rounded-2xl border border-line p-4 text-sm text-neutral-700">
          <p className="font-semibold">Instagram is not configured.</p>
          <p>
            Set <code>INSTAGRAM_APP_ID</code>, <code>INSTAGRAM_APP_SECRET</code>, <code>INSTAGRAM_CONFIG_ID</code>, <code>INSTAGRAM_REDIRECT_URI</code> and <code>TOKEN_ENCRYPTION_KEY</code>, then follow
            <code> docs/INSTAGRAM_SETUP.md</code>. Nothing is imported until the official Meta app is set up and <b>@dhakachronicles</b> is authorized.
          </p>
        </div>
      )}

      <section className="card mb-6">
        <h2 className="mb-3 text-[15px] font-medium">Connection</h2>
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
              <dd className="text-red-300">{account.last_error}</dd>
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
                <HoldSubmit className="" doneLabel="Disconnecting…">Hold to disconnect</HoldSubmit>
              </form>
            )}
          </div>
        )}
        {manage && cfg && (
          <form action={instagramTokenConnectAction} className="mt-4 max-w-xl space-y-2 border-t border-neutral-200 pt-4 text-sm">
            <label className="block font-medium" htmlFor="ig-token">
              Or paste an access token
            </label>
            <p className="text-xs text-neutral-500">
              Meta App Dashboard → Instagram API → API setup with Unified login → Generate access tokens. The token is checked against @
              {cfg.expectedUsername}, stored encrypted, and never shown again.
            </p>
            <input id="ig-token" name="token" type="password" autoComplete="off" required className="input font-mono" />
            <button className="btn">Connect with token</button>
          </form>
        )}
      </section>

      {manage && connected && account && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <section className="card">
            <h2 className="mb-2 text-[15px] font-medium">Sync now</h2>
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
              <SubmitButton className="btn btn-primary" pendingLabel="Syncing…">{account.initial_import_completed ? "Sync now" : "Run historical import"}</SubmitButton>
              <p className="text-xs text-neutral-500">Already-imported posts are skipped automatically. Imported posts become drafts; nothing is published automatically.</p>
            </form>
          </section>
          <section className="card">
            <h2 className="mb-2 text-[15px] font-medium">Automatic synchronization</h2>
            <form action={instagramAutoImportAction} className="space-y-2 text-sm">
              <SwitchField name="auto_import" label="Check for new posts every 15 minutes" defaultChecked={account.auto_import} />
              <SubmitButton className="btn">Save</SubmitButton>
            </form>
          </section>
        </div>
      )}

      {manage && connected && account && (
        <section className="card mb-6">
          <h2 className="text-[15px] font-medium">When a new post appears</h2>
          <p className="mt-1 mb-4 text-[13px] text-muted">Checked every 15 minutes when automatic sync is on. Discord is told either way (Settings → Discord).</p>
          <form action={instagramModeAction} className="grid gap-3 md:grid-cols-2">
            {[
              ["publish", "Publish automatically", "Goes live on the site right away, with the caption as the story."],
              ["draft", "Save as draft", "An editor reviews and publishes it."],
            ].map(([value, title, desc]) => (
              <label key={value} className="flex cursor-pointer gap-3 rounded-2xl border border-line p-4 transition has-[:checked]:border-white">
                <input type="radio" name="mode" value={value} defaultChecked={(account.import_mode ?? "draft") === value} className="mt-1 accent-white" />
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="mt-1 block text-[13px] text-muted">{desc}</span>
                </span>
              </label>
            ))}
            <SubmitButton className="btn btn-primary justify-self-start" pendingLabel="Saving…">Save</SubmitButton>
          </form>
        </section>
      )}

      <section className="card mb-6">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-[15px] font-medium">Posts</h2>
          {(
            [
              ["all", "Imported"],
              ["drafts", "Needs approval"],
              ["failed", "Failed"],
              ...(manage && connected ? [["browse", "Pick from Instagram"]] : []),
            ] as [string, string][]
          ).map(([k, label]) => (
            <Link key={k} href={k === "all" ? "/admin/instagram" : `/admin/instagram?tab=${k}`} className={`badge transition ${tab === k ? "bg-white text-black" : "bg-neutral-100 hover:bg-neutral-200"}`}>
              {label}
            </Link>
          ))}
          {canPublish && draftRows.length > 0 && tab !== "browse" && (
            <button form="approve-form" className="btn btn-primary ml-auto h-9 text-xs">
              Approve &amp; publish selected
            </button>
          )}
        </div>
        {tab === "browse" ? (
          feedError ? (
            <p role="alert" className="rounded-xl border border-red-500/30 p-4 text-sm text-red-200">{feedError}</p>
          ) : !feed?.items.length ? (
            <Empty>No posts found on Instagram.</Empty>
          ) : (
            <>
              <InstagramPicker items={feed.items} action={instagramImportSelectedAction} canPublish={canPublish} categories={sectionOptions} />
              {feed.after && (
                <div className="mt-6 flex justify-center">
                  <Link href={`/admin/instagram?tab=browse&after=${encodeURIComponent(feed.after)}`} className="btn">
                    Older posts →
                  </Link>
                </div>
              )}
            </>
          )
        ) : !rows.length ? (
          <Empty>No imports yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <form id="approve-form" action={instagramApproveAction} />
            <table className="table">
              <thead>
                <tr>
                  {canPublish && <th className="w-8"><span className="sr-only">Select</span></th>}
                  <th>Posted</th>
                  <th>Type</th>
                  <th>Caption</th>
                  <th>Status</th>
                  <th>Draft</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id}>
                    {canPublish && (
                      <td>
                        {i.article_id && i.article?.status && i.article.status !== "published" && (
                          <input type="checkbox" form="approve-form" name="article_ids" value={i.article_id} aria-label="Select draft" className="accent-white" />
                        )}
                      </td>
                    )}
                    <td className="whitespace-nowrap">{fmt(i.media_timestamp)}</td>
                    <td>{i.media_type}</td>
                    <td className="max-w-md">
                      <p className="line-clamp-2">{i.caption || "—"}</p>
                      {i.permalink && (
                        <a href={i.permalink} target="_blank" rel="noreferrer noopener" className="text-xs underline">
                          Permalink
                        </a>
                      )}
                      {i.error_message && <p className="text-xs text-red-300">{i.error_message}</p>}
                    </td>
                    <td>
                      {i.status}
                      {i.status === "failed" && <div className="text-xs text-neutral-500">attempts {i.attempts}{i.next_retry_at ? `, retry ${fmt(i.next_retry_at)}` : ""}</div>}
                    </td>
                    <td>
                      {i.article_id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Link className="underline" href={`/admin/articles/${i.article_id}`}>
                            Open
                          </Link>
                          {i.article?.status && <span className="badge">{i.article.status === "published" ? "Live" : i.article.status.replace("_", " ")}</span>}
                          {i.article?.status === "published" && manage && <HighlightButton articleId={i.article_id} active={pinned === i.article_id} compact />}
                          {canPublish && i.article?.status && i.article.status !== "published" && (
                            <button form="approve-form" name="article_ids" value={i.article_id} className="btn h-8 text-xs">
                              Approve &amp; publish
                            </button>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
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
        <h2 className="mb-3 text-[15px] font-medium">Sync history</h2>
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
                  <td className="text-red-300">{r.error_message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
