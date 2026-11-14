import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { decryptSecret, encryptSecret } from "@/lib/instagram/crypto";
import { log } from "@/lib/logger";
import { activityEmbed, alertEmbed, articleEmbed, COLORS, type ActivityInput, type AlertInput, type ArticleEventInput, type DiscordChannel, type DiscordEmbed } from "@/lib/discord-embed";

/** Events a Discord channel can be told about. */
export const DISCORD_EVENTS = ["instagram_published", "instagram_imported", "instagram_failed", "article_published", "team_joined"] as const;
export type DiscordEvent = (typeof DISCORD_EVENTS)[number];

export const DISCORD_EVENT_LABELS: Record<DiscordEvent, string> = {
  instagram_published: "Instagram post published",
  instagram_imported: "Instagram post saved as draft",
  instagram_failed: "Instagram import failed",
  article_published: "Article published",
  team_joined: "New team member",
};

/** Only official Discord webhook URLs are accepted (prevents SSRF to other hosts). */
export const webhookUrlSchema = z
  .string()
  .trim()
  .regex(/^https:\/\/(?:discord\.com|discordapp\.com|canary\.discord\.com|ptb\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+$/, "Paste a Discord webhook URL (https://discord.com/api/webhooks/…)");

const storedSchema = z.object({
  encrypted_url: z.string().nullable().default(null),
  events: z.partialRecord(z.enum(DISCORD_EVENTS), z.boolean()).default({}),
});
export type DiscordSettings = { configured: boolean; activityConfigured: boolean; alertsConfigured: boolean; events: Record<DiscordEvent, boolean> };

const DEFAULT_EVENTS: Record<DiscordEvent, boolean> = {
  instagram_published: true,
  instagram_imported: true,
  instagram_failed: true,
  article_published: true,
  team_joined: false,
};

async function readStored() {
  try {
    const { data } = await createAdminClient().from("site_settings").select("setting_value").eq("setting_key", "discord").maybeSingle();
    return storedSchema.parse(data?.setting_value ?? {});
  } catch {
    // Database not configured or unreachable: fall back to env webhooks only.
    return storedSchema.parse({});
  }
}

/** Webhook for a channel: the env variable wins, then (article channel only) the encrypted URL saved in Settings. */
async function webhookFor(channel: DiscordChannel): Promise<string | null> {
  const e = env();
  const fromEnv =
    channel === "article" ? e.DISCORD_ARTICLE_WEBHOOK_URL : channel === "alerts" ? (e.DISCORD_ALERTS_WEBHOOK_URL ?? e.DISCORD_ACTIVITY_WEBHOOK_URL) : e.DISCORD_ACTIVITY_WEBHOOK_URL;
  if (fromEnv) return webhookUrlSchema.safeParse(fromEnv).success ? fromEnv : null;
  if (channel !== "article") return null;
  const s = await readStored();
  if (!s.encrypted_url || !e.TOKEN_ENCRYPTION_KEY) return null;
  return webhookUrlSchema.parse(decryptSecret(s.encrypted_url, e.TOKEN_ENCRYPTION_KEY));
}

export async function getDiscordSettings(): Promise<DiscordSettings> {
  const s = await readStored();
  const e = env();
  return {
    configured: !!s.encrypted_url || !!e.DISCORD_ARTICLE_WEBHOOK_URL,
    activityConfigured: !!e.DISCORD_ACTIVITY_WEBHOOK_URL,
    alertsConfigured: !!e.DISCORD_ALERTS_WEBHOOK_URL,
    events: { ...DEFAULT_EVENTS, ...s.events },
  };
}

/** Save events, and the webhook URL when a new one is given (empty keeps the current one). */
export async function saveDiscordSettings(userId: string, input: { url?: string; clear?: boolean; events: Record<DiscordEvent, boolean> }) {
  const key = env().TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error("TOKEN_ENCRYPTION_KEY is not set.");
  const current = await readStored();
  const encrypted_url = input.clear ? null : input.url ? encryptSecret(webhookUrlSchema.parse(input.url), key) : current.encrypted_url;
  const { error } = await createAdminClient()
    .from("site_settings")
    .upsert({ setting_key: "discord", setting_value: { encrypted_url, events: input.events }, is_public: false, updated_by: userId }, { onConflict: "setting_key" });
  if (error) throw error;
}

export interface DiscordMessage {
  title: string;
  description?: string;
  url?: string;
  imageUrl?: string | null;
  fields?: { name: string; value: string }[];
}

async function post(channel: DiscordChannel, embed: DiscordEmbed, tag: string): Promise<boolean> {
  try {
    const url = await webhookFor(channel);
    if (!url) return false;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "Dhaka Chronicles", embeds: [embed], allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) log.warn("discord.failed", { status: res.status, channel, tag });
    return res.ok;
  } catch (err) {
    log.warn("discord.error", { channel, tag, message: err instanceof Error ? err.message : "error" });
    return false;
  }
}

