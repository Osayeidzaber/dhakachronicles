import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/instagram/crypto";
import { appSecretProof, authorizeUrl, imageSources, isAllowedMediaHost, listMedia, type IgMedia } from "@/lib/instagram/client";
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
    // Flip one character in the middle (always a real change, unlike the old last-char swap).
    const mid = Math.floor(enc.length / 2);
    const tampered = enc.slice(0, mid) + (enc[mid] === "A" ? "B" : "A") + enc.slice(mid + 1);
    expect(() => decryptSecret(tampered, key)).toThrow();
    expect(() => decryptSecret(enc, randomBytes(32).toString("base64"))).toThrow();
  });

  it("builds the Unified Login dialog URL with the configuration and state", () => {
    const u = new URL(authorizeUrl("123", "cfg9", "https://site.test/api/instagram/callback", "st"));
    expect(u.host).toBe("www.facebook.com");
    expect(u.searchParams.get("config_id")).toBe("cfg9");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("scope")).toBeNull();
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
    const page = await listMedia({ token: "tok", appSecret: "sec" }, "1784", { limit: 10, after: "PREV" }, fake);
    expect(page.items[0].id).toBe("1");
    expect(page.after).toBe("CUR");
    expect(calls[0]).toContain("after=PREV");
    expect(calls[0]).toContain("graph.facebook.com/v27.0/1784/media");
    expect(calls[0]).toContain("appsecret_proof=" + appSecretProof("tok", "sec"));
  });
});

describe("videos and parallel imports", () => {
  it("finds videos in reels and carousels, with their covers", async () => {
    const { videoSources } = await import("@/lib/instagram/client");
    const reel = { id: "1", media_type: "VIDEO", media_url: "https://x.cdninstagram.com/v.mp4", thumbnail_url: "https://x.cdninstagram.com/t.jpg", timestamp: "2026-11-13T10:00:00+0000" };
    expect(videoSources(reel)).toEqual([{ id: "1", url: "https://x.cdninstagram.com/v.mp4", thumb: "https://x.cdninstagram.com/t.jpg" }]);
    const album = {
      id: "2",
      media_type: "CAROUSEL_ALBUM",
      timestamp: "2026-11-13T10:00:00+0000",
      children: { data: [{ id: "a", media_type: "IMAGE", media_url: "https://x.cdninstagram.com/a.jpg" }, { id: "b", media_type: "VIDEO", media_url: "https://x.cdninstagram.com/b.mp4" }] },
    };
    expect(videoSources(album).map((v) => v.id)).toEqual(["b"]);
    expect(videoSources({ id: "3", media_type: "IMAGE", media_url: "https://x/i.jpg", timestamp: "t" })).toEqual([]);
  });

  it("puts imported videos at the top of the draft", async () => {
    const { draftContent } = await import("@/lib/instagram/draft");
    const doc = draftContent("Line one\nLine two", "https://instagram.com/p/x", [{ src: "https://media/v.mp4", poster: "https://media/p.jpg", mediaId: "m1" }]);
    expect(doc.content?.[0]).toEqual({ type: "video", attrs: { src: "https://media/v.mp4", poster: "https://media/p.jpg", mediaId: "m1" } });
    expect(doc.content?.[1].type).toBe("paragraph");
  });

  it("runs work in parallel with a limit, keeps order, and isolates failures", async () => {
    const { mapLimit } = await import("@/lib/concurrency");
    let running = 0;
    let peak = 0;
    const res = await mapLimit([1, 2, 3, 4, 5, 6], 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      if (n === 4) throw new Error("boom");
      return n * 2;
    });
    expect(peak).toBe(3);
    expect(res.map((r) => (r.status === "fulfilled" ? r.value : "x"))).toEqual([2, 4, 6, "x", 10, 12]);
  });
});

describe("headline suggestions", () => {
  it("uses the first sentence and title-cases shouting captions", async () => {
    const { draftTitle } = await import("@/lib/instagram/draft");
    expect(draftTitle("Nvidia CEO Jensen Huang has resigned from his position. The board appointed Colette Kress as interim CEO.", "2026-11-14")).toBe("Nvidia CEO Jensen Huang has resigned from his position");
    expect(draftTitle("SHAWN MENDES SPEAKS UP FOR PALESTINE, URGES FELLOW ARTISTS\n\nMore text", "2026-11-14")).toBe("Shawn Mendes Speaks Up For Palestine, Urges Fellow Artists");
    expect(draftTitle("ঢাকায় বৃষ্টি। আরও খবর আসছে", "2026-11-14")).toBe("ঢাকায় বৃষ্টি। আরও খবর আসছে");
  });
});

describe("auto-featuring by engagement", () => {
  it("ranks the week's posts by likes + 3x comments and ignores old ones", async () => {
    const { topByEngagement } = await import("@/lib/instagram/engagement");
    const now = new Date("2026-11-14T12:00:00Z");
    const rows = [
      { articleId: "a", likes: 100, comments: 0, postedAt: "2026-11-13T10:00:00Z" },
      { articleId: "b", likes: 40, comments: 30, postedAt: "2026-11-12T10:00:00Z" }, // 130
      { articleId: "c", likes: 900, comments: 50, postedAt: "2026-11-01T10:00:00Z" }, // too old
      { articleId: "d", likes: 0, comments: 0, postedAt: "2026-11-14T10:00:00Z" }, // no engagement
      { articleId: "e", likes: 10, comments: 1, postedAt: "2026-11-14T09:00:00Z" },
    ];
    expect(topByEngagement(rows, now, 2)).toEqual(["b", "a"]);
    expect(topByEngagement(rows, now)).toEqual(["b", "a", "e"]);
  });
});

describe("translation helpers", () => {
  it("swaps every text run and keeps marks and structure", async () => {
    const { docTexts, replaceDocTexts } = await import("@/lib/content/tiptap");
    const doc: import("@/lib/db/types").TiptapDoc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Rain" }] },
        { type: "paragraph", content: [{ type: "text", text: "Heavy " }, { type: "text", text: "rain", marks: [{ type: "bold" }] }, { type: "text", text: " " }] },
        { type: "image", attrs: { mediaId: "m1" } },
      ],
    };
    expect(docTexts(doc)).toEqual(["Rain", "Heavy ", "rain"]);
    const out = replaceDocTexts(doc, ["বৃষ্টি", "ভারী ", "বৃষ্টি"]);
    expect(out.content?.[1].content?.[1]).toEqual({ type: "text", text: "বৃষ্টি", marks: [{ type: "bold" }] });
    expect(out.content?.[1].content?.[2].text).toBe(" ");
    expect(out.content?.[2]).toEqual(doc.content?.[2]);
  });

  it("batches long input without splitting strings", async () => {
    const { batchTexts } = await import("@/lib/translate");
    const b = batchTexts(["a".repeat(3000), "b".repeat(3000), "c"], 5000);
    expect(b.map((x) => x.length)).toEqual([1, 2]);
  });
});
