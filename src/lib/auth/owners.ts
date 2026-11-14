/**
 * The two main admins (owners). They alone can manage Instagram and reset staff passwords,
 * and nobody (including each other) can change their role, access or password.
 * Override with OWNER_EMAILS (comma-separated) in the server environment.
 */
const DEFAULT_OWNERS = ["admin@zaber.tech", "admin@dhakachronicles.com"];

export function ownerEmails(): string[] {
  const fromEnv = (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_OWNERS;
}

export function isOwner(email: string | null | undefined): boolean {
  return !!email && ownerEmails().includes(email.trim().toLowerCase());
}

/** Can `actor` change `target`'s role, access or password? Owners are untouchable, even by each other. */
export function canManageMember(actor: { id: string; email: string | null; isAdmin: boolean }, target: { id: string; email: string | null }): boolean {
  if (actor.id === target.id) return false;
  if (isOwner(target.email)) return false;
  return actor.isAdmin || isOwner(actor.email);
}
