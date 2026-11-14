import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { altLanguages, isLang, localized, t } from "@/lib/i18n";
import { isConfigured } from "@/lib/public-data";
import { getAuthorBySlug, listLatest } from "@/lib/articles/queries";
import { ArticleListPage, pageParam } from "@/components/public/article-list-page";
import { ResponsiveImage } from "@/components/public/responsive-image";

type Params = Promise<{ lang: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang) || !isConfigured()) return {};
  const a = await getAuthorBySlug(slug);
  if (!a) return {};
  return {
    title: localized(a, "name", lang),
    description: localized(a, "bio", lang) || undefined,
    alternates: { canonical: `/${lang}/author/${slug}`, languages: altLanguages(`/author/${slug}`) },
  };
}

export default async function AuthorPage({ params, searchParams }: { params: Params; searchParams: Promise<{ page?: string }> }) {
  const [{ lang, slug }, sp] = await Promise.all([params, searchParams]);
  if (!isLang(lang)) notFound();
  if (!isConfigured()) return null;
  const author = await getAuthorBySlug(slug);
  if (!author) notFound();
  const page = await listLatest(lang, { authorId: author.id, page: pageParam(sp.page) });
  const name = localized(author, "name", lang);
  const bio = localized(author, "bio", lang);
  return (
    <ArticleListPage
      lang={lang}
      title={name}
      intro={
        <div className="flex items-start gap-4">
          {author.avatar && <ResponsiveImage image={author.avatar} alt={name} sizes="96px" className="h-24 w-24 rounded-full object-cover" />}
          <div>
            {bio && <p className="text-muted">{bio}</p>}
            <p className="mt-2 text-sm font-semibold">{t(lang, "articlesBy")} {name}</p>
          </div>
        </div>
      }
      page={page}
      href={(p) => `/${lang}/author/${slug}?page=${p}`}
    />
  );
}
