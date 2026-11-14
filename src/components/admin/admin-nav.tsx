"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeDollarSign, FileText, FolderTree, Hash, Image as ImageIcon, Camera as Instagram, LayoutDashboard, PenLine, Settings, UserRound, Users } from "lucide-react";

const ICONS = {
  overview: LayoutDashboard,
  articles: FileText,
  instagram: Instagram,
  media: ImageIcon,
  sections: FolderTree,
  tags: Hash,
  authors: PenLine,
  brand: BadgeDollarSign,
  team: Users,
  profile: UserRound,
  settings: Settings,
} as const;

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: string;
}

export function AdminNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
      {items.map((n) => {
        const active = n.href === "/admin" ? path === "/admin" : path === n.href || path.startsWith(`${n.href}/`);
        const Icon = ICONS[n.icon];
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm whitespace-nowrap transition ${
              active ? "bg-white/[0.08] text-white" : "text-neutral-600 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            <Icon className={`h-4 w-4 transition ${active ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`} aria-hidden="true" />
            <span className="flex-1">{n.label}</span>
            {n.badge && <span className="rounded-full bg-white/[0.08] px-2 py-px text-[11px] text-neutral-700">{n.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
