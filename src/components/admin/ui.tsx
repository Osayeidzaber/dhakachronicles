import Link from "next/link";
import { Suspense } from "react";
import StatusMark, { type StatusMarkStatus } from "@/components/ui/vendor/reactbits/StatusMark";
import { FlashToast } from "./flash-toast";
import type { ArticleStatus } from "@/lib/db/types";

/** Result of a form action: a toast (FlashToast) plus an inline line for screen readers and no-JS. */
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <>
      <Suspense fallback={null}>
        <FlashToast ok={ok} error={error} />
      </Suspense>
      <p
        role={error ? "alert" : "status"}
        className={`reveal my-4 flex items-center gap-2.5 rounded-xl border p-3 text-sm ${error ? "border-red-500/30 bg-red-500/5 text-red-200" : "border-white/15 bg-white/[0.03] text-white"}`}
      >
        <StatusMark status={error ? "failed" : "done"} size={16} />
        {error ?? ok}
      </p>
    </>
  );
}

const STATUS_STYLE: Record<ArticleStatus, string> = {
  draft: "border border-white/20 text-neutral-700",
  pending_review: "border border-dashed border-white/40 text-white",
  scheduled: "bg-[#262626] text-white",
  published: "bg-white text-black",
  archived: "border border-white/10 text-subtle",
};

const STATUS_MARK: Record<ArticleStatus, { mark: StatusMarkStatus; label: string }> = {
  draft: { mark: "pending", label: "Draft" },
  pending_review: { mark: "running", label: "In review" },
  scheduled: { mark: "pending", label: "Scheduled" },
  published: { mark: "done", label: "Published" },
  archived: { mark: "cancelled", label: "Archived" },
};

/** Article status as an animated StatusMark (tick, spinner, dashes, strike) with its label. */
export function StatusBadge({ status }: { status: ArticleStatus }) {
  const s = STATUS_MARK[status];
  return (
    <span className={`badge inline-flex items-center gap-1.5 ${STATUS_STYLE[status]}`}>
      <StatusMark status={s.mark} size={13} strike={false} />
      {s.label}
    </span>
  );
}

export function PageHeader({ title, kicker, children }: { title: string; kicker?: string; children?: React.ReactNode }) {
  return (
    <div className="reveal mb-7 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && <p className="kicker mb-2">{kicker}</p>}
        <h1 className="font-display text-[clamp(2.2rem,4vw,3.2rem)] leading-none">{title}</h1>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Pager({ page, totalPages, href }: { page: number; totalPages: number; href: (p: number) => string }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center gap-2 text-sm" aria-label="Pagination">
      {page > 1 && <Link className="btn" href={href(page - 1)}>Previous</Link>}
      <span className="text-neutral-500">
        Page {page} of {totalPages}
      </span>
      {page < totalPages && <Link className="btn" href={href(page + 1)}>Next</Link>}
    </nav>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-neutral-500">{children}</p>;
}

export function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

/** "5 min ago" style relative time for recent events, date for older ones. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)} d ago`;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}
