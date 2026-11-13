"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/session";
import { AppError, check, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { siteUrl } from "@/lib/env";
import { revalidatePublic } from "@/lib/articles/revalidate";
import { clearHighlight, searchForHighlight, setHighlight, type PickResult } from "@/lib/highlight";
import { DISCORD_EVENTS, getDiscordSettings, notifyDiscord, saveDiscordSettings, type DiscordEvent } from "@/lib/discord";

async function attempt<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, error: err.issues.map((i) => i.message).join("; ") };
    return toActionError(err);
  }
}

async function formAttempt(back: string, fn: () => Promise<unknown>, okMessage = "Saved"): Promise<never> {
  const res = await attempt(fn);
  const sep = back.includes("?") ? "&" : "?";
  redirect(res.ok ? `${back}${sep}ok=${encodeURIComponent(okMessage)}` : `${back}${sep}error=${encodeURIComponent(res.error)}`);
}

// ---------------------------------------------------------------- live readers
export async function liveReadersAction(): Promise<ActionResult<{ total: number }>> {
  return attempt(async () => {
    await requireSession();
    const { data } = await (await createClient()).rpc("live_readers");
    return { total: Number((data as { total?: number } | null)?.total ?? 0) };
  });
}

// ---------------------------------------------------------------- homepage highlight
export async function searchHighlightAction(q: string, source: "article" | "instagram"): Promise<ActionResult<PickResult[]>> {
  return attempt(async () => {
    await requireSession("article.publish");
    return searchForHighlight(z.string().max(120).parse(q), z.enum(["article", "instagram"]).parse(source));
  });
}

const setHighlightSchema = z.object({
  articleId: z.uuid(),
  hours: z.coerce.number().int().min(0).max(24 * 14).default(0),
});

export async function setHighlightAction(articleId: string, hours = 0): Promise<ActionResult<null>> {
  return attempt(async () => {
    const session = await requireSession("article.publish");
    const input = setHighlightSchema.parse({ articleId, hours });
    const supabase = await createClient();
    const { data: a } = await supabase.from("articles").select("id, title, status").eq("id", input.articleId).maybeSingle();
    if (!a) throw new AppError("Article not found.", "NOT_FOUND");
    if (a.status !== "published") throw new AppError("Only published stories can be highlighted. Publish it first.", "VALIDATION");
    const until = input.hours ? new Date(Date.now() + input.hours * 3_600_000).toISOString() : null;
    await setHighlight(session.userId, input.articleId, until);
    await audit(session.userId, "highlight.set", "article", input.articleId, { title: a.title, until });
    revalidatePublic();
    revalidatePath("/admin");
    return null;
  });
}

export async function clearHighlightAction(): Promise<void> {
  await formAttempt("/admin", async () => {
    const session = await requireSession("article.publish");
    await clearHighlight(session.userId);
    await audit(session.userId, "highlight.clear", "site_settings", "homepage_highlight");
    revalidatePublic();
  }, "Highlight cleared");
}

// ---------------------------------------------------------------- Instagram import mode
export async function instagramModeAction(formData: FormData): Promise<void> {
  await formAttempt("/admin/instagram", async () => {
    const session = await requireSession("instagram.manage");
    const mode = z.enum(["draft", "publish"]).parse(formData.get("mode"));
    const admin = createAdminClient();
    const { data } = await admin.from("instagram_accounts").select("id").limit(1).maybeSingle();
    if (!data) throw new AppError("Connect Instagram first.", "VALIDATION");
    check(await admin.from("instagram_accounts").update({ import_mode: mode }).eq("id", data.id));
    await audit(session.userId, "instagram.mode", "instagram_account", data.id, { mode });
  }, "Import mode saved");
}

