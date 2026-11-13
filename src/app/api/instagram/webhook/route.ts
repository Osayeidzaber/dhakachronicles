import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

/**
 * Meta webhook endpoint. Required by the Instagram app setup; we don't act on
 * events (new posts are pulled by the scheduled sync and become drafts only).
 */
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Verification handshake: echo hub.challenge when the verify token matches.
export function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const expected = env().INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  const token = p.get("hub.verify_token") ?? "";
  const challenge = p.get("hub.challenge") ?? "";
  if (expected && p.get("hub.mode") === "subscribe" && safeEqual(token, expected) && /^[\w-]{1,256}$/.test(challenge)) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

// Event delivery: verify Meta's signature, acknowledge, ignore.
export async function POST(request: Request) {
  const secret = env().INSTAGRAM_APP_SECRET;
  const body = await request.text();
  const sig = request.headers.get("x-hub-signature-256") ?? "";
  if (!secret || !sig.startsWith("sha256=")) return new Response("Forbidden", { status: 403 });
  const digest = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  if (!safeEqual(sig, digest)) return new Response("Forbidden", { status: 403 });
  log.info("instagram.webhook_received", { bytes: body.length });
  return new Response("OK", { status: 200 });
}
