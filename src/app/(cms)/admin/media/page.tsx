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

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  await requirePageSession("media.upload");
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let q = supabase.from("media").select("*", { count: "exact" }).eq("status", "ready");
  if (sp.q?.trim()) q = q.ilike("original_filename", `%${sp.q.trim().replace(/[%_]/g, "")}%`);
  const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as Media[];

  return (
    <>
      <PageHeader title="Media" />
      <Flash ok={sp.ok} error={sp.error} />
      <StorageCard />
      {!r2Config() && (
        <p className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-800">
          Cloudflare R2 is not configured. Set the R2_* variables (see SETUP docs) to enable uploads.
        </p>
      )}
      <Uploader />
      <form className="mb-4 flex gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Search filenames…" className="input max-w-xs" />
        <button className="btn">Search</button>
      </form>
      {rows.length === 0 ? (
        <Empty>No media yet.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => (
            <div key={m.id} className="card space-y-2">
              <a href={m.public_url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                <img src={m.variants.find((v) => v.format === "webp" && v.width <= 640)?.url ?? m.public_url} alt={m.alt_text_en ?? ""} className="aspect-video w-full rounded object-cover" />
              </a>
              <p className="truncate text-xs text-neutral-500" title={m.original_filename}>
                {m.original_filename} · {m.width}×{m.height} · {(m.file_size / 1024).toFixed(0)} KB · {m.source} · {fmt(m.created_at)}
              </p>
              <p className="font-mono text-[10px] break-all text-neutral-400">{m.id}</p>
              <form action={updateMediaAction.bind(null, m.id)} className="space-y-1">
                <input name="alt_text_en" defaultValue={m.alt_text_en ?? ""} placeholder="Alt text (English)" className="input" />
                <input name="alt_text_bn" defaultValue={m.alt_text_bn ?? ""} placeholder="বিকল্প লেখা (বাংলা)" className="input" lang="bn" />
                <input name="caption" defaultValue={m.caption ?? ""} placeholder="Caption" className="input" />
                <input name="credit" defaultValue={m.credit ?? ""} placeholder="Credit" className="input" />
                <button className="btn">Save</button>
              </form>
              <form action={deleteMediaAction.bind(null, m.id)}>
                <button className="btn btn-danger">Delete</button>
              </form>
            </div>
          ))}
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
        <div className="mt-4 h-1.5 rounded bg-white/10">
          <div className="h-1.5 rounded bg-white" style={{ width: `${Math.min(100, (total / LIMIT) * 100).toFixed(1)}%` }} />
        </div>
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
