import Link from "next/link";
import { requirePageSession } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

const NAV: { href: string; label: string; perm?: Permission }[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/articles", label: "Articles" },
  { href: "/admin/media", label: "Media", perm: "media.upload" },
  { href: "/admin/categories", label: "Categories", perm: "taxonomy.manage" },
  { href: "/admin/tags", label: "Tags", perm: "taxonomy.manage" },
  { href: "/admin/authors", label: "Authors", perm: "authors.manage" },
  { href: "/admin/instagram", label: "Instagram", perm: "instagram.view" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/settings", label: "Settings", perm: "settings.manage" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();
  const supabase = await createClient();
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.userId)
    .is("read_at", null);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-neutral-200 bg-white md:w-56 md:border-r md:border-b-0">
        <div className="p-4">
          <Link href="/admin" className="font-semibold">
            Dhaka Chronicles
          </Link>
          <p className="mt-1 text-xs text-neutral-500">
            {session.profile.full_name || session.email} · {session.profile.role}
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col">
          {NAV.filter((n) => !n.perm || can(session.profile.role, n.perm)).map((n) => (
            <Link key={n.href} href={n.href} className="rounded px-3 py-1.5 text-sm whitespace-nowrap hover:bg-neutral-100">
              {n.label}
              {n.href === "/admin" && unread ? <span className="badge ml-2 bg-red-600 text-white">{unread}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="flex gap-2 p-4">
          <Link href="/bn" className="btn" target="_blank">
            View site
          </Link>
          <form action={signOut}>
            <button className="btn">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
