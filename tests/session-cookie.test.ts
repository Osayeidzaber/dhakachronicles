import { describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { SESSION_COOKIE, hasCurrentSession, legacySessionCookies, withLegacySession } from "@/lib/supabase/session-cookie";
import { AppError, publicMessage, toActionError } from "@/lib/errors";

describe("session cookie", () => {
  it("is written under our own name, never the provider's project-based name", async () => {
    const written: string[] = [];
    const session = {
      access_token: "a".repeat(40),
      refresh_token: "r".repeat(20),
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", email: "x@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    };
    const client = createServerClient("https://abcdefghijklmnopqrst.supabase.co", "sb_publishable_test", {
      cookieOptions: { name: SESSION_COOKIE },
      cookies: { getAll: () => [], setAll: (list) => void written.push(...list.map((c) => c.name)) },
      global: { fetch: async () => new Response(JSON.stringify(session), { status: 200, headers: { "content-type": "application/json" } }) },
    });
    const { error } = await client.auth.signInWithPassword({ email: "x@example.com", password: "irrelevant" });
    expect(error).toBeNull();
    expect(written.length).toBeGreaterThan(0);
    for (const name of written) {
      expect(name.startsWith(SESSION_COOKIE)).toBe(true);
      expect(name).not.toMatch(/^sb-|abcdefghijklmnopqrst|supabase/i);
    }
  });

  it("reads a pre-rename cookie under the new name, including chunks", () => {
    const old = [
      { name: "sb-abcdefghijklmnopqrst-auth-token.0", value: "part0" },
      { name: "sb-abcdefghijklmnopqrst-auth-token.1", value: "part1" },
      { name: "theme", value: "dark" },
    ];
    expect(legacySessionCookies(old).map((c) => c.to)).toEqual([`${SESSION_COOKIE}.0`, `${SESSION_COOKIE}.1`]);
    const seen = withLegacySession(old);
    expect(seen).toContainEqual({ name: `${SESSION_COOKIE}.0`, value: "part0" });
    expect(seen).toContainEqual({ name: `${SESSION_COOKIE}.1`, value: "part1" });
    expect(hasCurrentSession(old)).toBe(false);
  });

  it("prefers the new cookie once it exists and ignores unrelated cookies", () => {
    const both = [
      { name: SESSION_COOKIE, value: "new" },
      { name: "sb-abcdefghijklmnopqrst-auth-token", value: "stale" },
    ];
    expect(withLegacySession(both)).toBe(both);
    expect(hasCurrentSession(both)).toBe(true);
    const none = [{ name: "sb-something-else", value: "x" }];
    expect(withLegacySession(none)).toBe(none);
    expect(legacySessionCookies(none)).toEqual([]);
  });
});

describe("messages shown to people", () => {
  it("never passes database wording through", () => {
    const raw = { code: "42P01", message: 'relation "public.brand_deals" does not exist', details: null, hint: null };
    expect(publicMessage(raw)).not.toMatch(/relation|brand_deals|public\./);
    const rls = { code: "42501", message: 'new row violates row-level security policy for table "articles"', details: null, hint: null };
    expect(publicMessage(rls)).toBe("You do not have permission to do that.");
    const fk = { code: "23503", message: 'update or delete on table "categories" violates foreign key constraint "articles_category_id_fkey"', details: "x", hint: null };
    expect(publicMessage(fk)).not.toMatch(/categories|fkey|constraint/);
    const uuid = { code: "22P02", message: 'invalid input syntax for type uuid: "abc"', details: null, hint: null };
    expect(publicMessage(uuid)).not.toMatch(/uuid|syntax/);
    const range = { code: "PGRST103", message: "Requested range not satisfiable", details: "An offset of 9000 was requested", hint: null };
    expect(publicMessage(range)).not.toMatch(/range|offset/i);
  });

  it("translates sign-in service errors and hides unknown ones", () => {
    const weak = Object.assign(new Error("Password is known to be weak and easy to guess"), { __isAuthError: true, name: "AuthWeakPasswordError", status: 422, code: "weak_password" });
    expect(publicMessage(weak)).toMatch(/too easy to guess/);
    const exists = Object.assign(new Error("A user with this email address has already been registered"), { __isAuthError: true, name: "AuthApiError", status: 422, code: "email_exists" });
    expect(publicMessage(exists)).toMatch(/already exists/);
    const odd = Object.assign(new Error("Database error saving new user"), { __isAuthError: true, name: "AuthApiError", status: 500, code: "unexpected_failure" });
    expect(publicMessage(odd)).not.toMatch(/database/i);
  });

  it("keeps our own messages and the media-in-use hint", () => {
    expect(publicMessage(new AppError("Only admins can delete deals.", "FORBIDDEN"))).toBe("Only admins can delete deals.");
    expect(toActionError({ hint: "MEDIA_IN_USE", code: "P0001", message: "media x is referenced" }).error).toMatch(/used by a published/);
    expect(publicMessage(new Error("Missing code or state."))).toBe("Missing code or state.");
    expect(publicMessage(null)).toMatch(/try again/i);
  });
});
