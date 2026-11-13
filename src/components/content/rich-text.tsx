import type { ReactNode } from "react";
import { embedSrc, safeHref, safeImageSrc } from "@/lib/content/embeds";
import type { TiptapDoc, TiptapMark, TiptapNode } from "@/lib/db/types";

/**
 * Renders stored Tiptap JSON to React without dangerouslySetInnerHTML.
 * Unknown node types are dropped; links, images and embeds are sanitized.
 */
function applyMarks(text: ReactNode, marks: TiptapMark[] | undefined, key: string): ReactNode {
  return (marks ?? []).reduce<ReactNode>((acc, m, i) => {
    const k = `${key}-m${i}`;
    switch (m.type) {
      case "bold":
        return <strong key={k}>{acc}</strong>;
      case "italic":
        return <em key={k}>{acc}</em>;
      case "strike":
        return <s key={k}>{acc}</s>;
      case "link": {
        const href = safeHref(m.attrs?.href);
        if (!href) return acc;
        const external = /^https?:/.test(href);
        return (
          <a key={k} href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>
            {acc}
          </a>
        );
      }
      default:
        return acc;
    }
  }, text);
}

function renderNode(n: TiptapNode, key: string): ReactNode {
  const children = () => n.content?.map((c, i) => renderNode(c, `${key}-${i}`));
  switch (n.type) {
    case "text":
      return applyMarks(n.text ?? "", n.marks, key);
    case "paragraph":
      return <p key={key}>{children()}</p>;
    case "heading": {
      const level = n.attrs?.level === 3 ? 3 : 2;
      return level === 3 ? <h3 key={key}>{children()}</h3> : <h2 key={key}>{children()}</h2>;
    }
    case "bulletList":
      return <ul key={key}>{children()}</ul>;
    case "orderedList":
      return <ol key={key}>{children()}</ol>;
    case "listItem":
      return <li key={key}>{children()}</li>;
    case "blockquote":
      return <blockquote key={key}>{children()}</blockquote>;
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    case "image": {
      const src = safeImageSrc(n.attrs?.src);
      if (!src) return null;
      const caption = typeof n.attrs?.caption === "string" ? n.attrs.caption : null;
      const credit = typeof n.attrs?.credit === "string" ? n.attrs.credit : null;
      return (
        <figure key={key}>
          {/* eslint-disable-next-line @next/next/no-img-element -- R2-hosted, pre-optimized variant */}
          <img src={src} alt={typeof n.attrs?.alt === "string" ? n.attrs.alt : ""} loading="lazy" className="h-auto w-full" />
          {(caption || credit) && (
            <figcaption>
              {caption}
              {credit && <span className="ml-1 opacity-70">({credit})</span>}
            </figcaption>
          )}
        </figure>
      );
    }
    case "embed": {
      const src = embedSrc(String(n.attrs?.provider ?? ""), String(n.attrs?.id ?? ""));
      if (!src) return null;
      return (
        <div key={key} className="aspect-video">
          <iframe
            src={src}
            title="Embedded video"
            className="h-full w-full"
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        </div>
      );
    }
    default:
      return null;
  }
}

export function RichText({ doc, className = "prose-article" }: { doc: TiptapDoc | null | undefined; className?: string }) {
  return <div className={className}>{doc?.content?.map((n, i) => renderNode(n, `n${i}`))}</div>;
}
