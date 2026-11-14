/**
 * Session cookie naming. Safe to import from the proxy (no server-only dependencies).
 *
 * The auth library's default cookie name embeds the backend project id
 * ("sb-<project>-auth-token"), which tells every visitor which provider and project
 * sits behind the site. We use our own name instead.
 */
export const SESSION_COOKIE = "dc-session";

/** Shown when the backend connection has not been configured on the server. */
export const NOT_SET_UP = "The newsroom is not set up yet. Please contact the site administrator.";

/** Lifetime the auth library gives its cookies (400 days, the browser maximum). */
export const SESSION_MAX_AGE = 400 * 24 * 60 * 60;

type Cookie = { name: string; value: string };

const LEGACY = /^sb-.+-auth-token(\.\d+)?$/;

function isCurrent(name: string): boolean {
  return name === SESSION_COOKIE || name.startsWith(`${SESSION_COOKIE}.`);
}

/** Cookies left over from before the rename, paired with the name they should have now. */
export function legacySessionCookies(cookies: Cookie[]): { from: string; to: string; value: string }[] {
  return cookies.flatMap((c) => {
    const m = LEGACY.exec(c.name);
    return m ? [{ from: c.name, to: `${SESSION_COOKIE}${m[1] ?? ""}`, value: c.value }] : [];
  });
}

/**
 * The cookie list the auth client should read. Staff who signed in before the rename still
 * carry the old cookie; until the proxy rewrites it, read it under the new name so nobody is
 * signed out by the change.
 */
export function withLegacySession<T extends Cookie>(cookies: T[]): Cookie[] {
  if (cookies.some((c) => isCurrent(c.name))) return cookies;
  const legacy = legacySessionCookies(cookies);
  if (!legacy.length) return cookies;
  return [...cookies, ...legacy.map((l) => ({ name: l.to, value: l.value }))];
}

/** True when a current-name session cookie is already present. */
export function hasCurrentSession(cookies: Cookie[]): boolean {
  return cookies.some((c) => isCurrent(c.name));
}
