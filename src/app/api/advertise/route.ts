import { jsonHandler } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createPublicClient } from "@/lib/supabase/server";
import { adEnquirySchema } from "@/lib/articles/validation";
import { AppError } from "@/lib/errors";
import { notifyActivity } from "@/lib/discord";
import { siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/** "Advertise with us" form: becomes a lead in Admin → Brand deals and pings the activity channel. */
export const POST = jsonHandler(async (req: Request) => {
  const parsed = adEnquirySchema.safeParse(await req.json());
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Check the form", "VALIDATION");
  const f = parsed.data;
  if (f.website) return null; // honeypot filled: quietly accept and drop
  await rateLimit(`advertise:${await clientIp()}`, 3, 600);
  const { data: id, error } = await createPublicClient().rpc("submit_ad_enquiry", {
    p_name: f.name,
    p_company: f.company,
    p_email: f.email,
    p_phone: f.phone,
    p_format: f.format,
    p_budget: f.budget,
    p_message: f.message,
  });
  if (error) throw new AppError("We could not send that. Please message us on Instagram instead.", "INTERNAL");
  await notifyActivity({
    action: "ad.enquiry",
    actor: `${f.name} (website)`,
    targetType: "brand_deal",
    targetId: typeof id === "string" ? id : null,
    metadata: { company: f.company, interested_in: f.format || "—", budget: f.budget || "—", phone: f.phone || "—", message: f.message.slice(0, 300) || "—" },
    adminUrl: `${siteUrl()}/admin/brand-deals?deal=${id}`,
  });
  return null;
});
