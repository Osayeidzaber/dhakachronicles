"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/session";
import { canAssignRole } from "@/lib/auth/permissions";
import { AppError, check, toActionError, type ActionResult } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { siteUrl } from "@/lib/env";
import { revalidatePublic } from "@/lib/articles/revalidate";
import {
  bulkArticles,
  createArticle,
  createTranslation,
  deleteArticle,
  restoreRevision,
  transitionArticle,
  updateArticle,
  type BulkAction,
} from "@/lib/articles/service";
import { authorSchema, categorySchema, tagSchema, type TransitionInput } from "@/lib/articles/validation";
import { deleteMedia, updateMediaMeta } from "@/lib/media/service";
import { generateSeoSuggestions } from "@/lib/seo/ai";
import { runSync, syncOptionsSchema, processImport } from "@/lib/instagram/sync";
import { disconnect as disconnectInstagram } from "@/lib/instagram/oauth";
import type { Article, Media } from "@/lib/db/types";

async function attempt<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, error: err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") };
    return toActionError(err);
  }
}

/** For plain <form action>: run, then redirect back with ?ok= or ?error=. */
async function formAttempt(back: string, fn: () => Promise<unknown>, okMessage = "Saved"): Promise<never> {
  const res = await attempt(fn);
  const sep = back.includes("?") ? "&" : "?";
  redirect(res.ok ? `${back}${sep}ok=${encodeURIComponent(okMessage)}` : `${back}${sep}error=${encodeURIComponent(res.error)}`);
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

// ---------------------------------------------------------------- articles
export async function saveArticleAction(id: string | null, payload: unknown): Promise<ActionResult<Article>> {
  return attempt(async () => {
    const article = id ? await updateArticle(id, payload) : await createArticle(payload);
    revalidatePath("/admin/articles");
    return article;
  });
}

export async function transitionArticleAction(id: string, input: TransitionInput): Promise<ActionResult<Article>> {
  return attempt(async () => {
    const a = await transitionArticle(id, input);
    revalidatePath("/admin/articles");
    revalidatePath(`/admin/articles/${id}`);
    return a;
  });
}

export async function createTranslationAction(id: string): Promise<void> {
  const res = await attempt(() => createTranslation(id));
  if (res.ok) redirect(`/admin/articles/${res.data.id}`);
  redirect(`/admin/articles/${id}?error=${encodeURIComponent(res.error)}`);
}

export async function deleteArticleAction(id: string): Promise<void> {
  const res = await attempt(() => deleteArticle(id));
  redirect(res.ok ? "/admin/articles?ok=Deleted" : `/admin/articles/${id}?error=${encodeURIComponent(res.error)}`);
}

export async function restoreRevisionAction(articleId: string, revisionId: string): Promise<void> {
  await formAttempt(`/admin/articles/${articleId}`, () => restoreRevision(articleId, revisionId), "Revision restored");
}

const bulkSchema = z.object({
  action: z.enum(["archive", "publish", "return_to_draft", "delete"]),
  ids: z.array(z.uuid()).min(1, "Select at least one article"),
});

export async function bulkArticlesAction(formData: FormData): Promise<void> {
  await formAttempt("/admin/articles", async () => {
    const { action, ids } = bulkSchema.parse({ action: str(formData, "action"), ids: formData.getAll("ids") });
    const res = await bulkArticles(ids, action as BulkAction);
    revalidatePath("/admin/articles");
    if (res.failed.length) throw new AppError(`${res.done} done, ${res.failed.length} failed: ${res.failed.slice(0, 3).join(" | ")}`, "VALIDATION");
  }, "Bulk action complete");
}

export async function aiSeoAction(input: { language: "bn" | "en"; title: string; body: string }) {
  return attempt(async () => {
    const session = await requireSession("article.create");
    const { rateLimit } = await import("@/lib/rate-limit");
    await rateLimit(`ai-seo:${session.userId}`, 20, 3600);
    return generateSeoSuggestions(input);
  });
}

export async function checkSlugAction(language: "bn" | "en", slug: string, exceptId: string | null): Promise<boolean> {
  await requireSession();
  const supabase = await createClient();
  let q = supabase.from("articles").select("id").eq("language", language).eq("slug", slug);
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q.limit(1);
  return !!data?.length;
}

// ---------------------------------------------------------------- media
export async function listMediaAction(page = 1, q = ""): Promise<ActionResult<{ items: Media[]; total: number }>> {
  return attempt(async () => {
    await requireSession("media.upload");
    const supabase = await createClient();
    let query = supabase.from("media").select("*", { count: "exact" }).eq("status", "ready");
    if (q.trim()) query = query.ilike("original_filename", `%${q.trim().replace(/[%_]/g, "")}%`);
    const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * 24, page * 24 - 1);
    if (error) throw error;
    return { items: (data ?? []) as Media[], total: count ?? 0 };
  });
}

