import Link from "next/link";
import type { ArticleStatus } from "@/lib/db/types";

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <p role={error ? "alert" : "status"} className={`mb-4 rounded p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>
      {error ?? ok}
    </p>
  );
}

const STATUS_STYLE: Record<ArticleStatus, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  pending_review: "bg-amber-100 text-amber-800",
  scheduled: "bg-blue-100 text-blue-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-neutral-200 text-neutral-500",
};

export function StatusBadge({ status }: { status: ArticleStatus }) {
  return <span className={`badge ${STATUS_STYLE[status]}`}>{status.replace("_", " ")}</span>;
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{title}</h1>
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
  return <p className="rounded border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">{children}</p>;
}

export function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}