// ---------------------------------------------------------------- Discord
export async function saveDiscordAction(formData: FormData): Promise<void> {
  await formAttempt("/admin/settings", async () => {
    const session = await requireSession("settings.manage");
    const url = String(formData.get("webhook_url") ?? "").trim();
    const events = Object.fromEntries(DISCORD_EVENTS.map((e) => [e, formData.get(`event_${e}`) === "on"])) as Record<DiscordEvent, boolean>;
    await saveDiscordSettings(session.userId, { url: url || undefined, clear: formData.get("clear") === "1", events });
    await audit(session.userId, "discord.update", "site_settings", "discord", { events });
  }, "Discord settings saved");
}

export async function testDiscordAction(): Promise<void> {
  await formAttempt("/admin/settings", async () => {
    await requireSession("settings.manage");
    if (!(await getDiscordSettings()).configured) throw new AppError("Add a webhook URL first.", "VALIDATION");
    const ok = await notifyDiscord("test", { title: "Dhaka Chronicles is connected", description: "Notifications from the newsroom will appear in this channel.", url: siteUrl() });
    if (!ok) throw new AppError("Discord did not accept the message. Check the webhook URL.", "VALIDATION");
  }, "Test message sent");
}

// ---------------------------------------------------------------- team accounts
const createMemberSchema = z.object({
  email: z.email().max(200),
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["admin", "editor", "writer"]),
  password: z.string().min(10, "Password must be at least 10 characters").max(128),
});

/** Create an account with a starting password (no email needed). The member changes it after signing in. */
export async function createMemberAction(formData: FormData): Promise<void> {
  await formAttempt("/admin/team", async () => {
    const session = await requireSession("team.manage");
    const input = createMemberSchema.parse(Object.fromEntries(formData));
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: { role: input.role },
      user_metadata: { full_name: input.full_name },
    });
    if (error) throw new AppError(error.message, "VALIDATION");
    check(await admin.from("profiles").upsert({ id: data.user.id, full_name: input.full_name, role: input.role }));
    await audit(session.userId, "team.create", "user", data.user.id, { email: input.email, role: input.role });
    await notifyDiscord("team_joined", { title: `${input.full_name} joined the newsroom`, fields: [{ name: "Role", value: input.role }] });
  }, "Account created");
}

// ---------------------------------------------------------------- own profile
const profileSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  avatar_media_id: z.union([z.uuid(), z.literal("")]).optional(),
  remove_avatar: z.literal("1").optional(),
});

export async function updateProfileAction(formData: FormData): Promise<void> {
  await formAttempt("/admin/profile", async () => {
    const session = await requireSession();
    const input = profileSchema.parse(Object.fromEntries(formData));
    const patch: { full_name: string; avatar_url?: string | null } = { full_name: input.full_name };
    if (input.remove_avatar) patch.avatar_url = null;
    else if (input.avatar_media_id) {
      const { data: m } = await createAdminClient().from("media").select("public_url, variants, status").eq("id", input.avatar_media_id).maybeSingle();
      if (!m || m.status !== "ready") throw new AppError("That image is not ready yet.", "VALIDATION");
      const variants = (m.variants ?? []) as { url: string; width: number; format: string }[];
      const small = variants.filter((v) => v.format === "webp").sort((a, b) => a.width - b.width)[0];
      patch.avatar_url = small?.url ?? (m.public_url as string);
    }
    // profiles RLS lets users update their own row; role changes are blocked by a trigger.
    check(await (await createClient()).from("profiles").update(patch).eq("id", session.userId));
    await audit(session.userId, "profile.update", "user", session.userId);
    revalidatePath("/admin", "layout");
  }, "Profile saved");
}

const passwordSchema = z
  .object({ password: z.string().min(10, "Use at least 10 characters").max(128), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match" });

export async function changePasswordAction(formData: FormData): Promise<void> {
  await formAttempt("/admin/profile", async () => {
    const session = await requireSession();
    const input = passwordSchema.parse(Object.fromEntries(formData));
    const { error } = await (await createClient()).auth.updateUser({ password: input.password });
    if (error) throw new AppError(error.message, "VALIDATION");
    await audit(session.userId, "profile.password", "user", session.userId);
  }, "Password changed");
}
