import { describe, expect, it } from "vitest";
import { getMediaInsights } from "@/lib/instagram/client";

const auth = { token: "t", appSecret: "s" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("getMediaInsights", () => {
  it("reads each metric, accepting both values[] and total_value shapes", async () => {
    const f = (async (url: string) => {
      const metric = new URL(url).searchParams.get("metric")!;
      if (metric === "views") return json(200, { data: [{ name: "views", total_value: { value: 1234 } }] });
      if (metric === "shares") return json(400, { error: { message: "Unsupported metric", code: 100 } });
      return json(200, { data: [{ name: metric, values: [{ value: 7 }] }] });
    }) as typeof fetch;
    const r = await getMediaInsights(auth, "1234567890", f);
    expect(r.values).toEqual({ views: 1234, reach: 7, saved: 7, total_interactions: 7 });
    expect(r.missingPermission).toBe(false);
  });

  it("flags a missing insights permission when nothing comes back", async () => {
    const f = (async () => json(403, { error: { message: "(#10) Application does not have permission", code: 10 } })) as typeof fetch;
    const r = await getMediaInsights(auth, "1234567890", f);
    expect(r.values).toEqual({});
    expect(r.missingPermission).toBe(true);
  });

  it("rejects a malformed media id", async () => {
    await expect(getMediaInsights(auth, "../me")).rejects.toThrow("Invalid Instagram media id.");
  });
});
