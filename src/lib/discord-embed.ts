/**
 * Pure builders for Discord embeds (no I/O, safe to unit test).
 * Two channels: "article" (the editorial log) and "activity" (everything staff do).
 */

export type DiscordChannel = "article" | "activity" | "alerts";

export interface DiscordEmbed {
  title: string;
  description?: string;
  url?: string;
  color: number;
  author?: { name: string; icon_url?: string };
  thumbnail?: { url: string };
  image?: { url: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  footer: { text: string };
  timestamp: string;
}

export const COLORS = {
  neutral: 0xf5f5f5,
  published: 0x22c55e,
  review: 0xf59e0b,
  scheduled: 0x3b82f6,
  removed: 0xef4444,
  instagram: 0xd62976,
} as const;

const clip = (s: string | null | undefined, n: number) => {
  if (!s) return undefined;
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const field = (name: string, value: string | null | undefined, inline = true) =>
  value ? { name: clip(name, 256)!, value: clip(value, 1024)!, inline } : null;

export interface ArticleEventInput {
  kind: "published" | "submitted" | "scheduled" | "unpublished" | "archived" | "instagram_imported" | "instagram_published" | "instagram_failed";
  title: string;
  url?: string;
  excerpt?: string | null;
  language?: "bn" | "en";
  section?: string | null;
  actor?: string | null;
  imageUrl?: string | null;
  scheduledFor?: string | null;
  sourceUrl?: string | null;
  /** Public story URL (when live) and the newsroom edit URL. */
  siteUrl?: string | null;
  adminUrl?: string | null;
  error?: string | null;
}

const ARTICLE_KIND: Record<ArticleEventInput["kind"], { label: string; color: number }> = {
  published: { label: "Published", color: COLORS.published },
  submitted: { label: "Submitted for review", color: COLORS.review },
  scheduled: { label: "Scheduled", color: COLORS.scheduled },
  unpublished: { label: "Unpublished", color: COLORS.removed },
  archived: { label: "Archived", color: COLORS.removed },
  instagram_imported: { label: "Saved as draft", color: COLORS.review },
  instagram_published: { label: "Published", color: COLORS.published },
  instagram_failed: { label: "Instagram import failed", color: COLORS.removed },
};

function dhakaTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

/** "Read on site · Edit in newsroom · Instagram post" as Markdown links. */
export function articleLinks(e: Pick<ArticleEventInput, "siteUrl" | "adminUrl" | "sourceUrl">): string | null {
  const parts = [
    e.siteUrl ? `[Read on site](${e.siteUrl})` : null,
    e.adminUrl ? `[Open in newsroom](${e.adminUrl})` : null,
    e.sourceUrl ? `[Instagram post](${e.sourceUrl})` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function articleEmbed(e: ArticleEventInput, now = new Date()): DiscordEmbed {
  const k = ARTICLE_KIND[e.kind];
  const fields = [
    field("Status", k.label),
    field("Origin", e.kind.startsWith("instagram_") ? "Instagram import" : "Newsroom"),
    field("Edition", e.language ? (e.language === "bn" ? "বাংলা" : "English") : null),
    field("Section", e.section),
    field("By", e.actor),
    field("Goes live", e.scheduledFor ? `${dhakaTime(e.scheduledFor)} (Dhaka)` : null),
    field("Links", articleLinks(e), false),
    field("Error", e.error, false),
  ].filter((f): f is NonNullable<typeof f> => !!f);
  return {
    title: clip(e.title, 256) ?? "Untitled",
    description: clip(e.excerpt, 600),
    url: e.url,
    color: k.color,
    author: { name: `Article log · ${k.label}` },
    image: e.imageUrl ? { url: e.imageUrl } : undefined,
    fields,
    footer: { text: "Dhaka Chronicles newsroom" },
    timestamp: now.toISOString(),
  };
}

/** Human labels for audit actions shown in the activity channel. */
const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "article.create": "Created an article",
  "article.update": "Edited an article",
  "article.delete": "Deleted an article",
  "article.restore_revision": "Restored a revision",
  "article.submit": "Submitted for review",
  "article.publish": "Published an article",
  "article.schedule": "Scheduled an article",
  "article.unpublish": "Unpublished an article",
  "article.archive": "Archived an article",
  "article.publish_scheduled": "Scheduled story went live",
  "media.upload": "Uploaded media",
  "media.update": "Updated media details",
  "media.delete": "Deleted media",
  "team.invite": "Invited a team member",
  "team.create": "Added a team member",
  "team.update": "Changed a team member",
  "team.joined": "Joined the newsroom",
  "profile.update": "Updated their profile",
  "profile.password": "Changed their password",
  "settings.update": "Changed site settings",
  "discord.update": "Changed Discord settings",
  "instagram.connect": "Connected Instagram",
  "instagram.connect_rejected": "Instagram connection rejected",
  "instagram.disconnect": "Disconnected Instagram",
  "instagram.sync": "Started an Instagram sync",
  "instagram.sync_run": "Instagram sync finished",
  "instagram.sync_failed": "Instagram sync failed",
  "instagram.imported": "Instagram post imported as draft",
  "instagram.imported_published": "Instagram post imported and published",
  "instagram.import_failed": "Instagram post failed to import",
  "instagram.import_selected": "Imported picked Instagram posts",
  "instagram.retry": "Retried an Instagram import",
  "instagram.mode": "Changed Instagram import mode",
  "instagram.auto_import": "Changed Instagram auto-import",
  "highlight.set": "Pinned the homepage highlight",
  "highlight.clear": "Cleared the homepage highlight",
  "brand_deal.create": "Added a brand deal",
  "brand_deal.update": "Updated a brand deal",
  "brand_deal.delete": "Deleted a brand deal",
};

export function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const [target, verb] = action.split(".");
  return `${(verb ?? "changed").replace(/_/g, " ")} ${target.replace(/_/g, " ")}`.replace(/^./, (c) => c.toUpperCase());
}

export function actionColor(action: string): number {
  if (/(delete|disconnect|rejected|unpublish|archive|fail)/.test(action)) return COLORS.removed;
  if (/(publish|published|joined|connect|imported)$/.test(action)) return COLORS.published;
  if (/(submit|invite)/.test(action)) return COLORS.review;
  if (/schedule/.test(action)) return COLORS.scheduled;
  return COLORS.neutral;
}

/** Metadata keys never sent to Discord. */
const HIDDEN_KEYS = /(token|secret|password|key|url|ip|email)/i;

export interface ActivityInput {
  action: string;
  actor: string | null;
  actorAvatar?: string | null;
  targetType: string;
  targetId: string | null;
  metadata?: Record<string, unknown>;
  adminUrl?: string;
}

export function activityEmbed(a: ActivityInput, now = new Date()): DiscordEmbed {
  const meta = Object.entries(a.metadata ?? {})
    .filter(([k, v]) => !HIDDEN_KEYS.test(k) && v != null && v !== "" && typeof v !== "object")
    .slice(0, 6)
    .map(([k, v]) => field(k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), String(v)))
    .filter((f): f is NonNullable<typeof f> => !!f);
  return {
    title: actionLabel(a.action),
    url: a.adminUrl,
    color: actionColor(a.action),
    author: { name: a.actor || "System", icon_url: a.actorAvatar ?? undefined },
    fields: [...meta, ...(a.targetId ? [{ name: "Target", value: `${a.targetType} · \`${a.targetId.slice(0, 8)}\``, inline: true }] : [])],
    footer: { text: `Activity log · ${a.action}` },
    timestamp: now.toISOString(),
  };
}

export type AlertSeverity = "warning" | "critical";

export interface AlertInput {
  title: string;
  detail?: string | null;
  severity?: AlertSeverity;
  source: string;
  fields?: Record<string, string | number | null | undefined>;
  url?: string;
}

/** Something needs attention: failures, rate limits, expired tokens, abuse. */
export function alertEmbed(a: AlertInput, now = new Date()): DiscordEmbed {
  const severity = a.severity ?? "warning";
  const fields = Object.entries(a.fields ?? {})
    .filter(([k, v]) => v != null && v !== "" && !HIDDEN_KEYS.test(k))
    .slice(0, 8)
    .map(([k, v]) => ({ name: clip(k, 256)!, value: clip(String(v), 1024)!, inline: true }));
  return {
    title: clip(a.title, 256) ?? "Alert",
    description: clip(a.detail, 1500),
    url: a.url,
    color: severity === "critical" ? COLORS.removed : COLORS.review,
    author: { name: severity === "critical" ? "Alert · needs action now" : "Alert · warning" },
    fields,
    footer: { text: `Alerts · ${a.source}` },
    timestamp: now.toISOString(),
  };
}

/** Already covered by the article log or the alerts channel, so not repeated in the activity log. */
const COVERED_ELSEWHERE = new Set(["instagram.imported", "instagram.imported_published", "instagram.import_failed", "instagram.sync_failed"]);
const lastEditPing = new Map<string, number>();

/** Decide whether an audit entry is worth a Discord activity message (everything stays in the audit log). */
export function shouldMirrorToDiscord(action: string, targetId: string | null, metadata: Record<string, unknown>, now = Date.now(), seen = lastEditPing): boolean {
  if (COVERED_ELSEWHERE.has(action)) return false;
  // Scheduled syncs that found nothing new would post every 15 minutes.
  if (action === "instagram.sync_run" && !Number(metadata.imported) && !Number(metadata.failed)) return false;
  // Autosave writes "article.update" every few seconds: one message per article per 30 minutes.
  if (action === "article.update" && targetId) {
    const last = seen.get(targetId);
    if (last !== undefined && now - last < 30 * 60_000) return false;
    seen.set(targetId, now);
  }
  return true;
}

