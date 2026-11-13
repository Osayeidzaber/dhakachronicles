export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  NOT_CONFIGURED: 503,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    message: string,
    public readonly code: ErrorCode = "INTERNAL",
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Turn any thrown value (AppError, Postgres error from Supabase, Error) into a safe message. */
export function toActionError(err: unknown): { ok: false; error: string } {
  if (err instanceof AppError) return { ok: false, error: err.message };
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; message?: unknown; hint?: unknown };
    if (e.code === "23505") return { ok: false, error: "That value is already in use (duplicate)." };
    if (e.code === "42501") return { ok: false, error: "You do not have permission to do that." };
    if (e.hint === "MEDIA_IN_USE") return { ok: false, error: "This media is used by a published article." };
    if (typeof e.message === "string") return { ok: false, error: e.message };
  }
  return { ok: false, error: "Unexpected error" };
}

export function httpStatus(err: unknown): number {
  return err instanceof AppError ? err.status : 500;
}

/** Throw if a Supabase response carried an error. */
export function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}
