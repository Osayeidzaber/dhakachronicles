import { z } from "zod";

/**
 * Minimal client for the official "Instagram API with Instagram Login"
 * (graph.instagram.com). No scraping, no unofficial endpoints.
 */
export const GRAPH_VERSION = "v23.0";
const GRAPH = "https://graph.instagram.com";
export const IG_SCOPES = ["instagram_business_basic"];

export class InstagramApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly igCode?: number,
  ) {
    super(message);
    this.name = "InstagramApiError";
  }
  /** OAuthException 190 = invalid/expired token. */
  get isTokenError() {
    return this.igCode === 190 || this.status === 401;
  }
  get isRateLimited() {
    return this.igCode === 4 || this.igCode === 17 || this.igCode === 32 || this.status === 429;
  }
}

type FetchLike = typeof fetch;

async function igFetch<T>(url: string, schema: z.ZodType<T>, init?: RequestInit, f: FetchLike = fetch): Promise<T> {
  const res = await f(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (body as { error?: { message?: string; code?: number }; error_message?: string }) ?? {};
    throw new InstagramApiError(err.error?.message ?? err.error_message ?? `Instagram API error ${res.status}`, res.status, err.error?.code);
  }
  return schema.parse(body);
}

export function authorizeUrl(appId: string, redirectUri: string, state: string): string {
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", IG_SCOPES.join(","));
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeCode(p: { appId: string; appSecret: string; redirectUri: string; code: string }, f?: FetchLike) {
  const body = new URLSearchParams({
    client_id: p.appId,
    client_secret: p.appSecret,
    grant_type: "authorization_code",
    redirect_uri: p.redirectUri,
    code: p.code,
  });
  return igFetch(
    "https://api.instagram.com/oauth/access_token",
    z.object({ access_token: z.string(), user_id: z.union([z.string(), z.number()]).transform(String), permissions: z.unknown().optional() }),
    { method: "POST", body },
    f,
  );
}

const longLived = z.object({ access_token: z.string(), expires_in: z.number() });

export async function toLongLivedToken(appSecret: string, shortToken: string, f?: FetchLike) {
  const u = new URL(`${GRAPH}/access_token`);
  u.searchParams.set("grant_type", "ig_exchange_token");
  u.searchParams.set("client_secret", appSecret);
  u.searchParams.set("access_token", shortToken);
  return igFetch(u.toString(), longLived, undefined, f);
}

export async function refreshLongLivedToken(token: string, f?: FetchLike) {
  const u = new URL(`${GRAPH}/refresh_access_token`);
  u.searchParams.set("grant_type", "ig_refresh_token");
  u.searchParams.set("access_token", token);
  return igFetch(u.toString(), longLived, undefined, f);
}

export const meSchema = z.object({
  user_id: z.union([z.string(), z.number()]).transform(String).optional(),
  id: z.string(),
  username: z.string(),
  account_type: z.string().optional(),
});

export async function getMe(token: string, f?: FetchLike) {
  const u = new URL(`${GRAPH}/${GRAPH_VERSION}/me`);
  u.searchParams.set("fields", "user_id,username,account_type");
  u.searchParams.set("access_token", token);
  return igFetch(u.toString(), meSchema, undefined, f);
}

const childSchema = z.object({
  id: z.string(),
  media_type: z.string(),
  media_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
});

export const igMediaSchema = z.object({
  id: z.string(),
  caption: z.string().optional(),
  media_type: z.enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]).or(z.string()),
  media_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  permalink: z.string().optional(),
  timestamp: z.string(),
  children: z.object({ data: z.array(childSchema) }).optional(),
});
export type IgMedia = z.infer<typeof igMediaSchema>;

const mediaPage = z.object({
  data: z.array(igMediaSchema),
  paging: z.object({ next: z.string().optional(), cursors: z.object({ after: z.string().optional() }).optional() }).optional(),
});

export const MEDIA_FIELDS =
  "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}";

/** Fetch one page of the account's media (newest first). */
export async function listMedia(token: string, opts: { after?: string; limit?: number; since?: Date; until?: Date } = {}, f?: FetchLike) {
  const u = new URL(`${GRAPH}/${GRAPH_VERSION}/me/media`);
  u.searchParams.set("fields", MEDIA_FIELDS);
  u.searchParams.set("limit", String(Math.min(opts.limit ?? 25, 50)));
  if (opts.after) u.searchParams.set("after", opts.after);
  if (opts.since) u.searchParams.set("since", String(Math.floor(opts.since.getTime() / 1000)));
  if (opts.until) u.searchParams.set("until", String(Math.floor(opts.until.getTime() / 1000)));
  u.searchParams.set("access_token", token);
  const page = await igFetch(u.toString(), mediaPage, undefined, f);
  return { items: page.data, after: page.paging?.next ? page.paging.cursors?.after : undefined };
}

/** Image URLs to download for a post. Videos contribute their thumbnail (if any). */
export function imageSources(m: IgMedia): { id: string; url: string; kind: "image" | "video_thumbnail" }[] {
  const pick = (id: string, type: string, mediaUrl?: string, thumb?: string) => {
    if (type === "IMAGE" && mediaUrl) return { id, url: mediaUrl, kind: "image" as const };
    if (type === "VIDEO" && thumb) return { id, url: thumb, kind: "video_thumbnail" as const };
    return null;
  };
  if (m.media_type === "CAROUSEL_ALBUM") {
    return (m.children?.data ?? [])
      .map((c) => pick(c.id, c.media_type, c.media_url, c.thumbnail_url))
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }
  const one = pick(m.id, m.media_type, m.media_url, m.thumbnail_url);
  return one ? [one] : [];
}

/** Only download from Instagram/Facebook CDNs over HTTPS (prevents SSRF via crafted URLs). */
export function isAllowedMediaHost(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(u.hostname);
  } catch {
    return false;
  }
}
