# MASTER TODO — Dhaka Chronicles

Legend: [x] done · [ ] to do · [~] waiting on external credentials or approval

## M1 — Database & Supabase
- [x] Schema, RLS, workflow functions, seed, cron script
- [x] Server-only clients, provisioning script
- [x] DB/RLS tests in PGlite
- [~] Link the real project → `npx supabase db push` → seed → `npm run provision-admin`

## M2 — Auth & permissions
- [x] Login/logout (rate-limited), proxy session refresh, /admin guard
- [x] `requireSession` / `requirePageSession`, permission matrix that mirrors RLS
- [x] Team page: invite by email, change roles, deactivate; no self-promotion
- [x] Audit logging

## M3 — CMS & workflow
- [x] Article list: search, language, status, category and source filters, bulk actions, pagination
- [x] Tiptap editor: headings, bold/italic, lists, quotes, links, images with captions/alt, YouTube embeds, horizontal rules
- [x] Autosave, validation, preview, slug duplicate check, unsaved-changes warning
- [x] Workflow: save, submit, approve, publish, schedule, unpublish, archive, restore
- [x] Translations, revisions with restore, delete (admin)
- [x] Categories, tags, authors CRUD; settings; notifications
- [x] Cron publish endpoint + cache revalidation

## M4 — Media (R2)
- [x] Presign → finalize, byte validation, Sharp WebP/AVIF variants, EXIF stripping
- [x] Library: upload (multiple), browse, preview, metadata, delete (guarded)
- [~] R2 bucket, token, custom domain, CORS (`docs/R2_SETUP.md`)

## M5 — Instagram (@dhakachronicles)
- [x] OAuth with Instagram Login, username check, encrypted tokens, refresh
- [x] Sync: pagination, carousels, duplicate detection, R2 upload, drafts, notifications
- [x] Historical import options, retries with backoff, history, auto-import via cron
- [~] Meta app, tester role or App Review (`docs/INSTAGRAM_SETUP.md`)

## M6 — SEO
- [x] Metadata, OG/Twitter, canonical, hreflang
- [x] NewsArticle, Breadcrumb and Organization JSON-LD
- [x] sitemap.xml, news-sitemap.xml, per-language RSS, robots.txt
- [x] SEO validator in the editor; optional AI suggestions

## M7 — Basic public frontend
- [x] /bn and /en: home (breaking, featured, latest), latest, article, category, tag, author, search
- [x] Language switcher, related articles, pagination, loading/error/404 states, view counter

## M8 — Docs & release
- [x] README, DECISIONS, CHANGELOG, CONTRIBUTING, setup guides, .env.example
- [x] typecheck, lint, 70 tests and production build all pass
- [~] Deploy to Vercel + run `supabase/cron.sql`

## Next / nice to have
- [ ] End-to-end tests against a real Supabase project (Playwright) once credentials exist
- [ ] Generated Supabase types (`supabase gen types`) to replace the hand-written `db/types.ts`
- [ ] Analytics dashboard built on `article_daily_views`
- [ ] Final public frontend design (owner)
