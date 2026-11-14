"use client";

import { useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Embed, FigureImage, Video } from "./extensions";
import { MediaPicker } from "@/components/admin/media-picker";
import { parseYouTubeId, safeHref } from "@/lib/content/embeds";
import type { TiptapDoc } from "@/lib/db/types";

function Btn({ on, active, children, label }: { on: () => void; active?: boolean; children: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={on} aria-label={label} title={label} className={`rounded px-2 py-1 text-sm ${active ? "bg-white text-black" : "hover:bg-neutral-100"}`}>
      {children}
    </button>
  );
}

function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const c = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap gap-1 border-b border-neutral-200 p-1">
      <Btn label="Paragraph" on={() => c().setParagraph().run()} active={editor.isActive("paragraph")}>P</Btn>
      <Btn label="Heading 2" on={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>H2</Btn>
      <Btn label="Heading 3" on={() => c().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>H3</Btn>
      <Btn label="Bold" on={() => c().toggleBold().run()} active={editor.isActive("bold")}><b>B</b></Btn>
      <Btn label="Italic" on={() => c().toggleItalic().run()} active={editor.isActive("italic")}><i>I</i></Btn>
      <Btn label="Bullet list" on={() => c().toggleBulletList().run()} active={editor.isActive("bulletList")}>• List</Btn>
      <Btn label="Numbered list" on={() => c().toggleOrderedList().run()} active={editor.isActive("orderedList")}>1. List</Btn>
      <Btn label="Quote" on={() => c().toggleBlockquote().run()} active={editor.isActive("blockquote")}>“ ”</Btn>
      <Btn
        label="Link"
        active={editor.isActive("link")}
        on={() => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link URL (https://…)", prev ?? "https://");
          if (url === null) return;
          if (url === "") return void c().unsetLink().run();
          const href = safeHref(url);
          if (!href) return void window.alert("Only http(s), mailto or /relative links are allowed.");
          c().extendMarkRange("link").setLink({ href }).run();
        }}
      >
        Link
      </Btn>
      <Btn label="Insert image" on={onImage}>Image</Btn>
      <Btn
        label="Image caption"
        active={editor.isActive("image")}
        on={() => {
          if (!editor.isActive("image")) return void window.alert("Select an image first.");
          const attrs = editor.getAttributes("image");
          const caption = window.prompt("Caption", (attrs.caption as string) ?? "");
          if (caption === null) return;
          const alt = window.prompt("Alt text (describe the image)", (attrs.alt as string) ?? "");
          c().updateAttributes("image", { caption: caption || null, alt: alt ?? attrs.alt }).run();
        }}
      >
        Caption
      </Btn>
      <Btn
        label="Embed YouTube video"
        on={() => {
          const url = window.prompt("YouTube URL");
          if (!url) return;
          const id = parseYouTubeId(url);
          if (!id) return void window.alert("Only YouTube links can be embedded.");
          c().setEmbed({ provider: "youtube", id }).run();
        }}
      >
        Video
      </Btn>
      <Btn label="Horizontal line" on={() => c().setHorizontalRule().run()}>―</Btn>
      <Btn label="Undo" on={() => c().undo().run()}>↶</Btn>
      <Btn label="Redo" on={() => c().redo().run()}>↷</Btn>
    </div>
  );
}

export function RichTextEditor({ value, onChange, lang, articleId }: { value: TiptapDoc; onChange: (doc: TiptapDoc) => void; lang: "bn" | "en"; articleId?: string }) {
  const [picker, setPicker] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow" } },
        underline: false,
        code: false,
        codeBlock: false,
      }),
      FigureImage,
      Embed,
      Video,
    ],
    content: value,
    editorProps: { attributes: { lang, class: "prose-article" } },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as TiptapDoc),
  });

  if (!editor) return <div className="card min-h-[420px] text-sm text-neutral-500">Loading editor…</div>;
  return (
    <div className="tiptap-editor rounded-lg border border-line bg-surface">
      <Toolbar editor={editor} onImage={() => setPicker(true)} />
      <EditorContent editor={editor} />
      <MediaPicker
        open={picker}
        articleId={articleId}
        onClose={() => setPicker(false)}
        onPick={(m) => {
          setPicker(false);
          const src = m.variants.find((v) => v.format === "webp" && v.width >= 960)?.url ?? m.public_url;
          editor
            .chain()
            .focus()
            .setImage({ src, alt: (lang === "bn" ? m.alt_text_bn : m.alt_text_en) ?? "" })
            .updateAttributes("image", { mediaId: m.id, caption: m.caption, credit: m.credit })
            .run();
        }}
      />
    </div>
  );
}
