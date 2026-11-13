import "server-only";
import { z } from "zod";

/**
 * Server-only environment. Importing this from a Client Component fails the build
 * ("server-only"), so Supabase URL/keys and other secrets never reach the browser.
 */
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z.object({
  SUPABASE_URL: optional,
  SUPABASE_PUBLISHABLE_KEY: optional,
  SUPABASE_SECRET_KEY: optional,
  SITE_URL: z.string().default("http://localhost:3000"),
  CRON_SECRET: optional,
  TOKEN_ENCRYPTION_KEY: optional,
  R2_ACCOUNT_ID: optional,
  R2_ACCESS_KEY_ID: optional,
  R2_SECRET_ACCESS_KEY: optional,
  R2_BUCKET: optional,
  R2_PUBLIC_BASE_URL: optional,
  INSTAGRAM_APP_ID: optional,
  INSTAGRAM_APP_SECRET: optional,
  INSTAGRAM_REDIRECT_URI: optional,
  INSTAGRAM_EXPECTED_USERNAME: z.string().default("dhakachronicles"),
  AI_SEO_API_URL: optional,
  AI_SEO_API_KEY: optional,
  AI_SEO_MODEL: optional,
});

export type ServerEnv = z.infer<typeof schema>;

export function env(): ServerEnv {
  // Parsed per call (cheap) so tests can change process.env.
  return schema.parse(process.env);
}

export function siteUrl(): string {
  return env().SITE_URL.replace(/\/+$/, "");
}

export function supabaseConfig() {
  const e = env();
  if (!e.SUPABASE_URL || !e.SUPABASE_PUBLISHABLE_KEY) return null;
  return { url: e.SUPABASE_URL, publishableKey: e.SUPABASE_PUBLISHABLE_KEY, secretKey: e.SUPABASE_SECRET_KEY };
}

export function r2Config() {
  const e = env();
  if (!e.R2_ACCOUNT_ID || !e.R2_ACCESS_KEY_ID || !e.R2_SECRET_ACCESS_KEY || !e.R2_BUCKET || !e.R2_PUBLIC_BASE_URL) {
    return null;
  }
  return {
    accountId: e.R2_ACCOUNT_ID,
    accessKeyId: e.R2_ACCESS_KEY_ID,
    secretAccessKey: e.R2_SECRET_ACCESS_KEY,
    bucket: e.R2_BUCKET,
    publicBaseUrl: e.R2_PUBLIC_BASE_URL.replace(/\/+$/, ""),
  };
}

export function instagramConfig() {
  const e = env();
  if (!e.INSTAGRAM_APP_ID || !e.INSTAGRAM_APP_SECRET || !e.INSTAGRAM_REDIRECT_URI || !e.TOKEN_ENCRYPTION_KEY) {
    return null;
  }
  return {
    appId: e.INSTAGRAM_APP_ID,
    appSecret: e.INSTAGRAM_APP_SECRET,
    redirectUri: e.INSTAGRAM_REDIRECT_URI,
    encryptionKey: e.TOKEN_ENCRYPTION_KEY,
    expectedUsername: e.INSTAGRAM_EXPECTED_USERNAME.toLowerCase(),
  };
}

export function aiSeoConfig() {
  const e = env();
  if (!e.AI_SEO_API_URL || !e.AI_SEO_API_KEY) return null;
  return { url: e.AI_SEO_API_URL, apiKey: e.AI_SEO_API_KEY, model: e.AI_SEO_MODEL ?? "" };
}
