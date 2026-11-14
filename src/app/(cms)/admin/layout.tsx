import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { requirePageSession, touchLastSeen } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/admin/avatar";
import { AdminNav, type NavItem } from "@/components/admin/admin-nav";
import { signOut } from "../login/actions";
import { KeepScroll } from "@/components/admin/keep-scroll";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();
  const supabase = await createClient();
  const role = session.profile.role;

  await touchLastSeen(session);

  const [{ count: unread }, { count: drafts }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", session.userId).is("read_at", null),
    supabase.from("articles").select("id", { count: "exact", head: true }).in("status", ["draft", "pending_review"]),
  ]);

  const items: NavItem[] = [
    { href: "/admin", label: "Overview", icon: "overview" },
    { href: "/admin/articles", label: "Articles", icon: "articles", badge: drafts ? String(drafts) : undefined },
    ...(can(role, "instagram.view") ? [{ href: "/admin/instagram", label: "Instagram", icon: "instagram" as const }] : []),
    ...(can(role, "media.upload") ? [{ href: "/admin/media", label: "Media", icon: "media" as const }] : []),
    ...(can(role, "taxonomy.manage") ? [{ href: "/admin/categories", label: "Sections", icon: "sections" as const }, { href: "/admin/tags", label: "Tags", icon: "tags" as const }] : []),
    ...(can(role, "authors.manage") ? [{ href: "/admin/authors", label: "Authors", icon: "authors" as const }] : []),
    ...(can(role, "brand_deals.manage") ? [
          { href: "/admin/brand-deals", label: "Brand deals", icon: "brand" as const },
          { href: "/admin/ads", label: "Ads", icon: "ads" as const },
        ] : []),
    ...(can(role, "team.manage") ? [{ href: "/admin/people", label: "Team page", icon: "people" as const }] : []),
    { href: "/admin/team", label: "Staff", icon: "team" },
    { href: "/admin/profile", label: "Profile", icon: "profile" },
    ...(can(role, "settings.manage") ? [{ href: "/admin/settings", label: "Settings", icon: "settings" as const }] : []),
  ];
  const name = session.profile.full_name || session.email || "Staff";

  return (
    <div className="flex min-h-screen flex-col bg-black text-white md:flex-row">
      <aside className="sticky top-0 z-30 border-b border-white/5 bg-[#030303]/90 backdrop-blur-xl md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 md:block md:pb-5">
          <Link href="/admin" aria-label="Dhaka Chronicles newsroom" className="block transition-opacity duration-300 hover:opacity-85">
            <Logo height={34} priority />
            <span className="mt-2 hidden text-[11px] tracking-[0.2em] text-muted uppercase md:block">Newsroom</span>
          </Link>
          <div className="flex items-center gap-2 md:hidden">
            {can(role, "article.create") && (
              <Link href="/admin/articles/new" aria-label="New article" className="grid h-10 w-10 place-items-center rounded-full bg-white text-black">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </Link>
            )}
            <Link href="/admin" aria-label={`${unread ?? 0} unread notifications`} className="relative grid h-10 w-10 place-items-center rounded-full border border-line">
              <BellIcon />
              {unread ? <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-white" /> : null}
            </Link>
            <Link href="/admin/profile" aria-label="Your profile" className="rounded-full">
              <Avatar name={name} url={session.profile.avatar_url} size={40} />
            </Link>
          </div>
        </div>
        {can(role, "article.create") && (
          <Link href="/admin/articles/new" className="mx-4 mb-4 hidden h-10 items-center justify-center rounded-full bg-white text-sm font-medium text-black transition hover:bg-neutral-800 md:flex">
            + New article
          </Link>
        )}
        <AdminNav items={items} />
        <div className="mt-auto hidden space-y-3 p-4 md:block">
          <Link href="/admin/profile" className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/5">
            <Avatar name={name} url={session.profile.avatar_url} size={36} />
            <span className="min-w-0 text-[13px] leading-tight">
              <span className="block truncate">{name}</span>
              <span className="text-xs text-muted capitalize">{role}</span>
            </span>
          </Link>
          <div className="flex gap-2">
            <Link href="/en" target="_blank" className="btn h-9 flex-1 text-xs">
              View site ↗
            </Link>
            <form action={signOut}>
              <button className="btn h-9 text-xs">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-9 md:py-8">{children}</main>
      <KeepScroll />
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