export async function updateMediaAction(id: string, formData: FormData): Promise<void> {
  await formAttempt("/admin/media", () =>
    updateMediaMeta(id, {
      alt_text_en: str(formData, "alt_text_en") || null,
      alt_text_bn: str(formData, "alt_text_bn") || null,
      caption: str(formData, "caption") || null,
      credit: str(formData, "credit") || null,
    }),
  );
}

export async function deleteMediaAction(id: string): Promise<void> {
  await formAttempt("/admin/media", () => deleteMedia(id), "Deleted");
}

// ---------------------------------------------------------------- taxonomy & authors
function taxonomyActions(table: "categories" | "tags" | "authors", schema: z.ZodType<Record<string, unknown>>, path: string) {
  return {
    async save(id: string | null, formData: FormData) {
      await formAttempt(path, async () => {
        const session = await requireSession(table === "authors" ? "authors.manage" : "taxonomy.manage");
        const input = schema.parse(Object.fromEntries(formData));
        const supabase = await createClient();
        if (id) check(await supabase.from(table).update(input).eq("id", id));
        else check(await supabase.from(table).insert(input));
        await audit(session.userId, `${table}.${id ? "update" : "create"}`, table, id, { slug: input.slug });
        revalidatePublic();
      });
    },
    async remove(id: string) {
      await formAttempt(path, async () => {
        const session = await requireSession(table === "authors" ? "authors.manage" : "taxonomy.manage");
        const supabase = await createClient();
        check(await supabase.from(table).delete().eq("id", id));
        await audit(session.userId, `${table}.delete`, table, id);
        revalidatePublic();
      }, "Deleted");
    },
  };
}

const categoryOps = taxonomyActions("categories", categorySchema, "/admin/categories");
const tagOps = taxonomyActions("tags", tagSchema, "/admin/tags");
const authorOps = taxonomyActions("authors", authorSchema, "/admin/authors");

export async function saveCategoryAction(id: string | null, fd: FormData) { return categoryOps.save(id, fd); }
export async function deleteCategoryAction(id: string) { return categoryOps.remove(id); }
export async function saveTagAction(id: string | null, fd: FormData) { return tagOps.save(id, fd); }
export async function deleteTagAction(id: string) { return tagOps.remove(id); }
export async function saveAuthorAction(id: string | null, fd: FormData) { return authorOps.save(id, fd); }
export async function deleteAuthorAction(id: string) { return authorOps.remove(id); }

// ---------------------------------------------------------------- team
const inviteSchema = z.object({
  email: z.email(),
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["admin", "editor", "writer"]),
});

/** Secure provisioning: admins invite by email; the invitee sets their own password. */
export async function inviteUserAction(formData: FormData): Promise<void> {
  await formAttempt("/admin/team", async () => {
    const session = await requireSession("team.manage");
    const input = inviteSchema.parse(Object.fromEntries(formData));
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
      data: { full_name: input.full_name },
      redirectTo: `${siteUrl()}/login`,
    });
    if (error) throw error;
    // Role lives in app_metadata (not user-editable) and in profiles.
    const upd = await admin.auth.admin.updateUserById(data.user.id, { app_metadata: { role: input.role } });
    if (upd.error) throw upd.error;
    check(await admin.from("profiles").upsert({ id: data.user.id, full_name: input.full_name, role: input.role }));
    await audit(session.userId, "team.invite", "user", data.user.id, { email: input.email, role: input.role });
  }, "Invitation sent");
}

const roleSchema = z.object({ role: z.enum(["admin", "editor", "writer", "none"]), is_active: z.enum(["on"]).optional() });

export async function updateMemberAction(userId: string, formData: FormData): Promise<void> {
  await formAttempt("/admin/team", async () => {
    const session = await requireSession("team.manage");
    if (!canAssignRole(session.profile.role, session.userId, userId)) throw new AppError("You cannot change your own role.", "FORBIDDEN");
    const input = roleSchema.parse(Object.fromEntries(formData));
    const role = input.role === "none" ? null : input.role;
    const admin = createAdminClient();
    const upd = await admin.auth.admin.updateUserById(userId, { app_metadata: { role } });
    if (upd.error) throw upd.error;
    check(await admin.from("profiles").update({ role, is_active: input.is_active === "on" }).eq("id", userId));
    await audit(session.userId, "team.update", "user", userId, { role, is_active: input.is_active === "on" });
  });
}

