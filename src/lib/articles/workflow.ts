import type { AppRole, ArticleStatus } from "@/lib/db/types";
import { allowedTargetStatuses, canTransition } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import type { TransitionInput } from "@/lib/articles/validation";

export interface TransitionPlan {
  status: ArticleStatus;
  patch: Record<string, unknown>;
  auditAction: string;
}

/**
 * Pure editorial state machine: decides the next status and the column changes
 * for a workflow action, or throws if the role/state doesn't allow it.
 */
export function planTransition(
  current: ArticleStatus,
  input: TransitionInput,
  role: AppRole | null,
  userId: string,
  now: Date = new Date(),
): TransitionPlan {
  let status: ArticleStatus;
  const patch: Record<string, unknown> = {};

  switch (input.action) {
    case "submit":
      status = "pending_review";
      break;
    case "approve":
      // Approval moves a reviewed piece back to draft-ready state, marked reviewed.
      if (current !== "pending_review") throw new AppError("Only articles pending review can be approved.", "VALIDATION");
      status = "draft";
      patch.reviewed_by = userId;
      break;
    case "publish":
      status = "published";
      patch.reviewed_by = userId;
      if (current !== "published") patch.published_at = now.toISOString();
      break;
    case "schedule": {
      const when = new Date(input.scheduled_at);
      if (when.getTime() <= now.getTime() + 30_000) {
        throw new AppError("Scheduled time must be in the future.", "VALIDATION");
      }
      status = "scheduled";
      patch.scheduled_at = when.toISOString();
      patch.reviewed_by = userId;
      break;
    }
    case "unpublish":
      if (current !== "published" && current !== "scheduled") {
        throw new AppError("Only published or scheduled articles can be unpublished.", "VALIDATION");
      }
      status = "draft";
      patch.scheduled_at = null;
      break;
    case "archive":
      status = "archived";
      break;
    case "restore":
      if (current !== "archived") throw new AppError("Only archived articles can be restored.", "VALIDATION");
      status = "draft";
      break;
    case "return_to_draft":
      status = "draft";
      patch.scheduled_at = null;
      break;
  }

  if (!allowedTargetStatuses(role).includes(status)) {
    throw new AppError("Your role cannot move an article to this status.", "FORBIDDEN");
  }
  if (!canTransition(current, status)) {
    throw new AppError(`Cannot move an article from ${current} to ${status}.`, "VALIDATION");
  }
  if (status !== "published" && current === "published") {
    // Unpublishing keeps first_published_at but clears the live date.
    patch.published_at = null;
  }
  return { status, patch: { ...patch, status }, auditAction: `article.${input.action}` };
}
