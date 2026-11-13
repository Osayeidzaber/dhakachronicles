import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { instagramConfig } from "@/lib/env";
import { AppError, check } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { encryptSecret } from "@/lib/instagram/crypto";
import { IG_SCOPES, authorizeUrl, exchangeCode, getMe, toLongLivedToken } from "@/lib/instagram/client";

function requireConfig() {
  const cfg = instagramConfig();
  if (!cfg) {
    throw new AppError(
      "Instagram is not configured. Set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI and TOKEN_ENCRYPTION_KEY.",
      "NOT_CONFIGURED",
    );
  }
  return cfg;
}

/** Start the Instagram Login flow with a single-use, user-bound CSRF state. */
export async function beginConnect(userId: string): Promise<string> {
  const cfg = requireConfig();
  const state = randomBytes(24).toString("base64url");
  check(
    await createAdminClient()
      .from("oauth_states")
      .insert({ state, provider: "instagram", user_id: userId, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() }),
  );
  return authorizeUrl(cfg.appId, cfg.redirectUri, state);
}

/** Usernames compare case-insensitively and ignore a leading "@". */
export function usernameMatches(actual: string, expected: string): boolean {
  const norm = (s: string) => s.trim().replace(/^@/, "").toLowerCase();
  return norm(actual) === norm(expected);
}

/**
 * Finish the flow: verify state, exchange the code, upgrade to a long-lived token,
 * and only store it if the account is the expected one (@dhakachronicles).
 */
export async function completeConnect(userId: string, code: string, state: string): Promise<{ username: string }> {
  const cfg = requireConfig();
  const admin = createAdminClient();

  const { data: st } = await admin.from("oauth_states").delete().eq("state", state).eq("provider", "instagram").select("*").maybeSingle();
  if (!st || st.user_id !== userId || new Date(st.expires_at).getTime() < Date.now()) {
    throw new AppError("Invalid or expired authorization state. Please try connecting again.", "VALIDATION");
  }

  const short = await exchangeCode({ appId: cfg.appId, appSecret: cfg.appSecret, redirectUri: cfg.redirectUri, code });
  const long = await toLongLivedToken(cfg.appSecret, short.access_token);
  const me = await getMe(long.access_token);
  const igUserId = me.user_id ?? me.id;

  if (!usernameMatches(me.username, cfg.expectedUsername)) {
    await audit(userId, "instagram.connect_rejected", "instagram_account", igUserId, { username: me.username, expected: cfg.expectedUsername });
    throw new AppError(
      `You authorized @${me.username}, but this site only accepts @${cfg.expectedUsername}. Nothing was connected.`,
      "FORBIDDEN",
    );
  }

  const account = check(
    await admin
      .from("instagram_accounts")
      .upsert(
        {
          ig_user_id: igUserId,
          username: me.username,
          account_type: me.account_type ?? null,
          status: "connected",
          token_expires_at: new Date(Date.now() + long.expires_in * 1000).toISOString(),
          token_refreshed_at: new Date().toISOString(),
          last_error: null,
          connected_by: userId,
        },
        { onConflict: "ig_user_id" },
      )
      .select("id")
      .single(),
  );
  if (!account) throw new AppError("Could not save the Instagram account.", "INTERNAL");
  check(
    await admin.from("instagram_tokens").upsert({
      account_id: account.id,
      encrypted_access_token: encryptSecret(long.access_token, cfg.encryptionKey),
      scopes: IG_SCOPES,
      updated_at: new Date().toISOString(),
    }),
  );
  await audit(userId, "instagram.connect", "instagram_account", account.id, { username: me.username });
  return { username: me.username };
}

export async function disconnect(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: acc } = await admin.from("instagram_accounts").select("id").limit(1).maybeSingle();
  if (!acc) return;
  await admin.from("instagram_tokens").delete().eq("account_id", acc.id);
  await admin.from("instagram_accounts").update({ status: "disconnected", auto_import: false }).eq("id", acc.id);
  await audit(userId, "instagram.disconnect", "instagram_account", acc.id);
}
