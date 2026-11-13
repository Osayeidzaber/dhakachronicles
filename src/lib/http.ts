import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, httpStatus, toActionError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";

/** Wrap a route handler: consistent JSON errors, no stack traces leaked. */
export function jsonHandler<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const data = await fn(...args);
      return NextResponse.json({ ok: true, data });
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ ok: false, error: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
      }
      const status = httpStatus(err);
      if (status >= 500) log.error("api.error", { err });
      return NextResponse.json(toActionError(err), { status });
    }
  };
}

/** Verify "Authorization: Bearer <CRON_SECRET>" in constant time. */
export function assertCronAuth(req: Request): void {
  const secret = env().CRON_SECRET;
  if (!secret) throw new AppError("CRON_SECRET is not configured.", "NOT_CONFIGURED");
  const header = req.headers.get("authorization") ?? "";
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new AppError("Unauthorized", "UNAUTHORIZED");
  }
}
