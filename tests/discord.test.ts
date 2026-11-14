import { describe, expect, it } from "vitest";
import { actionColor, actionLabel, activityEmbed, articleEmbed, COLORS } from "@/lib/discord-embed";

const NOW = new Date("2026-11-14T10:00:00Z");

describe("article log embeds", () => {
  it("builds a published embed with edition, author and link", () => {
    const e = articleEmbed({ kind: "published", title: "Kadamtali", url: "https://x/en/news/k", language: "en", actor: "Rahim", excerpt: "Short." }, NOW);
    expect(e.color).toBe(COLORS.published);
    expect(e.author?.name).toContain("Published");
    expect(e.fields?.map((f) => f.name)).toEqual(["Status", "Origin", "Edition", "By"]);
    expect(e.timestamp).toBe(NOW.toISOString());
  });

  it("shows the Dhaka time for scheduled stories and an Instagram source link", () => {
    const e = articleEmbed({ kind: "scheduled", title: "T", scheduledFor: "2026-11-15T03:00:00Z", sourceUrl: "https://instagram.com/p/x" }, NOW);
    expect(e.fields?.find((f) => f.name === "Goes live")?.value).toMatch(/9:00|09:00/);
    expect(e.fields?.find((f) => f.name === "Links")?.value).toBe("[Instagram post](https://instagram.com/p/x)");
  });

  it("respects Discord length limits", () => {
    const e = articleEmbed({ kind: "submitted", title: "a".repeat(400), excerpt: "b".repeat(2000) }, NOW);
    expect(e.title.length).toBeLessThanOrEqual(256);
    expect(e.description!.length).toBeLessThanOrEqual(600);
  });
});

describe("activity log embeds", () => {
  it("labels known and unknown actions", () => {
    expect(actionLabel("team.invite")).toBe("Invited a team member");
    expect(actionLabel("widget.reset_all")).toBe("Reset all widget");
  });

  it("colours destructive actions red", () => {
    expect(actionColor("article.delete")).toBe(COLORS.removed);
    expect(actionColor("article.publish")).toBe(COLORS.published);
  });

  it("never leaks secrets or emails from metadata", () => {
    const e = activityEmbed(
      { action: "team.invite", actor: "Admin", targetType: "user", targetId: "12345678-aaaa", metadata: { email: "a@b.c", role: "writer", token: "x", webhook_url: "u", nested: { a: 1 } } },
      NOW,
    );
    const text = JSON.stringify(e);
    expect(text).not.toContain("a@b.c");
    expect(text).not.toContain('"x"');
    expect(e.fields?.map((f) => f.name)).toEqual(["Role", "Target"]);
    expect(e.author?.name).toBe("Admin");
  });
});

describe("links and alerts", () => {
  it("links every article embed to the site, the newsroom and Instagram", async () => {
    const { articleEmbed } = await import("@/lib/discord-embed");
    const e = articleEmbed({ kind: "published", title: "T", siteUrl: "https://dc/en/news/t", adminUrl: "https://dc/admin/articles/1", sourceUrl: "https://instagram.com/p/x" }, NOW);
    expect(e.fields?.find((f) => f.name === "Links")?.value).toBe("[Read on site](https://dc/en/news/t) · [Open in newsroom](https://dc/admin/articles/1) · [Instagram post](https://instagram.com/p/x)");
  });

  it("builds a critical alert without leaking secrets", async () => {
    const { alertEmbed } = await import("@/lib/discord-embed");
    const e = alertEmbed({ title: "Instagram token expired", severity: "critical", source: "instagram.sync", fields: { Trigger: "cron", token: "abc" } }, NOW);
    expect(e.color).toBe(COLORS.removed);
    expect(e.fields?.map((f) => f.name)).toEqual(["Trigger"]);
    expect(e.footer.text).toBe("Alerts · instagram.sync");
  });
});

describe("activity log noise filter", () => {
  it("skips duplicates and empty syncs, and throttles autosave edits", async () => {
    const { shouldMirrorToDiscord } = await import("@/lib/discord-embed");
    const seen = new Map<string, number>();
    expect(shouldMirrorToDiscord("instagram.imported", "a", {}, 0, seen)).toBe(false);
    expect(shouldMirrorToDiscord("instagram.sync_run", "r", { imported: 0, failed: 0 }, 0, seen)).toBe(false);
    expect(shouldMirrorToDiscord("instagram.sync_run", "r", { imported: 3, failed: 0 }, 0, seen)).toBe(true);
    expect(shouldMirrorToDiscord("article.update", "x", {}, 1_000, seen)).toBe(true);
    expect(shouldMirrorToDiscord("article.update", "x", {}, 60_000, seen)).toBe(false);
    expect(shouldMirrorToDiscord("article.update", "x", {}, 31 * 60_000 + 1_000, seen)).toBe(true);
    expect(shouldMirrorToDiscord("team.invite", "u", {}, 0, seen)).toBe(true);
  });
});
