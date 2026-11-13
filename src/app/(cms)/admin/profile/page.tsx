import Link from "next/link";
import { requirePageSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { describeActivity } from "@/lib/analytics";
import { Flash, fmt, timeAgo } from "@/components/admin/ui";
import { AvatarUploader } from "@/components/admin/avatar-uploader";
import { changePasswordAction, updateProfileAction } from "../newsroom-actions";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const session = await requirePageSession();
  const supabase = await createClient();
  const p = session.profile;

  const [{ data: logs }, { data: mine }, { data: author }] = await Promise.all([
    supabase.from("audit_logs").select("id, action, target_type, target_id, metadata, created_at").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(40),
    supabase.from("articles").select("id, status").eq("created_by", session.userId).limit(5000),
    supabase.from("authors").select("slug").eq("profile_id", session.userId).maybeSingle(),
  ]);
  const articles = (mine ?? []) as { id: string; status: string }[];
  const published = articles.filter((a) => a.status === "published");
  let views = 0;
  if (published.length) {
    const { data: v } = await supabase.from("article_daily_views").select("views").in("article_id", published.map((a) => a.id).slice(0, 500));
    views = ((v ?? []) as { views: number }[]).reduce((s, r) => s + r.views, 0);
  }
  const name = p.full_name || session.email || "You";

  return (
    <>
      <div className="hairline-grid -mx-4 -mt-6 h-40 border-b border-white/5 md:-mx-9 md:-mt-8" aria-hidden="true" />
      <div className="reveal -mt-14 flex flex-wrap items-end gap-6">
        <AvatarUploader name={name} url={p.avatar_url} />
        <div className="min-w-60 flex-1 pb-2">
          <h1 className="font-display text-[clamp(2.2rem,4vw,3.2rem)] leading-none">{name}</h1>
          <p className="mt-2 text-sm text-muted">
            <span className="capitalize">{p.role}</span> · {session.email} · Joined {fmt(p.created_at).split(",")[0]}
          </p>
        </div>
        {author?.slug && (
          <Link href={`/en/author/${author.slug}`} target="_blank" className="btn mb-2">
            Public author page ↗
          </Link>
        )}
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Articles", articles.length],
          ["Published", published.length],
          ["Total views", views],
          ["Actions logged", (logs ?? []).length >= 40 ? "40+" : (logs ?? []).length],
        ].map(([l, v]) => (
          <div key={String(l)} className="card">
            <div className="text-[13px] text-muted">{l}</div>
            <div className="mt-2.5 text-[32px] leading-none font-medium tracking-tight tabular-nums">{typeof v === "number" ? v.toLocaleString() : v}</div>
          </div>
        ))}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <form action={updateProfileAction} className="card flex flex-col gap-4">
            <h2 className="text-[15px] font-medium">Profile</h2>
            <label className="block text-[13px] text-neutral-600">
              Display name
              <input name="full_name" defaultValue={p.full_name} required maxLength={120} className="input mt-1.5" />
            </label>
            <p className="text-xs text-muted">Your bio and Bangla name appear on your author page; edit them under Authors.</p>
            <button className="btn btn-primary self-start">Save profile</button>
          </form>
          <form action={changePasswordAction} className="card flex flex-col gap-4">
            <h2 className="text-[15px] font-medium">Change password</h2>
            <label className="block text-[13px] text-neutral-600">
              New password
              <input name="password" type="password" required minLength={10} autoComplete="new-password" className="input mt-1.5" />
            </label>
            <label className="block text-[13px] text-neutral-600">
              Repeat it
              <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className="input mt-1.5" />
            </label>
            <button className="btn self-start">Update password</button>
          </form>
        </div>
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-medium">Activity</h2>
            <span className="text-xs text-muted">Everything this account did</span>
          </div>
          <ol className="mt-3">
            {(logs ?? []).length === 0 && <li className="py-8 text-sm text-muted">Nothing yet.</li>}
            {((logs ?? []) as { id: string; action: string; target_type: string; target_id: string | null; metadata: Record<string, unknown>; created_at: string }[]).map((l) => {
              const strong = /publish|create|invite|highlight/.test(l.action);
              const href = l.target_type === "article" && l.target_id && l.action !== "article.delete" ? `/admin/articles/${l.target_id}` : null;
              return (
                <li key={l.id} className="grid grid-cols-[18px_1fr_auto] items-start gap-3 border-t border-white/5 py-3">
                  <span className={`mt-1.5 h-2 w-2 rounded-full ${strong ? "bg-white" : "border border-white/50"}`} />
                  <span className="text-sm text-neutral-800">
                    {href ? (
                      <Link href={href} className="hover:underline">
                        {capitalize(describeActivity(l.action, l.metadata ?? {}))}
                      </Link>
                    ) : (
                      capitalize(describeActivity(l.action, l.metadata ?? {}))
                    )}
                  </span>
                  <span className="text-xs whitespace-nowrap text-muted" title={fmt(l.created_at)}>
                    {timeAgo(l.created_at)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
