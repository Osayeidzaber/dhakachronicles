"use client";

import { useCallback, useEffect, useState } from "react";
import { listMediaAction } from "@/app/(cms)/admin/actions";
import { uploadFile } from "@/components/admin/upload";
import type { Media } from "@/lib/db/types";

/** Modal for choosing (or uploading) an image from the media library. */
export function MediaPicker({ open, onClose, onPick, articleId }: { open: boolean; onClose: () => void; onPick: (m: Media) => void; articleId?: string }) {
  const [items, setItems] = useState<Media[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setBusy(true);
    const res = await listMediaAction(1, query);
    setBusy(false);
    if (res.ok) setItems(res.data.items);
    else setError(res.error);
  }, []);

  useEffect(() => {
    if (!open) return;
    let live = true;
    listMediaAction(1, "").then((res) => {
      if (!live) return;
      if (res.ok) setItems(res.data.items);
      else setError(res.error);
    });
    return () => {
      live = false;
    };
  }, [open]);

  if (!open) return null;

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(files)) {
        const m = await uploadFile(f, articleId ? "articles" : "uploads", articleId);
        setItems((prev) => [m, ...prev]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Media library">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-line bg-[#0a0a0a]">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(q)} placeholder="Search filenames…" className="input max-w-xs" />
          <button type="button" className="btn" onClick={() => load(q)}>Search</button>
          <label className="btn cursor-pointer">
            Upload
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} />
          </label>
          <button type="button" className="btn ml-auto" onClick={onClose}>Close</button>
        </div>
        {error && <p className="m-3 rounded bg-red-500/10 p-2 text-sm text-red-300">{error}</p>}
        <div className="grid flex-1 grid-cols-3 gap-2 overflow-y-auto p-3 sm:grid-cols-4 md:grid-cols-6">
          {busy && <p className="col-span-full text-sm text-neutral-500">Working…</p>}
          {!busy && items.length === 0 && <p className="col-span-full text-sm text-neutral-500">No images yet. Upload one.</p>}
          {items.map((m) => (
            <button key={m.id} type="button" className="group overflow-hidden rounded border hover:ring-2 hover:ring-neutral-800" onClick={() => onPick(m)} title={m.original_filename}>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail from R2 */}
              <img src={m.variants.find((v) => v.width <= 320 && v.format === "webp")?.url ?? m.public_url} alt={m.alt_text_en ?? ""} className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
