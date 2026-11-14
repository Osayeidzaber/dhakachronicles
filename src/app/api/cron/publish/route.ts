import { createAdminClient } from "@/lib/supabase/admin";
import { assertCronAuth, jsonHandler } from "@/lib/http";
import { revalidateArticle } from "@/lib/articles/revalidate";
import { log } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { notifyAlert, notifyArticle } from "@/lib/discord";
import { siteUrl } from "@/lib/env";
import { articlePath } from "@/lib/seo/defaults";
import { mapLimit } from "@/lib/concurrency";
import type { Lang } from "@/lib/db/types";

export const dynamic = "force-dynamic";

/** Called every minute by Supabase Cron (pg_net). Publishes due scheduled articles. */
export const POST = jsonHandler(async (req: Request) => {
  assertCronAuth(req);
  const admin = createAdminClient();
  const { data: job } = await admin.from("job_runs").insert({ job_name: "publish_scheduled", status: "running" }).select("id").single();
  try {
    const { data, error } = await admin.rpc("publish_due_articles");
    if (error) throw error;
    const published = (data ?? []) as { id: string; language: Lang; slug: string }[];
    for (const a of published) revalidateArticle(a);
    if (job) {
      await admin
        .from("job_runs")
        .update({ status: "succeeded", result: { published: published.length }, finished_at: new Date().toISOString() })
        .eq("id", job.id);
    }
    if (published.length) {
      log.info("cron.published", { count: published.length });
      // Tell the newsroom about every story that went live on schedule.
      const { data: rows } = await admin.from("articles").select("id, title, excerpt, language, slug, source_type, source_url").in("id", published.map((p) => p.id));
      await mapLimit(rows ?? [], 4, async (a) => {
        const url = `${siteUrl()}${articlePath(a.language as Lang, a.slug as string)}`;
        await audit(null, "article.publish_scheduled", "article", a.id as string, { title: a.title, edition: a.language });
        await notifyArticle({
          kind: "published",
          title: a.title as string,
          excerpt: a.excerpt as string | null,
          language: a.language as Lang,
          actor: "Scheduler",
          url,
          siteUrl: url,
          adminUrl: `${siteUrl()}/admin/articles/${a.id}`,
          sourceUrl: a.source_type === "instagram" ? (a.source_url as string | null) : null,
        });
      });
    }
    return { published: published.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (job) {
      await admin.from("job_runs").update({ status: "failed", error_message: message, finished_at: new Date().toISOString() }).eq("id", job.id);
    }
    await notifyAlert({ title: "Scheduled publishing failed", detail: message.slice(0, 800), severity: "critical", source: "cron.publish", url: `${siteUrl()}/admin/articles?status=scheduled` });
    throw err;
  }
});
