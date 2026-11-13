import { afterEach, describe, expect, it } from "vitest";
import { assertCronAuth } from "@/lib/http";
import { supabaseConfig } from "@/lib/env";
import { toActionError } from "@/lib/errors";

const ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("cron endpoint authentication", () => {
  it("accepts only the exact bearer secret", () => {
    process.env.CRON_SECRET = "a-very-long-cron-secret-value";
    const req = (auth?: string) => new Request("https://x/api/cron/publish", { method: "POST", headers: auth ? { authorization: auth } : {} });
    expect(() => assertCronAuth(req("Bearer a-very-long-cron-secret-value"))).not.toThrow();
    expect(() => assertCronAuth(req("Bearer wrong"))).toThrow(/Unauthorized/);
    expect(() => assertCronAuth(req())).toThrow(/Unauthorized/);
  });

  it("refuses to run when no secret is configured", () => {
    delete process.env.CRON_SECRET;
    expect(() => assertCronAuth(new Request("https://x", { headers: { authorization: "Bearer " } }))).toThrow(/not configured/);
  });
});

describe("configuration", () => {
  it("reads Supabase settings only from server-side variables", () => {
    delete process.env.SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public.example";
    expect(supabaseConfig()).toBeNull();
    process.env.SUPABASE_URL = "https://abc.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_x";
    expect(supabaseConfig()?.url).toBe("https://abc.supabase.co");
  });
});

describe("error mapping", () => {
  it("turns Postgres errors into safe messages", () => {
    expect(toActionError({ code: "23505", message: "duplicate key value violates unique constraint" }).error).toMatch(/duplicate/);
    expect(toActionError({ code: "42501", message: "rls" }).error).toMatch(/permission/);
  });
});
