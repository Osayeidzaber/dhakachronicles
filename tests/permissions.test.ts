import { describe, expect, it } from "vitest";
import { allowedTargetStatuses, can, canAssignRole, canEditArticle, canTransition } from "@/lib/auth/permissions";
import { planTransition } from "@/lib/articles/workflow";
import { AppError } from "@/lib/errors";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("role permissions", () => {
  it("admins can do everything", () => {
    for (const p of ["article.publish", "team.manage", "settings.manage", "instagram.manage", "article.delete"] as const) {
      expect(can("admin", p)).toBe(true);
    }
  });

  it("editors publish and manage taxonomy but not team, settings or deletes", () => {
    expect(can("editor", "article.publish")).toBe(true);
    expect(can("editor", "taxonomy.manage")).toBe(true);
    expect(can("editor", "authors.manage")).toBe(true);
    expect(can("editor", "team.manage")).toBe(false);
    expect(can("editor", "settings.manage")).toBe(false);
    expect(can("editor", "article.delete")).toBe(false);
  });

  it("writers create but cannot publish", () => {
    expect(can("writer", "article.create")).toBe(true);
    expect(can("writer", "article.publish")).toBe(false);
    expect(allowedTargetStatuses("writer")).toEqual(["draft", "pending_review"]);
  });

  it("users without a role have no permissions", () => {
    expect(can(null, "article.create")).toBe(false);
    expect(allowedTargetStatuses(null)).toEqual([]);
  });

  it("writers edit only their own drafts / pending articles", () => {
    expect(canEditArticle("writer", ME, { created_by: ME, status: "draft" })).toBe(true);
    expect(canEditArticle("writer", ME, { created_by: ME, status: "pending_review" })).toBe(true);
    expect(canEditArticle("writer", ME, { created_by: ME, status: "published" })).toBe(false);
    expect(canEditArticle("writer", ME, { created_by: OTHER, status: "draft" })).toBe(false);
    expect(canEditArticle("editor", ME, { created_by: OTHER, status: "published" })).toBe(true);
  });

  it("nobody can assign their own role; only admins assign roles", () => {
    expect(canAssignRole("admin", ME, ME)).toBe(false);
    expect(canAssignRole("admin", ME, OTHER)).toBe(true);
    expect(canAssignRole("editor", ME, OTHER)).toBe(false);
  });
});

describe("editorial workflow", () => {
  const now = new Date("2026-11-13T10:00:00Z");

  it("writer submits a draft for review", () => {
    expect(planTransition("draft", { action: "submit" }, "writer", ME, now).status).toBe("pending_review");
  });

  it("writer cannot publish or schedule", () => {
    expect(() => planTransition("draft", { action: "publish" }, "writer", ME, now)).toThrow(AppError);
    expect(() => planTransition("draft", { action: "schedule", scheduled_at: "2026-11-14T10:00:00Z" }, "writer", ME, now)).toThrow(AppError);
  });

  it("editor publishes immediately and records reviewer and time", () => {
    const plan = planTransition("pending_review", { action: "publish" }, "editor", ME, now);
    expect(plan.status).toBe("published");
    expect(plan.patch.reviewed_by).toBe(ME);
    expect(plan.patch.published_at).toBe(now.toISOString());
  });

  it("approve moves pending review back to a reviewed draft", () => {
    const plan = planTransition("pending_review", { action: "approve" }, "editor", ME, now);
    expect(plan.status).toBe("draft");
    expect(plan.patch.reviewed_by).toBe(ME);
    expect(() => planTransition("draft", { action: "approve" }, "editor", ME, now)).toThrow();
  });

  it("scheduling requires a future time", () => {
    expect(planTransition("draft", { action: "schedule", scheduled_at: "2026-11-13T12:00:00Z" }, "editor", ME, now).patch.scheduled_at).toBe("2026-11-13T12:00:00.000Z");
    expect(() => planTransition("draft", { action: "schedule", scheduled_at: "2026-11-13T09:00:00Z" }, "editor", ME, now)).toThrow(/future/);
  });

  it("unpublish clears the live date; archive and restore work", () => {
    const un = planTransition("published", { action: "unpublish" }, "editor", ME, now);
    expect(un.status).toBe("draft");
    expect(un.patch.published_at).toBeNull();
    expect(planTransition("published", { action: "archive" }, "admin", ME, now).status).toBe("archived");
    expect(planTransition("archived", { action: "restore" }, "admin", ME, now).status).toBe("draft");
    expect(() => planTransition("draft", { action: "restore" }, "admin", ME, now)).toThrow();
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("archived", "published")).toBe(false);
    expect(() => planTransition("archived", { action: "publish" }, "admin", ME, now)).toThrow();
  });
});

describe("main admins (owners)", () => {
  it("recognises the two owners case-insensitively", async () => {
    const { isOwner } = await import("@/lib/auth/owners");
    expect(isOwner("Admin@Zaber.tech")).toBe(true);
    expect(isOwner("admin@dhakachronicles.com")).toBe(true);
    expect(isOwner("editor@dhakachronicles.com")).toBe(false);
    expect(isOwner(null)).toBe(false);
  });

  it("protects owners from everyone, including each other", async () => {
    const { canManageMember } = await import("@/lib/auth/owners");
    const ownerA = { id: "a", email: "admin@zaber.tech", isAdmin: true };
    const ownerB = { id: "b", email: "admin@dhakachronicles.com" };
    const admin = { id: "c", email: "chief@dhakachronicles.com", isAdmin: true };
    const writer = { id: "d", email: "writer@dhakachronicles.com" };
    expect(canManageMember(ownerA, ownerB)).toBe(false);
    expect(canManageMember(admin, ownerB)).toBe(false);
    expect(canManageMember(ownerA, writer)).toBe(true);
    expect(canManageMember(admin, writer)).toBe(true);
    expect(canManageMember({ ...writer, isAdmin: false }, { id: "e", email: "x@y.z" })).toBe(false);
    expect(canManageMember(ownerA, { id: "a", email: "admin@zaber.tech" })).toBe(false);
  });
});
