import Link from "next/link";
import { HoldSubmit } from "@/components/admin/form-controls";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { can, canEditArticle } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { aiSeoAvailable } from "@/lib/seo/ai";
import { ArticleEditor } from "@/components/admin/editor/article-editor";
import { Flash, PageHeader, StatusBadge, fmt } from "@/components/admin/ui";
import { loadEditorOptions } from "../load";
import { translationAvailable } from "@/lib/translate";
import { SubmitButton } from "@/components/admin/submit-button";
import { createTranslationAction, deleteArticleAction, restoreRevisionAction } from "../../actions";
import type { Article, ArticleStatus, Lang, Media } from "@/lib/db/types";

export const metadata = { title: "Edit article" };

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await requirePageSession();
  const supabase = await createClient();

  const { data } = await supabase.from("articles").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const article = data as Article;

  const [options, { data: tagRows }, { data: featured }, { data: siblings }, { data: revisions }, { data: igImport }] = await Promise.all([
    loadEditorOptions(),
    supabase.from("article_tags").select("tag_id").eq("article_id", id),
    article.featured_image_id
      ? supabase.from("media").select("id, public_url, variants").eq("id", article.featured_image_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("articles").select("id, language, title, status").eq("translation_group_id", article.translation_group_id).neq("id", id),
    supabase.from("article_revisions").select("id, reason, created_at, editor:profiles(full_name)").eq("article_id", id).order("created_at", { ascending: false }).limit(15),
    article.source_type === "instagram"
      ? supabase.from("instagram_imports").select("caption, permalink, media_timestamp, instagram_media_id").eq("article_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const editable = canEditArticle(session.profile.role, session.userId, article);
  const hasBothLanguages = (siblings ?? []).length > 0;
  const other: Lang = article.language === "bn" ? "en" : "bn";

  return (
    <>
      <PageHeader title={article.language === "bn" ? "Edit article (Bangla)" : "Edit article (English)"}>
        <Link href="/admin/articles" className="btn">
          Back to list
        </Link>
      </PageHeader>
      <Flash ok={sp.ok} error={sp.error} />

      <ArticleEditor
        article={article}
        initialLanguage={article.language}
        {...options}
        tagIds={(tagRows ?? []).map((t: { tag_id: string }) => t.tag_id)}
        featuredImage={featured as Pick<Media, "id" | "public_url" | "variants"> | null}
        canPublish={can(session.profile.role, "article.publish")}
        canEdit={editable}
        aiAvailable={aiSeoAvailable()}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="card">
          <h2 className="mb-2 font-semibold">Translations</h2>
          <ul className="space-y-1 text-sm">
            {(siblings ?? []).map((s: { id: string; language: Lang; title: string; status: ArticleStatus }) => (
              <li key={s.id}>
                <span className="uppercase">{s.language}</span> ·{" "}
                <Link className="underline" href={`/admin/articles/${s.id}`} lang={s.language}>
                  {s.title}
                </Link>{" "}
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
          {!hasBothLanguages && can(session.profile.role, "article.create") && (
            <div className="mt-2 flex flex-wrap gap-2">
              {translationAvailable() && (
                <form action={createTranslationAction.bind(null, id, true)}>
                  <SubmitButton className="btn btn-primary" pendingLabel="Translating… (up to a minute)">
                    Translate to {other === "bn" ? "Bangla" : "English"} automatically
                  </SubmitButton>
                </form>
              )}
              <form action={createTranslationAction.bind(null, id, false)}>
                <SubmitButton className="btn" pendingLabel="Creating…">
                  Write {other === "bn" ? "Bangla" : "English"} version by hand
                </SubmitButton>
              </form>
            </div>
          )}
          <p className="mt-2 text-xs text-neutral-500">Each language is published independently.</p>
        </section>

        <section className="card">
          <h2 className="mb-2 font-semibold">Revisions</h2>
          {!revisions?.length ? (
            <p className="text-sm text-neutral-500">No revisions yet. They are saved automatically before significant edits.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {revisions.map((r: { id: string; reason: string; created_at: string; editor: { full_name: string } | { full_name: string }[] | null }) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span>
                    {fmt(r.created_at)} · {r.reason}
                    <span className="text-neutral-500"> · {(Array.isArray(r.editor) ? r.editor[0] : r.editor)?.full_name || "system"}</span>
                  </span>
                  {editable && (
                    <form action={restoreRevisionAction.bind(null, id, r.id)}>
                      <button className="btn">Restore</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="mb-2 font-semibold">Info</h2>
          <dl className="grid grid-cols-2 gap-1 text-sm">
            <dt className="text-neutral-500">Created</dt>
            <dd>{fmt(article.created_at)}</dd>
            <dt className="text-neutral-500">First published</dt>
            <dd>{fmt(article.first_published_at)}</dd>
            <dt className="text-neutral-500">Published</dt>
            <dd>{fmt(article.published_at)}</dd>
            <dt className="text-neutral-500">Scheduled</dt>
            <dd>{fmt(article.scheduled_at)}</dd>
            <dt className="text-neutral-500">Submitted</dt>
            <dd>{fmt(article.submitted_at)}</dd>
          </dl>
          {can(session.profile.role, "article.delete") && (
            <form action={deleteArticleAction.bind(null, id)} className="mt-4">
              <HoldSubmit className="" doneLabel="Deleting…">Hold to delete permanently</HoldSubmit>
            </form>
          )}
        </section>

        {igImport && (
          <section className="card lg:col-span-3">
            <h2 className="mb-2 font-semibold">Original Instagram source</h2>
            <p className="mb-2 text-xs text-neutral-500">
              Posted {fmt(igImport.media_timestamp)} ·{" "}
              {igImport.permalink && (
                <a href={igImport.permalink} target="_blank" rel="noreferrer noopener" className="underline">
                  View on Instagram
                </a>
              )}
            </p>
            <pre className="max-h-80 overflow-auto rounded bg-neutral-50 p-3 text-sm whitespace-pre-wrap">{igImport.caption || "(no caption)"}</pre>
            <p className="mt-2 text-xs text-neutral-500">This is unverified source material. Verify, rewrite and add reporting before publishing.</p>
          </section>
        )}
      </div>
    </>
  );
}
