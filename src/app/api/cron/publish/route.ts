import { createAdminClient } from "@/lib/supabase/admin";
import { assertCronAuth, jsonHandler } from "@/lib/http";
import { revalidateArticle } from "@/lib/articles/revalidate";
import { log } from "@/lib/logger";
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
    if (published.length) log.info("cron.published", { count: published.length });
    return { published: published.length };
  } catch (err) {
    if (job) {
      await admin
        .from("job_runs")
        .update({ status: "failed", error_message: err instanceof Error ? err.message : String(err), finished_at: new Date().toISOString() })
        .eq("id", job.id);
    }
    throw err;
  }
});
