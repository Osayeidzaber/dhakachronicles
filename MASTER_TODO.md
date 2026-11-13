# MASTER TODO — Dhaka Chronicles

Bilingual (Bangla/English) news platform. One Next.js project (frontend + backend together),
Supabase (Postgres, Auth, RLS, Cron), Cloudflare R2, Instagram Graph API.

Legend: [x] done · [ ] to do · [~] needs external credentials

## Milestone 1 — Database & Supabase foundation
- [x] Next.js 16 + TypeScript strict + Tailwind scaffold
- [x] Core schema migration (profiles, articles, categories, tags, authors, media, article_media, article_tags, revisions, instagram_*, notifications, audit_logs, site_settings, analytics, rate_limits, job_runs)
- [x] RLS policies + role helpers (admin / editor / writer)
- [x] Workflow functions (scheduled publishing, Instagram draft creation, tag replacement)
- [x] Seed categories, Supabase Cron script
- [x] Server-only Supabase clients (URL & keys never sent to the browser)
- [x] Admin provisioning script (no public sign-up)
- [x] DB tests in PGlite (slugs, translations, scheduling, RLS, duplicate imports)
- [~] Link real Supabase project and `supabase db push`
- [~] Provision first admin

## Milestone 2 — Auth & permissions
- [ ] Login / logout pages, session handling
- [ ] Server-side permission helpers (requireRole)
- [ ] Team management: invite users, change roles
- [ ] Audit logging helper

## Milestone 3 — CMS & editorial workflow
- [ ] Article list (search, filters, language/status, bulk actions)
- [ ] Tiptap editor (headings, lists, quotes, links, images + captions, embeds, HR), autosave
- [ ] Workflow actions: save, submit, approve, publish, schedule, unpublish, archive, restore
- [ ] Translation linking (create bn/en version), revisions view
- [ ] Categories, tags, authors CRUD
- [ ] Cron endpoint `/api/cron/publish` + cache revalidation

## Milestone 4 — Media (Cloudflare R2)
- [ ] Presigned upload → finalize (validate bytes, Sharp variants, WebP/AVIF)
- [ ] Media library: browse, preview, metadata, delete (guarded)
- [~] R2 bucket, API token, custom domain

## Milestone 5 — Instagram (@dhakachronicles)
- [ ] Instagram Login OAuth, encrypted token storage, refresh
- [ ] Username check (must be `dhakachronicles`)
- [ ] Sync: pagination, carousel children, duplicate detection, R2 upload, draft creation
- [ ] Historical import options, retries, admin UI
- [~] Meta developer app + permissions

## Milestone 6 — SEO
- [ ] Metadata, OG, canonical, hreflang
- [ ] NewsArticle / Breadcrumb / Organization JSON-LD
- [ ] sitemap.xml, Google News sitemap, RSS, robots.txt
- [ ] SEO validator, optional AI SEO generator

## Milestone 7 — Basic public frontend
- [ ] /bn and /en: home, breaking, latest, featured, category, article, author, search
- [ ] Language switcher, pagination, loading/error/empty states

## Milestone 8 — Docs & release
- [ ] README, DECISIONS, CHANGELOG, CONTRIBUTING
- [ ] Full test suite, lint, typecheck, production build
- [ ] Vercel deployment guide
