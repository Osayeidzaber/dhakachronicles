import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { beginConnect } from "@/lib/instagram/oauth";
import { toActionError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** Admin-only: redirects to the Meta Unified Login dialog. */
export async function GET(req: Request) {
  try {
    const session = await requireSession("instagram.manage");
    return NextResponse.redirect(await beginConnect(session.userId));
  } catch (err) {
    const url = new URL("/admin/instagram", req.url);
    url.searchParams.set("error", toActionError(err).error);
    return NextResponse.redirect(url);
  }
}
