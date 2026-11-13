import { slugify } from "@/lib/content/slug";
import { truncate } from "@/lib/content/tiptap";
import type { Lang, TiptapDoc, TiptapNode } from "@/lib/db/types";

/** Guess the caption language: Bangla if a meaningful share of letters are Bengali script. */
export function detectLanguage(text: string): Lang {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (!letters.length) return "bn";
  const bengali = text.match(/\p{Script=Bengali}/gu) ?? [];
  return bengali.length / letters.length >= 0.3 ? "bn" : "en";
}

/** Headline suggestion: first non-empty caption line without hashtags/mentions. */
export function draftTitle(caption: string | null | undefined, timestamp: string): string {
  const firstLine =
    (caption ?? "")
      .split("\n")
      .map((l) => l.replace(/(^|\s)[#@][\p{L}\p{N}_.]+/gu, " ").trim())
      .find((l) => l.length > 0) ?? "";
  if (firstLine) return truncate(firstLine, 120);
  return `Instagram post ${timestamp.slice(0, 10)}`;
}

export function draftSlug(title: string, mediaId: string): string {
  const base = slugify(title, 90) || "instagram";
  return `${base}-ig-${mediaId.slice(-8)}`;
}

/**
 * Draft body: the ORIGINAL caption verbatim (one paragraph per line) followed by
 * a source note linking to the permalink. Editors rewrite this before publishing.
 */
export function draftContent(caption: string | null | undefined, permalink: string | null | undefined): TiptapDoc {
  const lines = (caption ?? "").split("\n").filter((l) => l.trim().length > 0);
  const content: TiptapNode[] = lines.map((l) => ({ type: "paragraph", content: [{ type: "text", text: l }] }));
  if (permalink) {
    content.push({ type: "horizontalRule" });
    content.push({
      type: "paragraph",
      content: [
        { type: "text", text: "Source: " },
        { type: "text", text: "Instagram", marks: [{ type: "link", attrs: { href: permalink, rel: "noopener noreferrer nofollow", target: "_blank" } }] },
      ],
    });
  }
  return { type: "doc", content };
}
