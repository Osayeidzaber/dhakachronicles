"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** "Staff sign in" for readers; "Newsroom →" (with first name) when a staff member is signed in. */
export function StaffLink({ label }: { label: string }) {
  const [me, setMe] = useState<{ staff: boolean; name?: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setMe(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  if (me?.staff) {
    return (
      <Link href="/admin" className="hidden items-center gap-1.5 text-white hover:text-neutral-700 sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
        {me.name ? `${me.name} · Newsroom →` : "Newsroom →"}
      </Link>
    );
  }
  return (
    <Link href="/login" className="hidden hover:text-white sm:inline">
      {label}
    </Link>
  );
}
