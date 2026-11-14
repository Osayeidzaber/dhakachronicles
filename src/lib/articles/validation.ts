import { z } from "zod";
import { ARTICLE_SLUG_RE, ASCII_SLUG_RE } from "@/lib/content/slug";

const nullableText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null));

const uuidOrNull = z
  .union([z.uuid(), z.literal("")])
  .nullish()
  .transform((v) => (v ? v : null));

const tiptapNode: z.ZodType<{ type: string }> = z.lazy(() =>
  z
    .object({
      type: z.string().max(50),
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(tiptapNode).optional(),
      text: z.string().optional(),
      marks: z.array(z.object({ type: z.string(), attrs: z.record(z.string(), z.unknown()).optional() })).optional(),
    })
    .loose(),
);

export const tiptapDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(tiptapNode).optional(),
});

export const articleSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(ARTICLE_SLUG_RE, "Slug may only contain letters, numbers and single hyphens.");

export const articleInputSchema = z.object({
  language: z.enum(["bn", "en"]),
  title: z.string().trim().min(1, "Title is required").max(300),
  subtitle: nullableText(500),
  slug: articleSlugSchema,
  excerpt: nullableText(1000),
  content: tiptapDocSchema,
  featured_image_id: uuidOrNull,
  featured_image_alt: nullableText(300),
  category_id: uuidOrNull,
  author_id: uuidOrNull,
  tag_ids: z.array(z.uuid()).max(30).default([]),
  is_breaking: z.boolean().default(false),
  is_featured: z.boolean().default(false),
  seo_title: nullableText(200),
  seo_description: nullableText(400),
  focus_keyword: nullableText(100),
  canonical_url: z
    .union([z.url({ protocol: /^https?$/ }), z.literal("")])
    .nullish()
    .transform((v) => (v ? v : null)),
  og_title: nullableText(200),
  og_description: nullableText(400),
  og_image_id: uuidOrNull,
});

export type ArticleInput = z.infer<typeof articleInputSchema>;

export const transitionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }),
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("schedule"), scheduled_at: z.iso.datetime({ offset: true }) }),
  z.object({ action: z.literal("unpublish") }),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("restore") }),
  z.object({ action: z.literal("return_to_draft") }),
]);
export type TransitionInput = z.infer<typeof transitionSchema>;

export const categorySchema = z.object({
  slug: z.string().trim().regex(ASCII_SLUG_RE, "Use lowercase letters, numbers and hyphens."),
  name_en: z.string().trim().min(1).max(100),
  name_bn: z.string().trim().min(1).max(100),
  description_en: nullableText(500),
  description_bn: nullableText(500),
  sort_order: z.coerce.number().int().min(0).max(1000).default(0),
});

export const tagSchema = z.object({
  slug: z.string().trim().regex(ASCII_SLUG_RE, "Use lowercase letters, numbers and hyphens."),
  name_en: z.string().trim().min(1).max(100),
  name_bn: z.string().trim().min(1).max(100),
});

export const authorSchema = z.object({
  slug: z.string().trim().regex(ASCII_SLUG_RE, "Use lowercase letters, numbers and hyphens."),
  name_en: z.string().trim().min(1).max(120),
  name_bn: z.string().trim().min(1).max(120),
  bio_en: nullableText(2000),
  bio_bn: nullableText(2000),
  email: z
    .union([z.email(), z.literal("")])
    .nullish()
    .transform((v) => (v ? v : null)),
  profile_id: uuidOrNull,
  avatar_media_id: uuidOrNull,
});

export const BRAND_DEAL_STAGES = ["lead", "negotiating", "contracted", "in_production", "published", "cancelled"] as const;

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined(), z.null()])
  .transform((v) => v === "on" || v === "true");

const httpsUrl = z
  .union([z.url({ protocol: /^https$/ }), z.literal("")])
  .nullish()
  .transform((v) => (v ? v : null));

