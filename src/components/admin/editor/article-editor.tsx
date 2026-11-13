"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "./rich-text-editor";
import { MediaPicker } from "@/components/admin/media-picker";
import { saveArticleAction, transitionArticleAction, aiSeoAction, checkSlugAction } from "@/app/(cms)/admin/actions";
import { slugify } from "@/lib/content/slug";
import { docToText, truncate } from "@/lib/content/tiptap";
import { validateSeo } from "@/lib/seo/validator";
import { SEO_LIMITS } from "@/lib/seo/defaults";
import type { Article, Author, Category, Lang, Media, Tag, TiptapDoc, TiptapNode } from "@/lib/db/types";

export interface EditorProps {
  article: Article | null;
  initialLanguage: Lang;
  categories: Category[];
  authors: Author[];
  tags: Tag[];
  tagIds: string[];
  featuredImage: Pick<Media, "id" | "public_url" | "variants"> | null;
  canPublish: boolean;
  canEdit: boolean;
  aiAvailable: boolean;
}

type Form = {
  language: Lang;
  title: string;
  subtitle: string;
  slug: string;
  excerpt: string;
  content: TiptapDoc;
  featured_image_id: string;
  featured_image_alt: string;
  category_id: string;
  author_id: string;
  tag_ids: string[];
  is_breaking: boolean;
  is_featured: boolean;
  seo_title: string;
  seo_description: string;
  focus_keyword: string;
  canonical_url: string;
  og_title: string;
  og_description: string;
};

function initialForm(p: EditorProps): Form {
  const a = p.article;
  return {
    language: a?.language ?? p.initialLanguage,
    title: a?.title ?? "",
    subtitle: a?.subtitle ?? "",
    slug: a?.slug ?? "",
    excerpt: a?.excerpt ?? "",
    content: a?.content ?? { type: "doc", content: [] },
    featured_image_id: a?.featured_image_id ?? "",
    featured_image_alt: a?.featured_image_alt ?? "",
    category_id: a?.category_id ?? "",
    author_id: a?.author_id ?? "",
    tag_ids: p.tagIds,
    is_breaking: a?.is_breaking ?? false,
    is_featured: a?.is_featured ?? false,
    seo_title: a?.seo_title ?? "",
    seo_description: a?.seo_description ?? "",
    focus_keyword: a?.focus_keyword ?? "",
    canonical_url: a?.canonical_url ?? "",
    og_title: a?.og_title ?? "",
    og_description: a?.og_description ?? "",
  };
}

function countImagesMissingAlt(doc: TiptapDoc): number {
  let n = 0;
  const walk = (node: TiptapNode) => {
    if (node.type === "image" && !String(node.attrs?.alt ?? "").trim()) n++;
    node.content?.forEach(walk);
  };
  doc.content?.forEach(walk);
  return n;
}

const AUTOSAVE_MS = 20_000;

