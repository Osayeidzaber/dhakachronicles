import type { TiptapDoc, TiptapNode } from "@/lib/db/types";

export const EMPTY_DOC: TiptapDoc = { type: "doc", content: [] };

const BLOCKS = new Set(["paragraph", "heading", "blockquote", "listItem", "imageCaption"]);

/** Plain text extraction (search index, excerpts, SEO defaults). */
export function docToText(doc: TiptapDoc | null | undefined): string {
  const parts: string[] = [];
  const walk = (n: TiptapNode) => {
    if (n.type === "text" && n.text) parts.push(n.text);
    if (n.type === "hardBreak") parts.push("\n");
    n.content?.forEach(walk);
    if (BLOCKS.has(n.type)) parts.push("\n");
  };
  doc?.content?.forEach(walk);
  return parts
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Media ids referenced by image nodes (attrs.mediaId). */
export function docMediaIds(doc: TiptapDoc | null | undefined): string[] {
  const ids = new Set<string>();
  const walk = (n: TiptapNode) => {
    const id = n.attrs?.mediaId;
    if (n.type === "image" && typeof id === "string") ids.add(id);
    n.content?.forEach(walk);
  };
  doc?.content?.forEach(walk);
  return [...ids];
}

/** Convert plain text (e.g. an Instagram caption) to a doc, one paragraph per line. */
export function textToDoc(text: string): TiptapDoc {
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    type: "doc",
    content: paragraphs.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  };
}

export function wordCount(text: string): number {
  return text.split(/\s+/u).filter(Boolean).length;
}

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