const optionalDate = z
  .union([z.iso.date(), z.literal("")])
  .nullish()
  .transform((v) => (v ? v : null));

export const brandDealSchema = z
  .object({
    brand_name: z.string().trim().min(1).max(200),
    contact_name: nullableText(200),
    contact_email: z
      .union([z.email(), z.literal("")])
      .nullish()
      .transform((v) => (v ? v : null)),
    stage: z.enum(BRAND_DEAL_STAGES).default("lead"),
    deliverables: nullableText(2000),
    fee_amount: z
      .union([z.literal(""), z.coerce.number().min(0).max(9_999_999_999)])
      .nullish()
      .transform((v) => (v === "" || v == null ? null : v)),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("BDT"),
    due_date: z
      .union([z.iso.date(), z.literal("")])
      .nullish()
      .transform((v) => (v ? v : null)),
    owner_id: uuidOrNull,
    article_id: uuidOrNull,
    brief_approved: checkbox,
    brand_signoff: checkbox,
    invoice_sent: checkbox,
    paid: checkbox,
    notes: nullableText(5000),
    show_on_site: checkbox,
    logo_media_id: uuidOrNull,
    website_url: httpsUrl,
    public_blurb: nullableText(300),
    proof_url: httpsUrl,
  })
  .refine((d) => !d.paid || d.invoice_sent, { message: "Mark the invoice as sent before marking it paid.", path: ["paid"] });

export type BrandDealInput = z.infer<typeof brandDealSchema>;

export const teamMemberSchema = z.object({
  name_en: z.string().trim().min(1, "Add a name").max(120),
  name_bn: nullableText(120),
  role_en: nullableText(120),
  role_bn: nullableText(120),
  bio_en: nullableText(600),
  bio_bn: nullableText(600),
  photo_media_id: uuidOrNull,
  author_id: uuidOrNull,
  instagram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, ""))
    .pipe(z.union([z.literal(""), z.string().regex(/^[A-Za-z0-9._]{1,30}$/, "Instagram handle looks wrong")]))
    .nullish()
    .transform((v) => (v ? v : null)),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  visible: checkbox,
});
export type TeamMemberInput = z.infer<typeof teamMemberSchema>;

export const AD_SIZES = ["wide", "mobile", "square"] as const;
export const adSchema = z
  .object({
    name: z.string().trim().min(1, "Give the ad a name").max(160),
    advertiser: z.string().trim().min(1, "Add the advertiser").max(160),
    brand_deal_id: uuidOrNull,
    link_url: z.url({ protocol: /^https$/, message: "The link must start with https://" }),
    placement: z.enum(["home", "article", "both"]).default("home"),
    starts_on: optionalDate,
    ends_on: optionalDate,
    active: checkbox,
    creative_wide: uuidOrNull,
    creative_mobile: uuidOrNull,
    creative_square: uuidOrNull,
  })
  .refine((d) => d.creative_wide || d.creative_mobile || d.creative_square, { message: "Upload at least one image.", path: ["creative_wide"] })
  .refine((d) => !d.starts_on || !d.ends_on || d.starts_on <= d.ends_on, { message: "The end date is before the start date.", path: ["ends_on"] });
export type AdInput = z.infer<typeof adSchema>;

export const adEnquirySchema = z.object({
  name: z.string().trim().min(1, "Add your name").max(200),
  company: z.string().trim().min(1, "Add your company or brand").max(200),
  email: z.email("Add a valid email"),
  phone: z.string().trim().max(40).optional().default(""),
  format: z.string().trim().max(200).optional().default(""),
  budget: z.string().trim().max(100).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
  website: z.string().max(0).optional(), // honeypot: real people leave it empty
});

export const errorReportSchema = z.object({
  articleId: z.uuid(),
  kind: z.enum(["fact", "typo", "translation", "image", "other"]),
  message: z.string().trim().min(5, "Tell us a little more").max(1500),
  email: z.union([z.email(), z.literal("")]).optional(),
  website: z.string().max(0).optional(),
});
