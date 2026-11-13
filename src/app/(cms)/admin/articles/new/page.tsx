import { requirePageSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { aiSeoAvailable } from "@/lib/seo/ai";
import { ArticleEditor } from "@/components/admin/editor/article-editor";
import { PageHeader } from "@/components/admin/ui";
import { loadEditorOptions } from "../load";

export const metadata = { title: "New article" };

export default async function NewArticlePage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  const session = await requirePageSession("article.create");
  const options = await loadEditorOptions();
  return (
    <>
      <PageHeader title="New article" />
      <ArticleEditor
        article={null}
        initialLanguage={lang === "en" ? "en" : "bn"}
        {...options}
        tagIds={[]}
        featuredImage={null}
        canPublish={can(session.profile.role, "article.publish")}
        canEdit
        aiAvailable={aiSeoAvailable()}
      />
    </>
  );
}
