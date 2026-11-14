// Hand-written row types for the tables the app reads. Keep in sync with supabase/migrations.
export type AppRole = "admin" | "editor" | "writer";
export type Lang = "bn" | "en";
export type ArticleStatus = "draft" | "pending_review" | "scheduled" | "published" | "archived";

export const ARTICLE_STATUSES: readonly ArticleStatus[] = [
  "draft",
  "pending_review",
  "scheduled",
  "published",
  "archived",
];
export const APP_ROLES: readonly AppRole[] = ["admin", "editor", "writer"];

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: AppRole | null;
  is_active: boolean;
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaVariant {
  key: string;
  url: string;
  width: number;
  height: number;
  format: "webp" | "avif";
  size: number;
}

export interface Media {
  id: string;
  r2_key: string;
  public_url: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  alt_text_en: string | null;
  alt_text_bn: string | null;
  caption: string | null;
  credit: string | null;
  folder: string;
  status: "pending" | "ready" | "failed";
  variants: MediaVariant[];
  source: "upload" | "instagram";
  uploaded_by: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_bn: string;
  description_en: string | null;
  description_bn: string | null;
  sort_order: number;
}

export interface Tag {
  id: string;
  slug: string;
  name_en: string;
  name_bn: string;
}

export interface Author {
  id: string;
  profile_id: string | null;
  slug: string;
  name_en: string;
  name_bn: string;
  bio_en: string | null;
  bio_bn: string | null;
  avatar_media_id: string | null;
  email: string | null;
  social_links: Record<string, string>;
}

export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
}

export interface TiptapDoc {
  type: "doc";
  content?: TiptapNode[];
}

export interface Article {
  id: string;
  translation_group_id: string;
  language: Lang;
  title: string;
  subtitle: string | null;
  slug: string;
  excerpt: string | null;
  content: TiptapDoc;
  content_text: string;
  featured_image_id: string | null;
  featured_image_alt: string | null;
  category_id: string | null;
  author_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  reviewed_by: string | null;
  status: ArticleStatus;
  is_breaking: boolean;
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  focus_keyword: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_id: string | null;
  source_type: "original" | "instagram";
  source_url: string | null;
  published_at: string | null;
  first_published_at: string | null;
  scheduled_at: string | null;
  submitted_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstagramAccount {
  id: string;
  ig_user_id: string;
  username: string;
  account_type: string | null;
  status: "connected" | "disconnected" | "token_expired" | "error" | "username_mismatch";
  auto_import: boolean;
  token_expires_at: string | null;
  token_refreshed_at: string | null;
  last_synced_at: string | null;
  last_successful_sync_at: string | null;
  last_error: string | null;
  initial_import_completed: boolean;
}

export interface InstagramImport {
  id: string;
  instagram_media_id: string;
  media_type: string;
  caption: string | null;
  permalink: string | null;
  media_timestamp: string | null;
  status: "pending" | "processing" | "imported" | "failed" | "skipped";
  article_id: string | null;
  error_message: string | null;
  attempts: number;
  next_retry_at: string | null;
  imported_at: string | null;
  created_at: string;
}

export interface SyncRun {
  id: string;
  trigger: string;
  status: string;
  fetched_count: number;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}

export type BrandDealStage = "lead" | "negotiating" | "contracted" | "in_production" | "published" | "cancelled";

export interface BrandDeal {
  id: string;
  brand_name: string;
  contact_name: string | null;
  contact_email: string | null;
  stage: BrandDealStage;
  deliverables: string | null;
  fee_amount: number | null;
  currency: string;
  due_date: string | null;
  owner_id: string | null;
  article_id: string | null;
  brief_approved: boolean;
  brand_signoff: boolean;
  invoice_sent: boolean;
  paid: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  show_on_site: boolean;
  logo_media_id: string | null;
  website_url: string | null;
  public_blurb: string | null;
  proof_url: string | null;

}

export interface TeamMember {
  id: string;
  name_en: string;
  name_bn: string | null;
  role_en: string | null;
  role_bn: string | null;
  bio_en: string | null;
  bio_bn: string | null;
  photo_media_id: string | null;
  author_id: string | null;
  instagram: string | null;
  sort_order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export type AdSize = "wide" | "mobile" | "square";
export interface Ad {
  id: string;
  name: string;
  advertiser: string;
  brand_deal_id: string | null;
  link_url: string;
  placement: "home" | "article" | "both";
  starts_on: string | null;
  ends_on: string | null;
  active: boolean;
  report_token: string;
  created_at: string;
  updated_at: string;
}
