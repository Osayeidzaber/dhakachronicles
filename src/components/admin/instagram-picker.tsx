"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Layers, Loader2, Play } from "lucide-react";
import type { FeedItem } from "@/lib/instagram/sync";

function when(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

function SubmitButtons({ count, canPublish }: { count: number; canPublish: boolean }) {
  const { pending, data } = useFormStatus();
  const intent = data?.get("intent");
  return (
    <div className="flex flex-wrap gap-2">
      <button name="intent" value="draft" disabled={!count || pending} className="btn">
        {pending && intent === "draft" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        Import as drafts
      </button>
      {canPublish && (
        <button name="intent" value="publish" disabled={!count || pending} className="btn btn-primary">
          {pending && intent === "publish" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Import &amp; publish
        </button>
      )}
    </div>
  );
}

/** Grid of live Instagram posts; tick the ones to bring into the newsroom. */
export function InstagramPicker({
  items,
  action,
  canPublish,
  categories = [],
}: {
  items: FeedItem[];
  action: (fd: FormData) => Promise<void>;
  canPublish: boolean;
  categories?: { id: string; name: string }[];
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const selectable = items.filter((i) => !i.importStatus || i.importStatus === "failed");
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allPicked = selectable.length > 0 && selectable.every((i) => picked.has(i.id));

  return (
    <form action={action}>
      <div className="sticky top-0 z-10 -mx-5 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-surface/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3 text-sm">
          <button type="button" className="btn h-9 text-xs" onClick={() => setPicked(allPicked ? new Set() : new Set(selectable.map((i) => i.id)))} disabled={!selectable.length}>
            {allPicked ? "Clear" : "Select all new"}
          </button>
          <span className="text-muted" aria-live="polite">
            {picked.size ? `${picked.size} selected` : "Pick posts to import"}
          </span>
          {categories.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-muted">
              Section
              <select name="category_id" defaultValue="" className="input h-9 w-auto py-0 text-sm">
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <SubmitButtons count={picked.size} canPublish={canPublish} />
      </div>
      {[...picked].map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((i, idx) => {
          const done = i.importStatus === "imported";
          const on = picked.has(i.id);
          return (
            <li key={i.id} className="reveal" style={{ animationDelay: `${Math.min(idx, 12) * 30}ms` }}>
              <button
                type="button"
                onClick={() => !done && toggle(i.id)}
                disabled={done}
                aria-pressed={on}
                aria-label={`${on ? "Deselect" : "Select"} post from ${when(i.timestamp)}`}
                className={`group relative block w-full overflow-hidden rounded-2xl border text-left transition duration-300 ${
                  on ? "border-white ring-2 ring-white/60" : "border-white/[0.08] hover:border-white/40"
                } ${done ? "cursor-default opacity-55" : "cursor-pointer"}`}
              >
                <span className="relative block aspect-[4/5] bg-surface-3">
                  {i.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived Instagram CDN preview, not stored
                    <img src={i.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  )}
                  <span className="absolute top-2 left-2 flex gap-1">
                    {i.hasVideo && (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-black/70" title="Video">
                        <Play className="h-3 w-3" aria-hidden="true" />
                      </span>
                    )}
                    {i.slides > 1 && (
                      <span className="flex h-6 items-center gap-1 rounded-full bg-black/70 px-2 text-[11px]" title={`${i.slides} slides`}>
                        <Layers className="h-3 w-3" aria-hidden="true" /> {i.slides}
                      </span>
                    )}
                  </span>
                  <span
                    className={`absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full border transition duration-200 ${
                      on ? "scale-100 border-white bg-white text-black" : "scale-90 border-white/60 bg-black/40"
                    }`}
                    aria-hidden="true"
                  >
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                  {done && <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/80 py-1 text-center text-[11px]">Already imported</span>}
                  {i.importStatus === "failed" && <span className="absolute inset-x-2 bottom-2 rounded-full bg-red-500/80 py-1 text-center text-[11px]">Failed before, try again</span>}
                </span>
                <span className="block p-2.5">
                  <span className="block text-[11px] text-muted">{when(i.timestamp)}</span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-snug text-neutral-700">{i.caption || "No caption"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </form>
  );
}
