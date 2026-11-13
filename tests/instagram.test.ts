import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/instagram/crypto";
import { authorizeUrl, imageSources, isAllowedMediaHost, listMedia, type IgMedia } from "@/lib/instagram/client";
import { detectLanguage, draftContent, draftSlug, draftTitle } from "@/lib/instagram/draft";
import { nextRetryAt, partitionNew } from "@/lib/instagram/sync";
import { usernameMatches } from "@/lib/instagram/oauth";
import { ARTICLE_SLUG_RE } from "@/lib/content/slug";
import { docToText } from "@/lib/content/tiptap";

const post = (id: string, extra: Partial<IgMedia> = {}): IgMedia => ({ id, media_type: "IMAGE", media_url: `https://scontent.cdninstagram.com/${id}.jpg`, timestamp: "2026-11-01T10:00:00+0000", ...extra });

describe("duplicate detection", () => {
  it("skips media ids already imported and repeated within a batch", () => {
    const { fresh, duplicates } = partitionNew([post("1"), post("2"), post("2"), post("3")], ["3"]);
    expect(fresh.map((p) => p.id)).toEqual(["1", "2"]);
    expect(duplicates.map((p) => p.id)).toEqual(["2", "3"]);
  });
});

describe("media selection", () => {
  it("uses each child of a carousel and video thumbnails", () => {
    const carousel = post("c", {
      media_type: "CAROUSEL_ALBUM",
      media_url: undefined,
      children: {
        data: [
          { id: "c1", media_type: "IMAGE", media_url: "https://a.cdninstagram.com/1.jpg" },
          { id: "c2", media_type: "VIDEO", media_url: "https://a.cdninstagram.com/2.mp4", thumbnail_url: "https://a.cdninstagram.com/2.jpg" },
          { id: "c3", media_type: "VIDEO" },
        ],
      },
    });
    expect(imageSources(carousel).map((s) => [s.id, s.kind])).toEqual([
      ["c1", "image"],
      ["c2", "video_thumbnail"],
    ]);
  });

  it("only downloads from Instagram CDNs over https", () => {
    expect(isAllowedMediaHost("https://scontent-sin6-1.cdninstagram.com/x.jpg")).toBe(true);
    expect(isAllowedMediaHost("https://video.xx.fbcdn.net/x.jpg")).toBe(true);
    expect(isAllowedMediaHost("http://scontent.cdninstagram.com/x.jpg")).toBe(false);
    expect(isAllowedMediaHost("https://cdninstagram.com.evil.com/x.jpg")).toBe(false);
    expect(isAllowedMediaHost("https://169.254.169.254/latest")).toBe(false);
  });
});

describe("draft creation", () => {
  const caption = "ঢাকায় আজ ভারী বৃষ্টি #dhaka @someone\nদ্বিতীয় লাইন\n\nthird";

  it("preserves the caption verbatim in the draft body and links the source", () => {
    const doc = draftContent(caption, "https://www.instagram.com/p/abc/");
    const text = docToText(doc);
    expect(text).toContain("ঢাকায় আজ ভারী বৃষ্টি #dhaka @someone");
    expect(text).toContain("দ্বিতীয় লাইন");
    expect(JSON.stringify(doc)).toContain("https://www.instagram.com/p/abc/");
  });

  it("suggests a clean title, language and a unique valid slug", () => {
    expect(draftTitle(caption, "2026-11-01")).toBe("ঢাকায় আজ ভারী বৃষ্টি");
    expect(draftTitle("", "2026-11-01T10:00:00Z")).toBe("Instagram post 2026-11-01");
    expect(detectLanguage(caption)).toBe("bn");
    expect(detectLanguage("Heavy rain in Dhaka today")).toBe("en");
    const slug = draftSlug("ঢাকায় আজ ভারী বৃষ্টি", "17912345678901234");
    expect(slug.endsWith("-ig-78901234")).toBe(true);
    expect(ARTICLE_SLUG_RE.test(slug)).toBe(true);
  });
});

describe("account checks and tokens", () => {
  it("only accepts the expected username", () => {
    expect(usernameMatches("DhakaChronicles", "dhakachronicles")).toBe(true);
    expect(usernameMatches("@dhakachronicles", "dhakachronicles")).toBe(true);
    expect(usernameMatches("dhakachronicles_fan", "dhakachronicles")).toBe(false);
  });

  it("encrypts tokens with AES-GCM and detects tampering", () => {
    const key = randomBytes(32).toString("base64");
    const enc = encryptSecret("IGAA-secret-token", key);
    expect(enc).not.toContain("secret");
    expect(decryptSecret(enc, key)).toBe("IGAA-secret-token");
    const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "B" : "A") + enc.slice(-1);
    expect(() => decryptSecret(tampered, key)).toThrow();
    expect(() => decryptSecret(enc, randomBytes(32).toString("base64"))).toThrow();
  });

  it("builds the official Instagram Login authorize URL with state", () => {
    const u = new URL(authorizeUrl("123", "https://site.test/api/instagram/callback", "st"));
    expect(u.host).toBe("www.instagram.com");
    expect(u.searchParams.get("scope")).toBe("instagram_business_basic");
    expect(u.searchParams.get("state")).toBe("st");
  });

  it("backs off retries and stops after the max attempts", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(nextRetryAt(1, now)?.toISOString()).toBe("2026-01-01T00:05:00.000Z");
    expect(nextRetryAt(2, now)?.toISOString()).toBe("2026-01-01T00:20:00.000Z");
    expect(nextRetryAt(5, now)).toBeNull();
  });

  it("paginates media via the Graph API cursor", async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify({ data: [post("1")], paging: { next: "https://next", cursors: { after: "CUR" } } }), { status: 200 });
    }) as unknown as typeof fetch;
    const page = await listMedia("tok", { limit: 10, after: "PREV" }, fake);
    expect(page.items[0].id).toBe("1");
    expect(page.after).toBe("CUR");
    expect(calls[0]).toContain("after=PREV");
    expect(calls[0]).toContain("graph.instagram.com");
  });
});
