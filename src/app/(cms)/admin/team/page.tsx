import { requirePageSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { Flash, PageHeader, fmt, timeAgo } from "@/components/admin/ui";
import { Avatar } from "@/components/admin/avatar";
import { inviteUserAction, updateMemberAction } from "../actions";
import { createMemberAction } from "../newsroom-actions";
import type { Profile } from "@/lib/db/types";

export const metadata = { title: "Team" };

const ROLE_STYLE: Record<string, string> = {
  admin: "bg-white text-black",
  editor: "border border-white/30 text-white",
  writer: "border border-white/15 text-neutral-700",
};

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const session = await requirePageSession();
  const isAdmin = can(session.profile.role, "team.manage");
  const supabase = await createClient();
  const [{ data }, { data: authored }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("articles").select("created_by, status").limit(10000),
  ]);
  const members = (data ?? []) as Profile[];
  const stats = new Map<string, { total: number; published: number }>();
  for (const a of (authored ?? []) as { created_by: string | null; status: string }[]) {
    if (!a.created_by) continue;
    const s = stats.get(a.created_by) ?? { total: 0, published: 0 };
    s.total++;
    if (a.status === "published") s.published++;
    stats.set(a.created_by, s);
  }

  return (
    <>
      <PageHeader title="Team">
        <span className="text-sm text-muted">{members.length} accounts · each with its own profile, photo and activity</span>
      </PageHeader>
      <Flash ok={sp.ok} error={sp.error} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((m) => {
          const s = stats.get(m.id) ?? { total: 0, published: 0 };
          const editable = isAdmin && m.id !== session.userId;
          return (
            <article key={m.id} className="card flex flex-col gap-4 transition hover:border-white/15">
              <div className="flex items-center gap-3.5">
                <Avatar name={m.full_name || "?"} url={m.avatar_url} size={56} />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.full_name || "Unnamed"}
                    {m.id === session.userId && <span className="ml-1.5 text-xs text-muted">(you)</span>}
                  </p>
                  <p className="text-xs text-muted">Joined {fmt(m.created_at).split(",")[0]}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className={`badge capitalize ${m.role ? ROLE_STYLE[m.role] : "border border-red-500/30 text-red-200"}`}>{m.role ?? "no access"}</span>
                <span className="text-muted tabular-nums">
                  {s.published} published · {s.total} total
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs text-subtle">
                <span>{m.last_seen_at ? `Active ${timeAgo(m.last_seen_at)}` : "Not signed in yet"}</span>
                <span>{m.is_active ? "Active" : "Disabled"}</span>
              </div>
              {editable && (
                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted hover:text-white">Change role or access</summary>
                  <form action={updateMemberAction.bind(null, m.id)} className="mt-3 flex flex-wrap items-center gap-2">
                    <select name="role" defaultValue={m.role ?? "none"} className="input h-9 w-auto">
                      <option value="none">No access</option>
                      <option value="writer">Writer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" name="is_active" defaultChecked={m.is_active} className="accent-white" /> Active
                    </label>
                    <button className="btn h-9 text-xs">Update</button>
                  </form>
                </details>
              )}
            </article>
          );
        })}
      </section>

      {isAdmin && (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <form action={createMemberAction} className="card flex flex-col gap-4">
            <div>
              <h2 className="text-[15px] font-medium">Create an account</h2>
              <p className="mt-1 text-[13px] text-muted">Set a starting password and share it privately. They can change it on their profile.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" name="full_name" placeholder="Name" />
              <Field label="Email" name="email" type="email" placeholder="name@dhakachronicles.com" />
              <Field label="Starting password" name="password" type="password" placeholder="At least 10 characters" autoComplete="new-password" />
              <RoleSelect />
            </div>
            <button className="btn btn-primary self-start">Create account</button>
          </form>
          <form action={inviteUserAction} className="card flex flex-col gap-4">
            <div>
              <h2 className="text-[15px] font-medium">Invite by email</h2>
              <p className="mt-1 text-[13px] text-muted">Supabase emails a link so they set their own password. Needs email delivery set up in Supabase.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" name="full_name" placeholder="Name" />
              <Field label="Email" name="email" type="email" placeholder="name@dhakachronicles.com" />
              <RoleSelect />
            </div>
            <button className="btn self-start">Send invitation</button>
          </form>
        </section>
      )}
    </>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-[13px] text-neutral-600">
      {label}
      <input required className="input mt-1.5" {...props} />
    </label>
  );
}

function RoleSelect() {
  return (
    <label className="block text-[13px] text-neutral-600">
      Role
      <select name="role" className="input mt-1.5" defaultValue="writer">
        <option value="writer">Writer · writes drafts</option>
        <option value="editor">Editor · publishes</option>
        <option value="admin">Admin · everything</option>
      </select>
    </label>
  );
}
