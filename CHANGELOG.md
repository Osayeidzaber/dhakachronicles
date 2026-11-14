# Changelog

## Unreleased
- Unknown section, tag, author, ad-report and other public URLs now answer HTTP 404 (were 200 with the not-found page); a page number past the last page is a 404 instead of an error.
- Audit pass: database and sign-in errors are translated to our own wording before reaching the screen (`publicMessage` in `src/lib/errors.ts`); the session cookie is now `dc-session` instead of the provider's project-named cookie (old sessions carry over); provider names removed from the login notice, privacy page and settings; malformed JSON returns 400 instead of 500; admin error screen.
- Brand deals pipeline for sponsorships (`/admin/brand-deals`), with RLS and DB tests.
- Public site redesign: highlight, most read, article tools, mobile menu, presence beacon.
- Claude Design canvas stored in `design/claude-design/`.
- Discord: two channels (article log, activity log) with rich embeds; webhooks via `DISCORD_ARTICLE_WEBHOOK_URL` / `DISCORD_ACTIVITY_WEBHOOK_URL`.
- New logo across the site, newsroom and invite email; emblem favicon/app icon.
- Instagram: pick specific posts, import & publish in one step, approve drafts in bulk, real video/reel import, parallel processing.
- Discord Alerts channel for failures, rate limits and suspicious sign-ins; links to site/newsroom/Instagram on every article embed.
- Staff invitations: custom HTML email, `/auth/confirm` and `/set-password` so invitees can actually sign in.

## [0.2.0] — 2026-11-13

### Added
- Auth: staff login (rate-limited), session refresh in the proxy, `requireSession`/`requirePageSession`, a permission matrix, admin invitations and role management.
- Articles: Zod validation, a workflow state machine (submit, approve, publish, schedule, unpublish, archive, restore), translations, revisions with restore, bulk actions, and audit logs.
- CMS: dashboard (counts, notifications, activity, Instagram status), article list with filters, a Tiptap editor with autosave, preview and SEO panel, and pages for categories, tags, authors, media, Instagram, team and settings.
- Media: R2 presigned uploads, Sharp validation and optimization, WebP/AVIF variants, metadata editing, and a delete guard.
- Instagram: OAuth with the username check, encrypted tokens and refresh, paginated sync, carousel support, R2 import, drafts, retries, history, and cron auto-sync.
- SEO: metadata with hreflang, NewsArticle/Breadcrumb/Organization JSON-LD, sitemap, Google News sitemap, RSS per language, robots, a validator, and optional AI suggestions.
- Public site: home (breaking/featured/latest), latest, article, category, tag, author and search pages, a language switcher, pagination, and loading/error/404 states.
- Cron endpoints for scheduled publishing and Instagram sync; the view counter.
- 70 tests (unit tests, plus DB/RLS tests in PGlite).
- Docs: README, DECISIONS, CONTRIBUTING, and setup guides for Instagram, R2 and deployment.

### Changed
- Cache Components turned off in favour of ISR (D-008).

## [0.1.0] — 2026-11-13

### Added
- Supabase schema, RLS policies, workflow functions, seed, cron script, server-only clients and the admin provisioning script.