export async function updateOwnProfileAction(formData: FormData): Promise<void> {
  await formAttempt("/admin/team", async () => {
    const session = await requireSession();
    const full_name = z.string().trim().min(1).max(120).parse(str(formData, "full_name"));
    const supabase = await createClient();
    check(await supabase.from("profiles").update({ full_name }).eq("id", session.userId));
  });
}

// ---------------------------------------------------------------- settings
const settingsSchema = z.object({
  site_name_en: z.string().trim().min(1).max(100),
  site_name_bn: z.string().trim().min(1).max(100),
  default_language: z.enum(["bn", "en"]),
  logo_media_id: z.union([z.uuid(), z.literal("")]),
  social_facebook: z.union([z.url({ protocol: /^https$/ }), z.literal("")]),
  social_instagram: z.union([z.url({ protocol: /^https$/ }), z.literal("")]),
  social_x: z.union([z.url({ protocol: /^https$/ }), z.literal("")]),
  social_youtube: z.union([z.url({ protocol: /^https$/ }), z.literal("")]),
  seo_title_suffix: z.string().max(60),
  seo_description_en: z.string().max(300),
  seo_description_bn: z.string().max(300),
});

export async function saveSettingsAction(formData: FormData): Promise<void> {
  await formAttempt("/admin/settings", async () => {
    const session = await requireSession("settings.manage");
    const s = settingsSchema.parse(Object.fromEntries(formData));
    const social = Object.fromEntries(
      (["facebook", "instagram", "x", "youtube"] as const).map((k) => [k, s[`social_${k}`]]).filter(([, v]) => v),
    );
    const rows = [
      { setting_key: "site_name", setting_value: { en: s.site_name_en, bn: s.site_name_bn }, is_public: true },
      { setting_key: "default_language", setting_value: s.default_language, is_public: true },
      { setting_key: "logo_media_id", setting_value: s.logo_media_id || null, is_public: true },
      { setting_key: "social_links", setting_value: social, is_public: true },
      {
        setting_key: "seo_defaults",
        setting_value: { title_suffix: s.seo_title_suffix, description_en: s.seo_description_en, description_bn: s.seo_description_bn },
        is_public: true,
      },
    ].map((r) => ({ ...r, updated_by: session.userId }));
    const supabase = await createClient();
    check(await supabase.from("site_settings").upsert(rows, { onConflict: "setting_key" }));
    await audit(session.userId, "settings.update", "site_settings", null);
    revalidatePublic();
  });
}

// ---------------------------------------------------------------- instagram
export async function instagramSyncAction(formData: FormData): Promise<void> {
  await formAttempt("/admin/instagram", async () => {
    const session = await requireSession("instagram.manage");
    const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ""));
    const opts = syncOptionsSchema.parse(raw);
    const trigger = formData.get("initial") === "1" ? "initial" : "manual";
    const res = await runSync(trigger, opts, session.userId);
    await audit(session.userId, "instagram.sync", "instagram_sync_run", res.runId, { ...res });
    revalidatePath("/admin");
  }, "Sync finished");
}

export async function instagramAutoImportAction(formData: FormData): Promise<void> {
  await formAttempt("/admin/instagram", async () => {
    const session = await requireSession("instagram.manage");
    const enabled = formData.get("auto_import") === "on";
    const supabase = await createClient();
    const { data } = await supabase.from("instagram_accounts").select("id").limit(1).maybeSingle();
    if (!data) throw new AppError("No account connected.", "VALIDATION");
    check(await supabase.from("instagram_accounts").update({ auto_import: enabled }).eq("id", data.id));
    await audit(session.userId, "instagram.auto_import", "instagram_account", data.id, { enabled });
  });
}

export async function instagramRetryAction(importId: string): Promise<void> {
  await formAttempt("/admin/instagram", async () => {
    const session = await requireSession("instagram.manage");
    const res = await processImport(createAdminClient(), z.uuid().parse(importId));
    await audit(session.userId, "instagram.retry", "instagram_import", importId, { result: res });
    if (res !== "imported") throw new AppError("Import failed again; see the error message.", "VALIDATION");
  }, "Imported");
}

export async function instagramDisconnectAction(): Promise<void> {
  await formAttempt("/admin/instagram", async () => {
    const session = await requireSession("instagram.manage");
    await disconnectInstagram(session.userId);
  }, "Disconnected");
}

// ---------------------------------------------------------------- notifications
export async function markNotificationsReadAction(): Promise<void> {
  const session = await requireSession();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", session.userId).is("read_at", null);
  revalidatePath("/admin");
}
