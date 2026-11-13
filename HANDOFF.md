# HANDOFF — read this first (for the next AI agent / next device)

The owner is switching devices. This file holds the full context so you can continue without the
previous conversation. Also read `AGENTS.md` (rules) and `MASTER_TODO.md` (checklist, keep it updated).

---

## 1. What this project is

**Dhaka Chronicles** (publication brand: *BNews*) is a production-ready, **bilingual (Bangla `bn` + English `en`)
digital news publication**. The main content source is the Instagram account **`@dhakachronicles`**
(https://www.instagram.com/dhakachronicles/). Instagram posts are imported as **drafts** that editors turn into
real, verified articles.

### Your job vs. the owner's job
- **You build:** backend, database, auth/roles, CMS/admin dashboard, editorial workflow, media (R2),
  Instagram integration, SEO engine, and a **basic, functional** public frontend.
- **The owner builds later:** the final public frontend design. So keep the public UI simple and keep
  data access/business logic separate from UI so the frontend can be redesigned without touching the backend.
- Priority order: 1) backend & DB 2) auth & permissions 3) CMS & workflow 4) media 5) bilingual
  6) Instagram 7) SEO 8) basic public frontend.

### Owner's explicit preferences (important)
- **Frontend and backend in the same project** — one Next.js app. No separate servers or microservices.
- **Supabase URL and publishable key must NOT be visible in the browser.** They are server-only env vars
  (no `NEXT_PUBLIC_`). All Supabase calls go through the Next.js server; the browser only gets httpOnly cookies.
  Don't add browser-side Supabase clients.
- **Commits are authored only by the owner** — do NOT add `Co-Authored-By: Claude` or any AI attribution
  lines to commits or PRs.
- Owner will provide Supabase credentials later; until then keep things buildable without them.
- Actually implement things; don't just write plans. Don't fake integrations or use mock data in place of real
  functionality. Clearly mark what needs external credentials.

---

## 2. Tech stack (required)
Next.js **16** App Router (has breaking changes — read `node_modules/next/dist/docs/` before coding; e.g.
`middleware` is now `proxy.ts`, request APIs/params are async, `revalidateTag(tag, profile)` needs 2 args),
TypeScript strict, Tailwind v4, Supabase (Postgres, Auth, RLS, Cron), Cloudflare R2 (S3 SDK, presigned URLs),
Instagram Graph API (official Instagram Login only — no scraping), Tiptap (JSON content), Sharp, Zod v4,
Vitest, Vercel-compatible.

---

## 3. Current state (updated 2026-11-13)

All 8 milestones are **implemented**. See `MASTER_TODO.md` for details and `README.md` for the architecture.
typecheck, lint, 70 tests (`npm test`, including DB/RLS tests in PGlite) and `npm run build` all pass.

Still **not connected** (needs the owner's credentials): the Supabase project, the R2 bucket, the Meta/Instagram app,
and Vercel deployment plus `supabase/cron.sql`. Setup guides: `SUPABASE_SETUP.md`, `docs/R2_SETUP.md`,
`docs/INSTAGRAM_SETUP.md`, `docs/DEPLOYMENT.md`.

Next.js note: `cacheComponents` is OFF on purpose (DECISIONS D-008). Pages use `revalidate` and publishing calls `revalidatePath`.
There are two root layouts: `src/app/[lang]/layout.tsx` (public, sets `<html lang>`) and `src/app/(cms)/layout.tsx` (admin/login).

## 4. Database design (key decisions)

- **Articles: one row per language.** Translations share `translation_group_id`.
  `unique(language, slug)` and `unique(translation_group_id, language)`. Slugs allow Bangla characters.
  Each translation has its own status, SEO fields, featured image/alt, so one can be published without the other.
- **Content** is Tiptap JSON in `content`; `content_text` (plain text, filled by the app) feeds the generated
  `search_vector` (`simple` config, since Postgres has no Bangla config).
- **Authors** are a separate `authors` table (public bylines, bn/en names), optionally linked to a staff
  `profiles` row. `articles.author_id` → authors; `articles.created_by` → profiles (used for writer ownership).
- **Roles:** `profiles.role` = `admin | editor | writer | NULL`. NULL = no CMS access. The role comes **only**
  from `auth.users.raw_app_meta_data.role` (service-role-only), set by the `handle_new_user` trigger.
  Public sign-up is disabled. A trigger blocks role changes by non-admins and self-role changes.
- **RLS summary:** anon sees only `published` articles with `published_at <= now()`, plus categories/tags/authors/
  ready media/public settings. Writers: insert/update own articles only in `draft`/`pending_review`; a trigger
  strips editorial flags (breaking/featured/publish dates) from writer writes. Editors: all articles, taxonomy,
  authors. Admins: everything incl. settings, audit logs, deletes. `instagram_tokens`, `oauth_states`,
  `rate_limits` have RLS on with **no policies** → service role only.
- **Statuses:** `draft, pending_review, scheduled, published, archived`. Trigger `articles_before_write` sets
  `published_at`, `first_published_at`, `submitted_at`, `archived_at` accurately.
- **Revisions:** trigger `articles_capture_revision` snapshots the old row on status/title change, and on content
  change at most every 10 minutes (so autosave doesn't flood).
- **Media delete guard:** trigger refuses to delete media used by a published/scheduled article (featured, OG,
  gallery, or referenced in content JSON by id). Store media id in Tiptap image attrs so this works.
- **Scheduled publishing:** `publish_due_articles()` (SKIP LOCKED, service role) is called by
  `POST /api/cron/publish` (to build; check `Authorization: Bearer CRON_SECRET`), which then revalidates caches.
  Supabase Cron calls it every minute via `pg_net` (`supabase/cron.sql`).
- **Instagram:** `instagram_accounts` (ig_user_id, username, status incl. `username_mismatch`, auto_import,
  sync timestamps), `instagram_tokens` (AES-256-GCM encrypted with `TOKEN_ENCRYPTION_KEY`),
  `instagram_imports` (`instagram_media_id` UNIQUE = duplicate protection, status, attempts, next_retry_at),
  `instagram_sync_runs` (history; partial unique index = only one running sync per account).
  `create_instagram_draft(...)` atomically creates the draft article + gallery + links the import + notifies editors.
- **Other:** `notifications` (per user, fan-out via `notify_editors`), `audit_logs`, `site_settings`
  (jsonb, `is_public`), `article_daily_views` + `record_article_view()`, `rate_limits` + `rate_limit_hit()`
  (DB-based, works on serverless), `job_runs`.
- Default settings seeded: site name (bn/en), default language `bn`, social links, SEO defaults,
  `instagram.expected_username = "dhakachronicles"`, `auto_publish = false`.

---

## 5. Architecture
See `README.md` (module map) and `DECISIONS.md`.

## 6. Docs
All the required docs exist. Keep `MASTER_TODO.md` and `CHANGELOG.md` updated.

## 7. Environment variables
See `.env.example`. Every variable is server-only.

## 8. Next steps (in order)
1. When the owner gives Supabase credentials: they fill `.env.local` themselves (don't ask them to paste keys in
   chat), then `npx supabase link --project-ref …` → `npx supabase db push` → run seed → `npm run provision-admin`.
2. Milestone 2: login page, `requireRole`, team management, audit helper.
3. Continue through `MASTER_TODO.md`, ticking items off and committing as the owner (no AI attribution).
