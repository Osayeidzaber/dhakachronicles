import { createHmac } from "node:crypto";
import { z } from "zod";

/**
 * Minimal client for the official "Instagram API with Unified Login"
 * (graph.facebook.com, Business Integration System User token). No scraping,
 * no unofficial endpoints. Permissions come from the Meta login configuration.
 */
export const GRAPH_VERSION = "v27.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
export const IG_SCOPES = ["instagram_basic"];

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

/** Token + app secret. The proof (HMAC of the token) is sent on every call. */
export interface GraphAuth {
  token: string;
  appSecret: string;
}

export function appSecretProof(token: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(token).digest("hex");
}

function authed(path: string, auth: GraphAuth): URL {
  const u = new URL(`${GRAPH}${path}`);
  u.searchParams.set("access_token", auth.token);
  u.searchParams.set("appsecret_proof", appSecretProof(auth.token, auth.appSecret));
  return u;
}

/** Facebook Login for Business dialog for the Unified Login configuration. */
export function authorizeUrl(appId: string, configId: string, redirectUri: string, state: string): string {
  // Mirrors the "Login URL" Meta generates for the configuration (unversioned dialog).
  const u = new URL("https://www.facebook.com/dialog/oauth");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("config_id", configId);
  u.searchParams.set("display", "popup");
  u.searchParams.set("override_default_response_type", "true");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "login");
  return u.toString();
}

export async function exchangeCode(p: { appId: string; appSecret: string; redirectUri: string; code: string }, f?: FetchLike) {
  const u = new URL(`${GRAPH}/oauth/access_token`);
  u.searchParams.set("client_id", p.appId);
  u.searchParams.set("client_secret", p.appSecret);
  u.searchParams.set("redirect_uri", p.redirectUri);
  u.searchParams.set("code", p.code);
  return igFetch(u.toString(), z.object({ access_token: z.string(), expires_in: z.number().optional() }), undefined, f);
}

export const assignedAccountSchema = z.object({ id: z.string(), username: z.string() });

/** Instagram accounts the client shared with the app during login. */
export async function listAssignedAccounts(auth: GraphAuth, f?: FetchLike) {
  const u = authed("/me/assigned_instagram_accounts", auth);
  u.searchParams.set("fields", "id,username");
  const res = await igFetch(u.toString(), z.object({ data: z.array(assignedAccountSchema) }), undefined, f);
  return res.data;
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
  like_count: z.number().int().nonnegative().optional(),
  comments_count: z.number().int().nonnegative().optional(),
  children: z.object({ data: z.array(childSchema) }).optional(),
});
export type IgMedia = z.infer<typeof igMediaSchema>;

const mediaPage = z.object({
  data: z.array(igMediaSchema),
  paging: z.object({ next: z.string().optional(), cursors: z.object({ after: z.string().optional() }).optional() }).optional(),
});

export const MEDIA_FIELDS =
  "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{id,media_type,media_url,thumbnail_url}";

/** Fetch one page of the account's media (newest first). */
export async function listMedia(
  auth: GraphAuth,
  igUserId: string,
  opts: { after?: string; limit?: number; since?: Date; until?: Date } = {},
  f?: FetchLike,
) {
  const u = authed(`/${encodeURIComponent(igUserId)}/media`, auth);
  u.searchParams.set("fields", MEDIA_FIELDS);
  u.searchParams.set("limit", String(Math.min(opts.limit ?? 25, 50)));
  if (opts.after) u.searchParams.set("after", opts.after);
  if (opts.since) u.searchParams.set("since", String(Math.floor(opts.since.getTime() / 1000)));
  if (opts.until) u.searchParams.set("until", String(Math.floor(opts.until.getTime() / 1000)));
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

/** Videos (posts, reels, carousel slides) with their cover image, for download into R2. */
export function videoSources(m: IgMedia): { id: string; url: string; thumb?: string }[] {
  const pick = (id: string, type: string, mediaUrl?: string, thumb?: string) => (type === "VIDEO" && mediaUrl ? { id, url: mediaUrl, thumb } : null);
  const list =
    m.media_type === "CAROUSEL_ALBUM"
      ? (m.children?.data ?? []).map((c) => pick(c.id, c.media_type, c.media_url, c.thumbnail_url))
      : [pick(m.id, m.media_type, m.media_url, m.thumbnail_url)];
  return list.filter((x): x is NonNullable<typeof x> => x !== null);
}

/** Fetch one post by id (used when an editor picks specific posts to import). */
export async function getMedia(auth: GraphAuth, mediaId: string, f?: FetchLike): Promise<IgMedia> {
  if (!/^\d{5,30}$/.test(mediaId)) throw new InstagramApiError("Invalid Instagram media id.", 400);
  const u = authed(`/${mediaId}`, auth);
  u.searchParams.set("fields", MEDIA_FIELDS);
  return igFetch(u.toString(), igMediaSchema, undefined, f);
}
