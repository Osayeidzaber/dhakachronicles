import { HighlightButton } from "@/components/admin/highlight-button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { readHighlight } from "@/lib/highlight";
import Link from "next/link";
import { requirePageSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { ARTICLE_STATUSES, type ArticleStatus, type Lang } from "@/lib/db/types";
import { Empty, Flash, PageHeader, Pager, StatusBadge, fmt } from "@/components/admin/ui";
import { bulkArticlesAction } from "../actions";
import { publicMessage } from "@/lib/errors";

export const metadata = { title: "Articles" };
const PAGE_SIZE = 25;

interface Search {
  q?: string;
  lang?: string;
  status?: string;
  category?: string;
  source?: string;
  page?: string;
  ok?: string;
  error?: string;
}

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const session = await requirePageSession();
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.page) || 1);

  let q = supabase
    .from("articles")
    .select("id, title, language, slug, status, is_featured, updated_at, published_at, scheduled_at, translation_group_id, source_type, category:categories(name_en), creator:profiles!articles_created_by_fkey(full_name)", { count: "exact" });
  if (sp.q?.trim()) q = q.ilike("title", `%${sp.q.trim().replace(/[%_]/g, "")}%`);
  if (sp.lang === "bn" || sp.lang === "en") q = q.eq("language", sp.lang as Lang);
  if (sp.status && (ARTICLE_STATUSES as readonly string[]).includes(sp.status)) q = q.eq("status", sp.status as ArticleStatus);
  if (sp.category) q = q.eq("category_id", sp.category);
  if (sp.source === "instagram") q = q.eq("source_type", "instagram");
  const { data, count, error } = await q.order("updated_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const { data: categories } = await supabase.from("categories").select("id, name_en").order("name_en");

  const rows = (data ?? []) as unknown as {
    id: string;
    title: string;
    language: Lang;
    slug: string;
    status: ArticleStatus;
    is_featured: boolean;
    updated_at: string;
    published_at: string | null;
    scheduled_at: string | null;
    source_type: string;
    category: { name_en: string } | null;
    creator: { full_name: string } | null;
  }[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([k, v]) => v && !["ok", "error"].includes(k)) as [string, string][]);
    return `/admin/articles?${u}`;
  };
  const canPublish = can(session.profile.role, "article.publish");

  const pinned = canPublish ? ((await readHighlight())?.article_id ?? null) : null;
  return (
    <>
      <PageHeader title="Articles">
        <Link href="/admin/articles/new" className="btn btn-primary">
          New article
        </Link>
      </PageHeader>
      <Flash ok={sp.ok} error={sp.error ?? (error ? publicMessage(error) : undefined)} />

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Search titles…" className="input max-w-xs" />
        <select name="lang" defaultValue={sp.lang ?? ""} className="input w-auto">
          <option value="">All languages</option>
          <option value="bn">Bangla</option>
          <option value="en">English</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="input w-auto">
          <option value="">All statuses</option>
          {ARTICLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <select name="category" defaultValue={sp.category ?? ""} className="input w-auto">
          <option value="">All categories</option>
          {(categories ?? []).map((c: { id: string; name_en: string }) => (
            <option key={c.id} value={c.id}>
              {c.name_en}
            </option>
          ))}
        </select>
        <select name="source" defaultValue={sp.source ?? ""} className="input w-auto">
          <option value="">All sources</option>
          <option value="instagram">Instagram imports</option>
        </select>
        <button className="btn">Filter</button>
      </form>

      {rows.length === 0 ? (
        <Empty>No articles match these filters.</Empty>
      ) : (
        <form action={bulkArticlesAction}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select name="action" className="input w-auto" defaultValue="" required>
              <option value="" disabled>
                Bulk action…
              </option>
              {canPublish && <option value="publish">Publish</option>}
              {canPublish && <option value="feature">Feature on home page</option>}
              {canPublish && <option value="unfeature">Remove from Featured</option>}
              {canPublish && <option value="return_to_draft">Move to draft</option>}
              {canPublish && <option value="archive">Archive</option>}
              {can(session.profile.role, "article.delete") && <option value="delete">Delete permanently</option>}
            </select>
            <button className="btn">Apply to selected</button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"><span className="sr-only">Select</span></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Lang</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Writer</TableHead>
                  <TableHead>Updated</TableHead>
                  {canPublish && <TableHead className="w-12"><span className="sr-only">Highlight</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <input type="checkbox" name="ids" value={a.id} aria-label={`Select ${a.title}`} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/articles/${a.id}`} className="font-medium hover:underline" lang={a.language}>
                        {a.title}
                      </Link>
                      {a.source_type === "instagram" && <Badge variant="outline" className="ml-2 align-middle">Instagram</Badge>}
                      {a.is_featured && <Badge className="ml-2 align-middle">★ Featured</Badge>}
                      {a.status === "scheduled" && <div className="text-xs text-muted">Scheduled {fmt(a.scheduled_at)}</div>}
                    </TableCell>
                    <TableCell className="uppercase">{a.language}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell>{a.category?.name_en ?? "—"}</TableCell>
                    <TableCell>{a.creator?.full_name || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmt(a.updated_at)}</TableCell>
                    {canPublish && <TableCell>{a.status === "published" && <HighlightButton articleId={a.id} active={pinned === a.id} compact />}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </form>
      )}
      <Pager page={page} totalPages={totalPages} href={qs} />
    </>
  );
}
