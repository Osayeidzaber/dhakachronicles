import { jsonHandler } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { errorReportSchema } from "@/lib/articles/validation";
import { getCardById } from "@/lib/articles/queries";
import { AppError } from "@/lib/errors";
import { notifyAlert } from "@/lib/discord";
import { siteUrl } from "@/lib/env";
import { articlePath } from "@/lib/seo/defaults";

export const dynamic = "force-dynamic";

const KIND = { fact: "Wrong fact", typo: "Typo or grammar", translation: "Translation problem", image: "Wrong photo or caption", other: "Something else" } as const;

/** Reader "Report an error": sends the report to the alerts channel with links to the story and the editor. */
export const POST = jsonHandler(async (req: Request) => {
  const parsed = errorReportSchema.safeParse(await req.json());
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Check the form", "VALIDATION");
  const r = parsed.data;
  if (r.website) return null; // honeypot
  await rateLimit(`report:${await clientIp()}`, 5, 600);
  const a = await getCardById(r.articleId);
  if (!a) throw new AppError("That story could not be found.", "NOT_FOUND");
  const sent = await notifyAlert({
    title: `Reader report: ${KIND[r.kind]}`,
    detail: `“${r.message}”\n\nStory: ${a.title}`,
    severity: "warning",
    source: "reader report",
    fields: { Type: KIND[r.kind], Language: a.language === "bn" ? "Bangla" : "English", "Reply to": r.email || "Not given", Story: `${siteUrl()}${articlePath(a.language, a.slug)}` },
    url: `${siteUrl()}/admin/articles/${a.id}`,
  });
  if (!sent) throw new AppError("We could not send that right now. Please try again shortly.", "INTERNAL");
  return null;
});
