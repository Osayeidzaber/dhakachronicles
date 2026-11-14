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
- [x] OAuth with Unified Login (config ID), username check, encrypted system-user token
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

## M9 — Commercial & design
- [x] Brand deals: `brand_deals` table (staff-only RLS, admin delete), pipeline + list view, checklist, /admin/brand-deals
- [x] Claude Design canvas for every page saved in `design/claude-design/`
- [x] Logo: `<Logo>` component in site header/footer, admin sidebar, login, set-password, invite email; emblem app icons (`src/app/icon.png`, `apple-icon.png`); sources in `design/brand/`
- [x] Discord: separate article-log and activity-log webhooks (env), rich embeds for publish/review/schedule/unpublish/Instagram; every audited action mirrored to the activity log
- [x] Custom HTML staff invitation email, `/auth/confirm` token route, `/set-password` page
- [x] Resend SMTP + custom invite template pushed to live Supabase (`supabase config push`), public sign-up off, email rate limit 30/h
- [ ] Set Site URL + redirect URLs to the production domain at deploy time
- [ ] Site analytics: per-page visits, referrers, top pages; admin dashboard + public "trending" widget
- [x] Instagram: "Pick from Instagram" tab (live feed, tick posts, import as drafts or import & publish), "Needs approval" tab with approve & publish (single/bulk)
- [x] Instagram videos/reels/carousel videos copied to R2 and played in the article (`video` node); covers kept as images
- [x] Parallel imports (4 media / 3 posts at a time, batched upserts); every import, failure and sync run in the activity log
- [x] Discord Alerts channel (`DISCORD_ALERTS_WEBHOOK_URL`, falls back to activity): import failures, sync failures, rate limits, expired token, scheduler failures, sign-in abuse
- [x] Article-log embeds link to the site, the newsroom and the Instagram post; scheduled stories announce when they go live
- [ ] Media library: show a video icon/player for video rows (they currently use the image card)
- [x] `supabase db push`: brand_deals live on Supabase (2026-11-14)
- [ ] Admin skeletons (loading.tsx), page transitions, smooth scroll; adapt vendor components to the design

- [x] Brand deals → public: "Brands we've worked with" (logo, what we did, proof link) on Advertise + homepage; staff-only fees/contacts stay private (`public_partners()`)
- [x] Website ads from brand deals: image + link, placement (home / article / both), date window, labelled "Advertisement", `rel="sponsored nofollow"` (`active_ads()`)
- [x] Admin → Team page: hand-edited people (photo, EN/BN name, role, bio, Instagram, byline link, order, visible)
- [x] Image upload field (R2, AVIF/WebP) for logos, ads, team photos and author photos
- [x] Phone pass: swipeable section bar, shorter lead image, admin top bar (+ new, bell, profile), sign out on profile, nav keeps current page in view
- [x] Speed: homepage second-wave queries run in parallel; preconnect to the image CDN
- [x] Push migration `20261114000007_partners_ads_people.sql` to production

## Next / nice to have
- [ ] End-to-end tests against a real Supabase project (Playwright) once credentials exist
- [ ] Generated Supabase types (`supabase gen types`) to replace the hand-written `db/types.ts`
- [ ] Analytics dashboard built on `article_daily_views`
- [ ] Final public frontend design (owner)
