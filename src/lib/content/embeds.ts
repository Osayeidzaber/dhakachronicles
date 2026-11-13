/**
 * Safe embeds: only whitelisted providers, stored as an ID (never raw HTML or
 * arbitrary iframe URLs), rendered with privacy-friendly embed URLs.
 */
export type EmbedProvider = "youtube";

export function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else {
        const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/?#]+)/);
        id = m ? m[2] : null;
      }
    }
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function embedSrc(provider: string, id: string): string | null {
  if (provider === "youtube" && /^[A-Za-z0-9_-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  return null;
}

/** Links in article content: only http(s), mailto and site-relative paths. */
export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  try {
    const u = new URL(h);
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Image sources in content must be https URLs (R2 public domain in practice). */
export function safeImageSrc(src: unknown): string | null {
  if (typeof src !== "string") return null;
  try {
    const u = new URL(src);
    return u.protocol === "https:" || (u.protocol === "http:" && u.hostname === "localhost") ? u.toString() : null;
  } catch {
    return null;
  }
}
