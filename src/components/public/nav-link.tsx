"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Section link that marks itself as the current page (white + underline) when its URL matches. */
export function NavLink({ href, exact = false, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative pb-1 transition after:absolute after:inset-x-0 after:-bottom-px after:h-px after:origin-left after:bg-white after:transition-transform after:duration-300 ${
        active ? "text-white after:scale-x-100" : "text-neutral-600 after:scale-x-0 hover:text-white hover:after:scale-x-100"
      }`}
    >
      {children}
    </Link>
  );
}
