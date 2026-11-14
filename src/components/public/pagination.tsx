import Link from "next/link";
import type { Lang } from "@/lib/db/types";
import { t } from "@/lib/i18n";

export function Pagination({ lang, page, totalPages, href }: { lang: Lang; page: number; totalPages: number; href: (p: number) => string }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-10 flex items-center justify-between text-sm" aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className="btn">
          ← {t(lang, "previous")}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} rel="next" className="btn">
          {t(lang, "next")} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
