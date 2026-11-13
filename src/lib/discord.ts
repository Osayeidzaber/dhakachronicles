import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { decryptSecret, encryptSecret } from "@/lib/instagram/crypto";
import { log } from "@/lib/logger";

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
export type DiscordSettings = { configured: boolean; events: Record<DiscordEvent, boolean> };

const DEFAULT_EVENTS: Record<DiscordEvent, boolean> = {
  instagram_published: true,
  instagram_imported: true,
  instagram_failed: true,
  article_published: false,
  team_joined: false,
};

async function readStored() {
  const { data } = await createAdminClient().from("site_settings").select("setting_value").eq("setting_key", "discord").maybeSingle();
  return storedSchema.parse(data?.setting_value ?? {});
}

export async function getDiscordSettings(): Promise<DiscordSettings> {
  const s = await readStored();
  return { configured: !!s.encrypted_url, events: { ...DEFAULT_EVENTS, ...s.events } };
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

/** Post an embed to Discord. Never throws: notifications must not break publishing. */
export async function notifyDiscord(event: DiscordEvent | "test", msg: DiscordMessage): Promise<boolean> {
  try {
    const key = env().TOKEN_ENCRYPTION_KEY;
    const s = await readStored();
    if (!key || !s.encrypted_url) return false;
    if (event !== "test" && !{ ...DEFAULT_EVENTS, ...s.events }[event]) return false;
    const url = webhookUrlSchema.parse(decryptSecret(s.encrypted_url, key));
    const embed = {
      title: msg.title.slice(0, 256),
      description: msg.description?.slice(0, 2000),
      url: msg.url,
      color: 0xffffff,
      image: msg.imageUrl ? { url: msg.imageUrl } : undefined,
      fields: msg.fields?.slice(0, 10).map((f) => ({ name: f.name.slice(0, 256), value: f.value.slice(0, 1024), inline: true })),
      footer: { text: "Dhaka Chronicles" },
      timestamp: new Date().toISOString(),
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "Dhaka Chronicles", embeds: [embed], allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) log.warn("discord.failed", { status: res.status, event });
    return res.ok;
  } catch (err) {
    log.warn("discord.error", { event, message: err instanceof Error ? err.message : "error" });
    return false;
  }
}
