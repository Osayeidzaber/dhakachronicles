import { Node, mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { embedSrc } from "@/lib/content/embeds";

/** Image node with media id (for usage tracking), alt text and caption attributes. */
export const FigureImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: { default: null, parseHTML: (el) => el.getAttribute("data-media-id"), renderHTML: (a) => (a.mediaId ? { "data-media-id": a.mediaId } : {}) },
      caption: { default: null, parseHTML: (el) => el.getAttribute("data-caption"), renderHTML: (a) => (a.caption ? { "data-caption": a.caption, title: a.caption } : {}) },
      credit: { default: null, parseHTML: (el) => el.getAttribute("data-credit"), renderHTML: (a) => (a.credit ? { "data-credit": a.credit } : {}) },
    };
  },
}).configure({ inline: false, allowBase64: false });

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embed: { setEmbed: (attrs: { provider: string; id: string }) => ReturnType };
  }
}

/** Whitelisted video embed (YouTube), stored as provider + id only. */
export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { provider: { default: "youtube" }, id: { default: null } };
  },
  parseHTML() {
    return [{ tag: "div[data-embed]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const src = embedSrc(String(HTMLAttributes.provider), String(HTMLAttributes.id));
    return [
      "div",
      mergeAttributes({ "data-embed": HTMLAttributes.provider, class: "aspect-video bg-neutral-100" }),
      src ? ["iframe", { src, class: "h-full w-full", allowfullscreen: "true", loading: "lazy" }] : ["span", {}, "Invalid embed"],
    ];
  },
  addCommands() {
    return {
      setEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
