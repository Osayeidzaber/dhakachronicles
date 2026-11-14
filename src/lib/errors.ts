import { log } from "@/lib/logger";

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

const GENERIC = "Something went wrong on our side. Please try again.";

/** Database error codes (SQLSTATE and the data API's own) mapped to plain, provider-neutral wording. */
const DB_MESSAGES: Record<string, string> = {
  "23505": "That value is already in use (duplicate).",
  "23503": "This item is still linked to other content, so it can't be changed or removed yet.",
  "23502": "A required field is missing.",
  "23514": "One of the values isn't allowed. Check the form and try again.",
  "22P02": "One of the values has the wrong format.",
  "22001": "One of the values is too long.",
  "42501": "You do not have permission to do that.",
  PGRST116: "That item could not be found, or you don't have access to it.",
  PGRST103: "There is nothing on that page.",
  PGRST301: "Your session has expired. Please sign in again.",
  PGRST302: "Your session has expired. Please sign in again.",
};

/** Sign-in service error codes mapped to our own wording. */
const AUTH_MESSAGES: Record<string, string> = {
  weak_password: "That password is too easy to guess. Choose a longer or less common one.",
  same_password: "Choose a password that is different from your current one.",
  email_exists: "An account with that email address already exists.",
  user_already_exists: "An account with that email address already exists.",
  email_address_invalid: "That email address doesn't look right.",
  email_address_not_authorized: "Invitations can't be sent to that email address.",
  over_email_send_rate_limit: "Too many emails were sent just now. Wait a few minutes and try again.",
  over_request_rate_limit: "Too many attempts. Wait a few minutes and try again.",
  user_not_found: "That account could not be found.",
  session_not_found: "Your session has expired. Please sign in again.",
  session_expired: "Your session has expired. Please sign in again.",
  invalid_credentials: "Invalid email or password.",
  user_banned: "That account has been disabled.",
};

type ProviderError = { code?: unknown; message?: unknown; hint?: unknown; details?: unknown; status?: unknown; name?: unknown; __isAuthError?: unknown };

function isAuthError(e: ProviderError): boolean {
  return e.__isAuthError === true || (typeof e.name === "string" && /^Auth[A-Z]/.test(e.name));
}

function isDatabaseError(e: ProviderError): boolean {
  if (typeof e.code === "string" && (/^[0-9A-Z]{5}$/.test(e.code) || /^PGRST/.test(e.code))) return true;
  return "details" in e && "hint" in e;
}

/**
 * The message that is safe to show a person. Our own AppError messages pass through; errors from the
 * database or the sign-in service are translated to our wording, so table names, constraint names and
 * provider details never reach the screen. The original is written to the server log.
 */
export function publicMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err && typeof err === "object") {
    const e = err as ProviderError;
    if (e.hint === "MEDIA_IN_USE") return "This media is used by a published article.";
    const auth = isAuthError(e);
    if (auth || isDatabaseError(e)) {
      const code = typeof e.code === "string" ? e.code : "";
      const known = auth ? AUTH_MESSAGES[code] : DB_MESSAGES[code];
      if (known) return known;
      log.warn("error.masked", { kind: auth ? "auth" : "database", code, message: typeof e.message === "string" ? e.message : undefined });
      return GENERIC;
    }
    if (err instanceof SyntaxError) return "The request could not be read.";
    if (typeof e.message === "string" && e.message) return e.message;
  }
  return GENERIC;
}

/** Turn any thrown value into a safe `{ ok: false, error }` result for actions and API routes. */
export function toActionError(err: unknown): { ok: false; error: string } {
  return { ok: false, error: publicMessage(err) };
}

export function httpStatus(err: unknown): number {
  return err instanceof AppError ? err.status : 500;
}

/** Throw if a data-layer response carried an error. */
export function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}
