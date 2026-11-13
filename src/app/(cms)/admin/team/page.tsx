import { requirePageSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { Flash, PageHeader, fmt } from "@/components/admin/ui";
import { inviteUserAction, updateMemberAction, updateOwnProfileAction } from "../actions";
import type { Profile } from "@/lib/db/types";

export const metadata = { title: "Team" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const session = await requirePageSession();
  const isAdmin = can(session.profile.role, "team.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("created_at");
  const members = (data ?? []) as Profile[];

  return (
    <>
      <PageHeader title="Team" />
      <Flash ok={sp.ok} error={sp.error} />

      <form action={updateOwnProfileAction} className="card mb-6 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Your display name
          <input name="full_name" defaultValue={session.profile.full_name} required className="input mt-1" />
        </label>
        <button className="btn">Save</button>
      </form>

      {isAdmin && (
        <form action={inviteUserAction} className="card mb-6 space-y-2">
          <h2 className="font-semibold">Invite a team member</h2>
          <p className="text-xs text-neutral-500">They receive an email from Supabase Auth to set their own password. There is no public sign-up.</p>
          <div className="grid gap-2 md:grid-cols-4">
            <input name="full_name" placeholder="Full name" required className="input" />
            <input name="email" type="email" placeholder="Email" required className="input" />
            <select name="role" className="input" defaultValue="writer">
              <option value="writer">Writer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <button className="btn btn-primary">Send invitation</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Active</th>
              <th>Joined</th>
              {isAdmin && <th />}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.full_name || "—"}
                  {m.id === session.userId && <span className="ml-1 text-xs text-neutral-500">(you)</span>}
                </td>
                {isAdmin && m.id !== session.userId ? (
                  <td colSpan={4}>
                    <form action={updateMemberAction.bind(null, m.id)} className="flex flex-wrap items-center gap-2">
                      <select name="role" defaultValue={m.role ?? "none"} className="input w-auto">
                        <option value="none">No access</option>
                        <option value="writer">Writer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <label className="flex items-center gap-1 text-sm">
                        <input type="checkbox" name="is_active" defaultChecked={m.is_active} /> Active
                      </label>
                      <span className="text-xs text-neutral-500">{fmt(m.created_at)}</span>
                      <button className="btn">Update</button>
                    </form>
                  </td>
                ) : (
                  <>
                    <td>{m.role ?? "no access"}</td>
                    <td>{m.is_active ? "Yes" : "No"}</td>
                    <td>{fmt(m.created_at)}</td>
                    {isAdmin && <td />}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
