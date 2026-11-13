import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ARTICLE_SLUG_RE, asciiSlug, slugify } from "@/lib/content/slug";
import { docMediaIds, docToText, textToDoc } from "@/lib/content/tiptap";
import { parseYouTubeId, safeHref } from "@/lib/content/embeds";
import { articleInputSchema } from "@/lib/articles/validation";
import { RichText } from "@/components/content/rich-text";
import type { TiptapDoc } from "@/lib/db/types";

describe("slugs", () => {
  it("keeps Bangla characters and produces valid article slugs", () => {
    const s = slugify("ঢাকায় বৃষ্টি: জনজীবন ব্যাহত!");
    expect(s).toBe("ঢাকায়-বৃষ্টি-জনজীবন-ব্যাহত");
    expect(ARTICLE_SLUG_RE.test(s)).toBe(true);
  });

  it("normalizes English titles", () => {
    expect(slugify("  Hello, World -- 2026 ")).toBe("hello-world-2026");
    expect(asciiSlug("Café Politics")).toBe("cafe-politics");
  });

  it("caps length without trailing hyphens", () => {
    const s = slugify("a ".repeat(200), 20);
    expect(s.length).toBeLessThanOrEqual(20);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("tiptap content", () => {
  const doc: TiptapDoc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "শিরোনাম" }] },
      { type: "paragraph", content: [{ type: "text", text: "Hello " }, { type: "text", text: "world", marks: [{ type: "bold" }] }] },
      { type: "image", attrs: { src: "https://media.example.com/a.webp", mediaId: "m1", alt: "x" } },
    ],
  };

  it("extracts text and media ids", () => {
    expect(docToText(doc)).toBe("শিরোনাম\nHello world");
    expect(docMediaIds(doc)).toEqual(["m1"]);
  });

  it("converts captions to paragraphs", () => {
    expect(textToDoc("one\n\ntwo").content).toHaveLength(2);
  });

  it("renders safely: drops javascript: links and unknown nodes", () => {
    const html = renderToStaticMarkup(
      RichText({
        doc: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "bad", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
            { type: "rawHtml", attrs: { html: "<script>alert(1)</script>" } },
            { type: "paragraph", content: [{ type: "text", text: "<b>escaped</b>" }] },
            { type: "embed", attrs: { provider: "youtube", id: "dQw4w9WgXcQ" } },
          ],
        },
      }),
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;escaped&lt;/b&gt;");
    expect(html).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("only allows safe embeds and links", () => {
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://evil.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.com")).toBeNull();
    expect(safeHref("/bn/news/x")).toBe("/bn/news/x");
  });
});

describe("article validation", () => {
  const base = {
    language: "bn",
    title: "শিরোনাম",
    slug: "শিরোনাম",
    content: { type: "doc", content: [] },
  };

  it("accepts a minimal Bangla article and normalizes empty fields", () => {
    const a = articleInputSchema.parse({ ...base, category_id: "", canonical_url: "" });
    expect(a.category_id).toBeNull();
    expect(a.canonical_url).toBeNull();
    expect(a.tag_ids).toEqual([]);
  });

  it("rejects bad slugs, languages and canonical URLs", () => {
    expect(() => articleInputSchema.parse({ ...base, slug: "bad slug!" })).toThrow();
    expect(() => articleInputSchema.parse({ ...base, language: "fr" })).toThrow();
    expect(() => articleInputSchema.parse({ ...base, canonical_url: "javascript:alert(1)" })).toThrow();
    expect(() => articleInputSchema.parse({ ...base, title: "" })).toThrow();
  });
});