/** Post a simple embed to the article channel. Never throws: notifications must not break publishing. */
export async function notifyDiscord(event: DiscordEvent | "test", msg: DiscordMessage): Promise<boolean> {
  if (event !== "test") {
    const s = await readStored();
    if (!{ ...DEFAULT_EVENTS, ...s.events }[event]) return false;
  }
  const embed: DiscordEmbed = {
    title: msg.title.slice(0, 256),
    description: msg.description?.slice(0, 2000),
    url: msg.url,
    color: COLORS.neutral,
    author: { name: event === "test" ? "Connection test" : DISCORD_EVENT_LABELS[event] },
    image: msg.imageUrl ? { url: msg.imageUrl } : undefined,
    fields: msg.fields?.slice(0, 10).map((f) => ({ name: f.name.slice(0, 256), value: f.value.slice(0, 1024), inline: true })),
    footer: { text: "Dhaka Chronicles newsroom" },
    timestamp: new Date().toISOString(),
  };
  return post("article", embed, event);
}

const ARTICLE_EVENT_TOGGLE: Partial<Record<ArticleEventInput["kind"], DiscordEvent>> = {
  published: "article_published",
  instagram_imported: "instagram_imported",
  instagram_published: "instagram_published",
  instagram_failed: "instagram_failed",
};

/** Rich article-log embed (publish, review, schedule, unpublish, Instagram). Never throws. */
export async function notifyArticle(input: ArticleEventInput): Promise<boolean> {
  const toggle = ARTICLE_EVENT_TOGGLE[input.kind];
  if (toggle) {
    const s = await readStored();
    if (!{ ...DEFAULT_EVENTS, ...s.events }[toggle]) return false;
  }
  return post("article", articleEmbed(input), input.kind);
}

/** Activity-log embed for any audited staff action. Never throws. */
export async function notifyActivity(input: ActivityInput): Promise<boolean> {
  return post("activity", activityEmbed(input), input.action);
}

/** Alert channel: errors, rate limits, expired tokens, abuse. Never throws. */
export async function notifyAlert(input: AlertInput): Promise<boolean> {
  log.warn("alert", { title: input.title, source: input.source, severity: input.severity ?? "warning" });
  return post("alerts", alertEmbed(input), input.source);
}

/** Send a test message to one channel. */
export async function testDiscordChannel(channel: DiscordChannel): Promise<boolean> {
  const embed: DiscordEmbed = {
    title: channel === "article" ? "Article log connected" : channel === "alerts" ? "Alerts connected" : "Activity log connected",
    description:
      channel === "article"
        ? "Published, scheduled, review and Instagram stories will appear here."
        : channel === "alerts"
          ? "Failures, rate limits, expired tokens and suspicious activity will appear here."
          : "Every staff action in the newsroom will appear here.",
    color: COLORS.published,
    author: { name: "Dhaka Chronicles" },
    footer: { text: "Connection test" },
    timestamp: new Date().toISOString(),
  };
  return post(channel, embed, "test");
}
