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
  })
  .refine((d) => !d.paid || d.invoice_sent, { message: "Mark the invoice as sent before marking it paid.", path: ["paid"] });

export type BrandDealInput = z.infer<typeof brandDealSchema>;
