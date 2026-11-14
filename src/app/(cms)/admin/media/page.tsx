import Link from "next/link";
import HoverVideoPlayer from "@/components/ui/vendor/cult/hover-video-player";
import { HoldSubmit } from "@/components/admin/form-controls";
import { SubmitButton } from "@/components/admin/submit-button";
import { Progress } from "@/components/ui/progress";
import { requirePageSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBytes } from "@/lib/analytics";
import { r2Config } from "@/lib/env";
import { Empty, Flash, PageHeader, Pager, fmt } from "@/components/admin/ui";
import { deleteMediaAction, updateMediaAction } from "../actions";
import { Uploader } from "./uploader";
import type { Media } from "@/lib/db/types";

export const metadata = { title: "Media" };
const PAGE_SIZE = 24;

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; ok?: string; error?: string; id?: string }> }) {
  const sp = await searchParams;
  await requirePageSession("media.upload");
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let q = supabase.from("media").select("*", { count: "exact" }).eq("status", "ready");
  if (sp.q?.trim()) q = q.ilike("original_filename", `%${sp.q.trim().replace(/[%_]/g, "")}%`);
  const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as Media[];
  let selected = rows.find((m) => m.id === sp.id) ?? null;
  if (!selected && sp.id && /^[0-9a-f-]{36}$/i.test(sp.id)) {
    const { data: one } = await supabase.from("media").select("*").eq("id", sp.id).maybeSingle();
    selected = (one as Media | null) ?? null;
  }

  return (
    <>
      <PageHeader title="Media" />
      <Flash ok={sp.ok} error={sp.error} />
      <StorageCard />
      {!r2Config() && (
        <p className="mb-4 rounded-2xl border border-amber-500/30 p-4 text-sm text-amber-200">
          Media storage is not set up yet, so uploads are turned off. Ask the site administrator to finish the setup.
        </p>
      )}
      <Uploader />
      <form className="mb-4 flex gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Search filenames…" className="input max-w-xs" />
        <button className="btn">Search</button>
      </form>
      {rows.length === 0 ? (
        <Empty>{sp.q ? "No files match that search." : "No media yet. Upload images above, or import posts from Instagram."}</Empty>
      ) : (
        <div className="flex flex-col gap-6 xl:flex-row">
          <ul className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {rows.map((m, i) => {
              const isVideo = m.mime_type.startsWith("video/");
              const thumb = isVideo
                ? ((m.variants as unknown as { kind?: string; url?: string }[]).find((v) => v.kind === "poster")?.url ?? null)
                : (m.variants.find((v) => v.format === "webp" && v.width <= 640)?.url ?? m.public_url);
              const on = selected?.id === m.id;
              return (
                <li key={m.id} className="reveal" style={{ animationDelay: `${Math.min(i, 16) * 20}ms` }}>
                  <Link
                    href={`/admin/media?id=${m.id}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}${page > 1 ? `&page=${page}` : ""}`}
                    scroll={false}
                    aria-current={on ? "true" : undefined}
                    className={`group relative block aspect-[4/5] overflow-hidden rounded-2xl border bg-surface-3 transition ${on ? "border-white ring-2 ring-white/50" : "border-white/[0.08] hover:border-white/40"}`}
                  >
                    {isVideo ? (
                      // Reels play silently on hover, with the cover as the still frame.
                      <HoverVideoPlayer videoSrc={m.public_url} thumbnailSrc={thumb ?? undefined} muted loop preload="none" className="h-full w-full [&_img]:object-cover [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
                    ) : (
                      thumb && (
                        // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail from R2
                        <img src={thumb} alt={m.alt_text_en ?? ""} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                      )
                    )}
                    <span className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-neutral-700 backdrop-blur">
                      <span className="truncate">{m.source === "instagram" ? "Instagram" : "Upload"}</span>
                      {isVideo && <span className="text-white">▶ Video</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {selected && (
            <aside className="card reveal w-full shrink-0 space-y-3 self-start xl:sticky xl:top-6 xl:w-[360px]">
              {selected.mime_type.startsWith("video/") ? (
                <video src={selected.public_url} controls playsInline preload="metadata" className="w-full rounded-xl bg-black" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview from R2
                <img src={selected.public_url} alt={selected.alt_text_en ?? ""} className="max-h-[420px] w-full rounded-xl object-contain" />
              )}
              <div>
                <p className="truncate text-sm font-medium" title={selected.original_filename}>
                  {selected.original_filename}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {selected.source === "instagram" ? "From Instagram" : "Uploaded"} · {fmt(selected.created_at)}
                  {selected.width ? ` · ${selected.width}×${selected.height}` : ""} · {(selected.file_size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <form action={updateMediaAction.bind(null, selected.id)} className="space-y-2">
                <label className="block text-xs text-muted">
                  Alt text (English)
                  <input name="alt_text_en" defaultValue={selected.alt_text_en ?? ""} placeholder="Describe the image" className="input mt-1" />
                </label>
                <label className="block text-xs text-muted">
                  Alt text (বাংলা)
                  <input name="alt_text_bn" defaultValue={selected.alt_text_bn ?? ""} className="input mt-1" lang="bn" />
                </label>
                <label className="block text-xs text-muted">
                  Caption
                  <input name="caption" defaultValue={selected.caption ?? ""} className="input mt-1" />
                </label>
                <label className="block text-xs text-muted">
                  Credit
                  <input name="credit" defaultValue={selected.credit ?? ""} className="input mt-1" />
                </label>
                <SubmitButton className="btn btn-primary w-full" pendingLabel="Saving…">Save details</SubmitButton>
              </form>
              <p className="text-xs text-muted">Files used by a published or scheduled article can’t be deleted.</p>
              <form action={deleteMediaAction.bind(null, selected.id)}>
                <HoldSubmit className="w-full" doneLabel="Deleting…">Hold to delete</HoldSubmit>
              </form>
              <p className="font-mono text-[10px] break-all text-muted">ID {selected.id}</p>
            </aside>
          )}
        </div>
      )}
      <Pager page={page} totalPages={Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))} href={(p) => `/admin/media?page=${p}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`} />
    </>
  );
}

const LIMIT = 10 * 1024 ** 3;

/** Total R2 usage: originals plus generated AVIF/WebP sizes. */
async function StorageCard() {
  const { data } = await createAdminClient().from("media").select("file_size, variants, source");
  const rows = (data ?? []) as { file_size: number; variants: { size?: number; format?: string }[] | null; source: string }[];
  const originals = rows.reduce((s, r) => s + (r.file_size ?? 0), 0);
  const variants = rows.reduce((s, r) => s + (r.variants ?? []).reduce((v, x) => v + (x.size ?? 0), 0), 0);
  const total = originals + variants;
  return (
    <section className="card mb-6 grid gap-5 md:grid-cols-[1.2fr_1fr]">
      <div>
        <h2 className="text-[13px] text-muted">Storage used</h2>
        <p className="mt-2 text-4xl font-medium tracking-tight tabular-nums">
          {formatBytes(total)} <span className="text-base font-normal text-muted">of 10 GB free tier</span>
        </p>
        <Progress value={Math.min(100, (total / LIMIT) * 100)} aria-label="Storage used" className="mt-4" />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-xs text-muted">
        <div><dt>Files</dt><dd className="text-lg text-white tabular-nums">{rows.length.toLocaleString()}</dd></div>
        <div><dt>From Instagram</dt><dd className="text-lg text-white tabular-nums">{rows.filter((r) => r.source === "instagram").length}</dd></div>
        <div><dt>Originals</dt><dd className="text-lg text-white tabular-nums">{formatBytes(originals)}</dd></div>
        <div><dt>Optimized copies</dt><dd className="text-lg text-white tabular-nums">{formatBytes(variants)}</dd></div>
      </dl>
    </section>
  );
}
