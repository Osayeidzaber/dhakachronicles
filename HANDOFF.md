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

## 3. Current state (what's done)

| Area | Status | Where |
|---|---|---|
| Next.js scaffold | done | `src/app` (still the default page) |
| Core DB schema | done | `supabase/migrations/20261113000001_core_schema.sql` |
| RLS + role helpers | done | `supabase/migrations/20261113000002_rls_policies.sql` |
| Workflow SQL functions + default settings | done | `supabase/migrations/20261113000003_workflow_functions.sql` |
| Seed categories (bn/en) | done | `supabase/seed.sql` |
| Supabase Cron jobs | written, run manually after deploy | `supabase/cron.sql` |
| Server-only env + Supabase clients | done | `src/lib/env.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts` |
| Session refresh + /admin guard | done | `src/proxy.ts` |
| First-admin provisioning | done | `scripts/provision-admin.mjs` (`npm run provision-admin -- email "Name"`) |
| DB tests (11, passing) | done | `tests/db.test.ts` (runs migrations in PGlite) |
| Supabase setup guide | done | `SUPABASE_SETUP.md` |
| Real Supabase project connected | **NOT done** — waiting for owner's credentials | |

Everything else (auth UI, CMS, editor, media, Instagram, SEO, public site) is **not started**. See `MASTER_TODO.md`.

### Verify the current state
```bash
npm install
npm test          # 11 DB tests in PGlite (no Docker needed)
npm run typecheck
npm run lint
```
There is no Docker/Postgres on the original machine; PGlite stubs Supabase's `auth` schema, roles and `auth.uid()`.

---

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

## 5. Planned architecture for the rest (follow this)

```
src/
  app/
    (public)/[lang]/...        # bn | en public pages (Server Components)
    admin/...                  # CMS dashboard (auth required)
    login/
    api/cron/publish, api/cron/instagram-sync, api/media/presign, api/media/finalize,
    api/instagram/connect, api/instagram/callback
    sitemap.ts, robots.ts, news-sitemap.xml, [lang]/rss.xml
  lib/
    env.ts, supabase/{server,admin}.ts
    auth/        # getSession, requireRole
    articles/    # queries.ts (public reads), service.ts (workflow actions), validation.ts (zod)
    media/       # r2.ts, images.ts (sharp variants), validation (magic bytes)
    instagram/   # oauth.ts, client.ts (Graph API), sync.ts, crypto.ts
    seo/         # metadata.ts, jsonld.ts, validator.ts, ai.ts (optional provider)
  components/public, components/admin
```

- **Media upload flow:** server issues presigned PUT to `tmp/` in R2 → browser uploads → `finalize` endpoint
  downloads, validates real bytes (Sharp), creates WebP/AVIF responsive variants under
  `articles/YYYY/MM/<article-id>/`, `authors/`, `categories/`, `branding/`, saves `media` row, deletes tmp.
- **Instagram flow:** Instagram Login (Business Login) OAuth with `oauth_states` CSRF → exchange for long-lived
  token → fetch `/me` and **reject unless username == `dhakachronicles`** (set status `username_mismatch`, don't
  sync) → paginate `/me/media` (fields incl. children for carousels) → skip known `instagram_media_id`s →
  download images server-side → R2 → `create_instagram_draft` (caption preserved verbatim, permalink, timestamp).
  Configurable historical import (count, date range, page limit). Retries with backoff. Refresh long-lived token
  before expiry. Never auto-publish. Document the Meta app setup (permissions, app review, test users).
- **SEO:** `generateMetadata` per page, canonical + hreflang via translation group, NewsArticle/Breadcrumb/
  Organization JSON-LD, sitemap, Google News sitemap (last 48h published), RSS per language, robots.
  SEO validator (missing meta, lengths, alt text, duplicate slug). Optional AI SEO generator behind an API key —
  never required for publishing. Don't claim scores guarantee rankings.
- **Revalidation:** after publish/unpublish/edit call `revalidatePath`/`revalidateTag` for affected pages.

---

## 6. Still-to-create docs
`README.md` (still create-next-app default — replace), `DECISIONS.md`, `CHANGELOG.md`, `CONTRIBUTING.md`.
Remaining required tests: auth, role permissions in app layer, article create/edit, publication, public access,
R2 upload handling, Instagram duplicate detection (app layer), SEO metadata, sitemap.

## 7. Environment variables (`.env.example`)
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (all server-only), `SITE_URL`,
`CRON_SECRET`, `TOKEN_ENCRYPTION_KEY`. Still to add: R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`), Instagram (`INSTAGRAM_APP_ID`,
`INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`), optional AI key.

## 8. Next steps (in order)
1. When the owner gives Supabase credentials: they fill `.env.local` themselves (don't ask them to paste keys in
   chat), then `npx supabase link --project-ref …` → `npx supabase db push` → run seed → `npm run provision-admin`.
2. Milestone 2: login page, `requireRole`, team management, audit helper.
3. Continue through `MASTER_TODO.md`, ticking items off and committing as the owner (no AI attribution).
