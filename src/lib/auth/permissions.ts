import type { AppRole, ArticleStatus } from "@/lib/db/types";

/**
 * Application-level permission matrix. Mirrors the RLS policies in
 * supabase/migrations/…02_rls_policies.sql (defence in depth: both must allow).
 */
export type Permission =
  | "article.create"
  | "article.edit_any"
  | "article.publish"
  | "article.delete"
  | "taxonomy.manage"
  | "authors.manage"
  | "media.upload"
  | "media.manage_any"
  | "instagram.view"
  | "instagram.manage"
  | "team.manage"
  | "settings.manage"
  | "audit.view"
  | "brand_deals.manage";

const MATRIX: Record<AppRole, readonly Permission[]> = {
  admin: [
    "article.create",
    "article.edit_any",
    "article.publish",
    "article.delete",
    "taxonomy.manage",
    "authors.manage",
    "media.upload",
    "media.manage_any",
    "instagram.view",
    "instagram.manage",
    "team.manage",
    "settings.manage",
    "audit.view",
    "brand_deals.manage",
  ],
  editor: [
    "article.create",
    "article.edit_any",
    "article.publish",
    "taxonomy.manage",
    "authors.manage",
    "media.upload",
    "media.manage_any",
    "instagram.view",
    "brand_deals.manage",
  ],
  writer: ["article.create", "media.upload"],
};

export function can(role: AppRole | null | undefined, permission: Permission): boolean {
  return !!role && MATRIX[role].includes(permission);
}

/** Can this user edit this particular article? */
export function canEditArticle(
  role: AppRole | null | undefined,
  userId: string,
  article: { created_by: string | null; status: ArticleStatus },
): boolean {
  if (can(role, "article.edit_any")) return true;
  return role === "writer" && article.created_by === userId && ["draft", "pending_review"].includes(article.status);
}

/** Statuses a role may move an article into. */
export function allowedTargetStatuses(role: AppRole | null | undefined): ArticleStatus[] {
  if (can(role, "article.publish")) return ["draft", "pending_review", "scheduled", "published", "archived"];
  if (role === "writer") return ["draft", "pending_review"];
  return [];
}

/** Valid editorial transitions (independent of role). */
const TRANSITIONS: Record<ArticleStatus, readonly ArticleStatus[]> = {
  draft: ["pending_review", "scheduled", "published", "archived"],
  pending_review: ["draft", "scheduled", "published", "archived"],
  scheduled: ["draft", "published", "archived"],
  published: ["draft", "archived"],
  archived: ["draft"],
};

export function canTransition(from: ArticleStatus, to: ArticleStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/** Roles an admin may assign. Nobody can assign roles to themselves. */
export function canAssignRole(actorRole: AppRole | null, actorId: string, targetId: string): boolean {
  return actorRole === "admin" && actorId !== targetId;
}
