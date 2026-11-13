import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { completeConnect } from "@/lib/instagram/oauth";
import { toActionError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** OAuth redirect target registered in the Meta app (INSTAGRAM_REDIRECT_URI). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = new URL("/admin/instagram", req.url);
  try {
    const session = await requireSession("instagram.manage");
    const denied = url.searchParams.get("error_description") ?? url.searchParams.get("error");
    if (denied) throw new Error(`Instagram authorization was cancelled: ${denied}`);
    const code = url.searchParams.get("code")?.replace(/#_$/, "");
    const state = url.searchParams.get("state");
    if (!code || !state) throw new Error("Missing code or state.");
    const { username } = await completeConnect(session.userId, code, state);
    back.searchParams.set("connected", username);
  } catch (err) {
    back.searchParams.set("error", toActionError(err).error);
  }
  return NextResponse.redirect(back);
}
