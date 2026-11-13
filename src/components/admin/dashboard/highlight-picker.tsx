"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Star } from "lucide-react";
import { searchHighlightAction, setHighlightAction } from "@/app/(cms)/admin/newsroom-actions";
import type { PickResult } from "@/lib/highlight";

const DURATIONS = [
  { hours: 0, label: "Until changed" },
  { hours: 6, label: "6 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
];

/** Find a story by search or from Instagram imports, and pin it to the homepage lead. */
export function HighlightPicker({ currentId }: { currentId: string | null }) {
  const router = useRouter();
  const [source, setSource] = useState<"article" | "instagram">("article");
  const [q, setQ] = useState("");
  const [hours, setHours] = useState(0);
  const [results, setResults] = useState<PickResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const t = window.setTimeout(async () => {
      const res = await searchHighlightAction(q, source);
      if (!live) return;
      setLoading(false);
      if (res.ok) {
        setResults(res.data);
        setError(null);
      } else setError(res.error);
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [q, source]);

  const pick = (id: string) => {
    setBusyId(id);
    start(async () => {
      const res = await setHighlightAction(id, hours);
      setBusyId(null);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="seg" role="tablist" aria-label="Find a story">
          {(["article", "instagram"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={source === s}
              onClick={() => {
                setLoading(true);
                setSource(s);
              }}
            >
              {s === "article" ? "Search articles" : "From Instagram"}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          Pin for
          <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="input h-9 w-auto rounded-full py-0 text-xs">
            {DURATIONS.map((d) => (
              <option key={d.hours} value={d.hours}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex h-11 items-center gap-2 rounded-xl border border-line px-3 text-muted focus-within:border-white/40">
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Search stories to highlight</span>
        <input
          value={q}
          onChange={(e) => {
            setLoading(true);
            setQ(e.target.value);
          }}
          placeholder={source === "article" ? "Search by headline or slug…" : "Search Instagram captions…"}
          className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-subtle"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <ul className="max-h-72 divide-y divide-white/5 overflow-y-auto pr-1">
        {!loading && results.length === 0 && <li className="py-6 text-center text-sm text-muted">Nothing found.</li>}
        {results.map((r) => {
          const current = r.id === currentId;
          const publishable = r.status === "published";
          return (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              {r.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- small R2 thumbnail
                <img src={r.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" loading="lazy" />
              ) : (
                <span className="h-11 w-11 shrink-0 rounded-lg bg-surface-3" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm" lang={r.language}>
                  {r.title || "Untitled"}
                </span>
                <span className="text-xs text-muted capitalize">{r.meta.replace("_", " ")}</span>
              </span>
              {current ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black">
                  <Star className="h-3 w-3 fill-current" aria-hidden="true" /> Highlighted
                </span>
              ) : (
                <button
                  type="button"
                  disabled={!publishable || pending}
                  title={publishable ? undefined : "Publish this story first"}
                  onClick={() => pick(r.id)}
                  className="btn h-8 px-3 text-xs"
                >
                  {busyId === r.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Star className="h-3 w-3" aria-hidden="true" />}
                  {publishable ? "Highlight" : "Not published"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
