import "server-only";
import { z } from "zod";

/**
 * Server-only environment. Importing this from a Client Component fails the
 * build ("server-only"), so Supabase URL/keys can never reach the browser.
 */
const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SITE_URL: z.url().default("http://localhost:3000"),
  CRON_SECRET: z.string().min(16).optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `Invalid server environment: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}. See .env.example.`,
      );
    }
    cached = parsed.data;
  }
  return cached;
}