export function ArticleEditor(props: EditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => initialForm(props));
  const [articleId, setArticleId] = useState<string | null>(props.article?.id ?? null);
  const [status, setStatus] = useState(props.article?.status ?? "draft");
  const [dirty, setDirty] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!props.article);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(props.article?.updated_at ?? null);
  const [pending, start] = useTransition();
  const [picker, setPicker] = useState(false);
  const [featured, setFeatured] = useState(props.featuredImage);
  const [duplicateSlug, setDuplicateSlug] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const saving = useRef(false);

  const readOnly = !props.canEdit;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const contentText = useMemo(() => docToText(form.content), [form.content]);
  const seoIssues = useMemo(
    () =>
      validateSeo({
        ...form,
        content_text: contentText,
        featured_image_id: form.featured_image_id || null,
        inline_images_missing_alt: countImagesMissingAlt(form.content),
        duplicate_slug: duplicateSlug,
      }),
    [form, contentText, duplicateSlug],
  );

  useEffect(() => {
    if (!form.slug) return;
    const t = setTimeout(() => {
      checkSlugAction(form.language, form.slug, articleId).then(setDuplicateSlug).catch(() => undefined);
    }, 500);
    return () => clearTimeout(t);
  }, [form.slug, form.language, articleId]);

  const payload = useCallback(
    () => ({
      ...form,
      excerpt: form.excerpt || truncate(contentText, 280) || null,
    }),
    [form, contentText],
  );

  const save = useCallback(
    async (quiet = false): Promise<string | null> => {
      if (readOnly || saving.current) return articleId;
      if (!form.title.trim() || !form.slug) {
        if (!quiet) setMessage({ kind: "error", text: "Title and slug are required." });
        return null;
      }
      saving.current = true;
      const res = await saveArticleAction(articleId, payload());
      saving.current = false;
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error });
        return null;
      }
      setDirty(false);
      setSavedAt(res.data.updated_at);
      setStatus(res.data.status);
      if (!quiet) setMessage({ kind: "ok", text: "Saved" });
      if (!articleId) {
        setArticleId(res.data.id);
        router.replace(`/admin/articles/${res.data.id}`);
      }
      return res.data.id;
    },
    [articleId, form.slug, form.title, payload, readOnly, router],
  );

  // Autosave drafts while editing (published articles save only on demand).
  useEffect(() => {
    if (!dirty || readOnly || status === "published" || !articleId) return;
    const t = setTimeout(() => void save(true), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, readOnly, status, articleId, save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function workflow(action: "submit" | "approve" | "publish" | "schedule" | "unpublish" | "archive" | "restore" | "return_to_draft") {
    start(async () => {
      setMessage(null);
      const id = dirty || !articleId ? await save(true) : articleId;
      if (!id) return;
      if (action === "publish" && seoIssues.some((i) => i.severity === "error")) {
        setMessage({ kind: "error", text: "Fix the SEO errors (e.g. duplicate slug) before publishing." });
        return;
      }
      let input;
      if (action === "schedule") {
        if (!scheduleAt) return setMessage({ kind: "error", text: "Pick a date and time to schedule." });
        input = { action, scheduled_at: new Date(scheduleAt).toISOString() } as const;
      } else input = { action } as const;
      const res = await transitionArticleAction(id, input);
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setStatus(res.data.status);
      setMessage({ kind: "ok", text: `Status: ${res.data.status.replace("_", " ")}` });
      router.refresh();
    });
  }

  function aiSuggest() {
    start(async () => {
      const res = await aiSeoAction({ language: form.language, title: form.title, body: contentText });
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setForm((f) => ({
        ...f,
        seo_title: res.data.seo_title,
        seo_description: res.data.seo_description,
        focus_keyword: res.data.focus_keyword,
        excerpt: f.excerpt || res.data.excerpt || "",
      }));
      setDirty(true);
      setMessage({ kind: "ok", text: "AI suggestions applied. Review them before saving." });
    });
  }

  const field = "block text-sm font-medium";
  const preview = articleId && status === "published" ? `/${form.language}/news/${form.slug}` : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4" lang={form.language}>
        {message && (
          <p role={message.kind === "error" ? "alert" : "status"} className={`rounded p-3 text-sm ${message.kind === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>
            {message.text}
          </p>
        )}
        {readOnly && <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">You can view this article but not edit it in its current status.</p>}
        <fieldset disabled={readOnly} className="space-y-4">
          <label className={field}>
            Headline
            <input
              className="input mt-1 text-lg"
              value={form.title}
              onChange={(e) => {
                const title = e.target.value;
                // Auto-generate the slug from the headline until the slug is edited by hand.
                setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }));
                setDirty(true);
              }}
              maxLength={300}
              required
            />
          </label>
          <label className={field}>
            Subtitle
            <input className="input mt-1" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} maxLength={500} />
          </label>
          <label className={field}>
            Slug {duplicateSlug && <span className="text-red-700">— already used in this language</span>}
            <input
              className="input mt-1 font-mono"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", slugify(e.target.value));
              }}
            />
          </label>
          <div>
            <span className={field}>Body</span>
            <div className="mt-1">
              <RichTextEditor value={form.content} onChange={(d) => set("content", d)} lang={form.language} articleId={articleId ?? undefined} />
            </div>
            <p className="mt-1 text-xs text-neutral-500">{contentText.split(/\s+/).filter(Boolean).length} words</p>
          </div>
          <label className={field}>
            Excerpt
            <textarea className="input mt-1" rows={3} value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} maxLength={1000} placeholder="Leave empty to generate from the body" />
          </label>
        </fieldset>
      </div>

      <aside className="space-y-4">
        <section className="card space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>
              Status: <b>{status.replace("_", " ")}</b>
            </span>
            <span className="text-xs text-neutral-500">{dirty ? "Unsaved changes" : savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : ""}</span>
          </div>
          {!readOnly && (
            <button type="button" className="btn w-full" disabled={pending} onClick={() => start(async () => void (await save()))}>
              {articleId ? "Save" : "Create draft"}
            </button>
          )}
          {articleId && (
            <div className="flex flex-wrap gap-2">
              {!props.canPublish && (status === "draft" ? <button type="button" className="btn btn-primary" disabled={pending} onClick={() => workflow("submit")}>Submit for review</button> : null)}
              {!props.canPublish && status === "pending_review" && <button type="button" className="btn" disabled={pending} onClick={() => workflow("return_to_draft")}>Withdraw</button>}
              {props.canPublish && (
                <>
                  {status === "pending_review" && <button type="button" className="btn" disabled={pending} onClick={() => workflow("approve")}>Approve</button>}
                  {status !== "published" && status !== "archived" && <button type="button" className="btn btn-primary" disabled={pending} onClick={() => workflow("publish")}>Publish now</button>}
                  {(status === "published" || status === "scheduled") && <button type="button" className="btn" disabled={pending} onClick={() => workflow("unpublish")}>Unpublish</button>}
                  {status !== "archived" && <button type="button" className="btn" disabled={pending} onClick={() => workflow("archive")}>Archive</button>}
                  {status === "archived" && <button type="button" className="btn" disabled={pending} onClick={() => workflow("restore")}>Restore</button>}
                </>
              )}
            </div>
          )}
          {articleId && props.canPublish && status !== "published" && status !== "archived" && (
            <div className="flex gap-2">
              <input type="datetime-local" className="input" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} aria-label="Schedule time (your local time)" />
              <button type="button" className="btn" disabled={pending} onClick={() => workflow("schedule")}>Schedule</button>
            </div>
          )}
          {articleId && (
            <a className="btn w-full" href={preview ?? `/admin/articles/${articleId}/preview`} target="_blank" rel="noreferrer">
              {preview ? "View live" : "Preview"}
            </a>
          )}
        </section>

        <fieldset disabled={readOnly} className="card space-y-3">
          <legend className="sr-only">Details</legend>
          <label className={field}>
            Language
            <select className="input mt-1" value={form.language} onChange={(e) => set("language", e.target.value as Lang)} disabled={!!articleId}>
              <option value="bn">Bangla</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className={field}>
            Category
            <select className="input mt-1" value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">—</option>
              {props.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_en} / {c.name_bn}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            Author (byline)
            <select className="input mt-1" value={form.author_id} onChange={(e) => set("author_id", e.target.value)}>
              <option value="">—</option>
              {props.authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name_en} / {a.name_bn}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className={field}>Tags</span>
            <div className="mt-1 flex max-h-40 flex-wrap gap-1 overflow-y-auto">
              {props.tags.map((t) => {
                const on = form.tag_ids.includes(t.id);
                return (
                  <button key={t.id} type="button" className={`badge border ${on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"}`} onClick={() => set("tag_ids", on ? form.tag_ids.filter((x) => x !== t.id) : [...form.tag_ids, t.id])}>
                    {form.language === "bn" ? t.name_bn : t.name_en}
                  </button>
                );
              })}
              {!props.tags.length && <span className="text-xs text-neutral-500">No tags yet.</span>}
            </div>
          </div>
          {props.canPublish && (
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={form.is_breaking} onChange={(e) => set("is_breaking", e.target.checked)} /> Breaking
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} /> Featured
              </label>
            </div>
          )}
        </fieldset>

        <fieldset disabled={readOnly} className="card space-y-2">
          <legend className="text-sm font-semibold">Featured image</legend>
          {featured ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview from R2
            <img src={featured.variants.find((v) => v.format === "webp" && v.width >= 640)?.url ?? featured.public_url} alt="" className="w-full rounded" />
          ) : (
            <p className="text-xs text-neutral-500">None selected.</p>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => setPicker(true)}>
              Choose
            </button>
            {featured && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setFeatured(null);
                  set("featured_image_id", "");
                }}
              >
                Remove
              </button>
            )}
          </div>
          <label className={field}>
            Alt text
            <input className="input mt-1" value={form.featured_image_alt} onChange={(e) => set("featured_image_alt", e.target.value)} maxLength={300} />
          </label>
        </fieldset>

        <fieldset disabled={readOnly} className="card space-y-2">
          <legend className="flex w-full items-center justify-between text-sm font-semibold">
            SEO
            {props.aiAvailable && (
              <button type="button" className="btn" disabled={pending || !contentText} onClick={aiSuggest}>
                AI suggest
              </button>
            )}
          </legend>
          <label className={field}>
            SEO title <span className="text-xs text-neutral-500">({(form.seo_title || form.title).length}/{SEO_LIMITS.titleMax})</span>
            <input className="input mt-1" value={form.seo_title} onChange={(e) => set("seo_title", e.target.value)} placeholder={form.title} maxLength={200} />
          </label>
          <label className={field}>
            Meta description <span className="text-xs text-neutral-500">({form.seo_description.length}/{SEO_LIMITS.descriptionMax})</span>
            <textarea className="input mt-1" rows={3} value={form.seo_description} onChange={(e) => set("seo_description", e.target.value)} maxLength={400} />
          </label>
          <label className={field}>
            Focus keyword
            <input className="input mt-1" value={form.focus_keyword} onChange={(e) => set("focus_keyword", e.target.value)} maxLength={100} />
          </label>
          <label className={field}>
            Canonical URL
            <input className="input mt-1" value={form.canonical_url} onChange={(e) => set("canonical_url", e.target.value)} placeholder="Default: this article's URL" />
          </label>
          <label className={field}>
            Open Graph title
            <input className="input mt-1" value={form.og_title} onChange={(e) => set("og_title", e.target.value)} maxLength={200} />
          </label>
          <label className={field}>
            Open Graph description
            <textarea className="input mt-1" rows={2} value={form.og_description} onChange={(e) => set("og_description", e.target.value)} maxLength={400} />
          </label>
          <ul className="space-y-1 text-xs">
            {seoIssues.map((i, n) => (
              <li key={n} className={i.severity === "error" ? "text-red-700" : i.severity === "warning" ? "text-amber-700" : "text-neutral-500"}>
                {i.severity === "error" ? "✕" : i.severity === "warning" ? "!" : "·"} {i.message}
              </li>
            ))}
            {!seoIssues.length && <li className="text-green-700">No SEO issues found.</li>}
          </ul>
          <p className="text-xs text-neutral-400">This checklist covers metadata quality only; it does not predict search rankings.</p>
        </fieldset>
      </aside>

      <MediaPicker
        open={picker}
        articleId={articleId ?? undefined}
        onClose={() => setPicker(false)}
        onPick={(m) => {
          setPicker(false);
          setFeatured(m);
          set("featured_image_id", m.id);
          if (!form.featured_image_alt) set("featured_image_alt", (form.language === "bn" ? m.alt_text_bn : m.alt_text_en) ?? "");
        }}
      />
    </div>
  );
}
