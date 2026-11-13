# Dhaka Chronicles

A bilingual (Bangla/English) news publication: a Next.js app with a Supabase backend, an editorial CMS, Cloudflare R2 media storage, Instagram importing from **@dhakachronicles**, and an SEO engine.

The public frontend is deliberately basic. It reads data only through `src/lib/articles/queries.ts`, so it can be redesigned without touching the backend.

## Status

| Area | State |
|---|---|
| Database, RLS, workflow functions | Implemented and tested in PGlite. Not yet pushed to a real project. |
| Auth and roles (admin/editor/writer) | Implemented. Needs Supabase credentials. |
| CMS: articles, editor, workflow, taxonomy, authors, team, settings | Implemented |
| Media (R2 + Sharp, WebP/AVIF variants) | Implemented. Needs an R2 bucket and keys (`docs/R2_SETUP.md`). |
| Instagram import | Implemented against the official API. Needs a Meta app (`docs/INSTAGRAM_SETUP.md`). |
| Scheduled publishing and auto-sync | Implemented. Needs `supabase/cron.sql` run after deploy. |
| SEO (metadata, hreflang, JSON-LD, sitemaps, RSS, robots) | Implemented |
| Optional AI SEO suggestions | Implemented. Off unless `AI_SEO_*` is set. |

Nothing has run against live Supabase, R2 or Instagram yet; those need your credentials.

## Architecture

There is one Next.js 16 project (App Router, TypeScript strict, Tailwind v4). Frontend and backend live together, with no separate servers.

```
src/
  app/
    [lang]/            public site (bn | en): home, latest, news/[slug], category, tag, author, search, rss.xml
    (cms)/login        staff sign-in
    (cms)/admin/...    dashboard, articles, media, categories, tags, authors, instagram, team, settings
    api/cron/*         Supabase Cron targets (publish, instagram-sync), Bearer CRON_SECRET
    api/media/*        presign + finalize uploads
    api/instagram/*    OAuth connect + callback
    api/views          view counter
    sitemap.ts, robots.ts, news-sitemap.xml/
  lib/
    env.ts             server-only env (validated)
    supabase/          server (user, RLS) and admin (service role) clients
    auth/              session helpers + permission matrix
    articles/          validation, workflow state machine, service (writes), queries (public reads)
    media/             R2 client, Sharp pipeline, upload validation
    instagram/         Graph API client, OAuth, sync/import, token crypto
    seo/               defaults, metadata, JSON-LD, feeds, validator, optional AI
  components/admin     editor (Tiptap), media picker, UI bits
  components/public    cards, header/footer, responsive images
  components/content   safe Tiptap JSON renderer
supabase/
  migrations/          schema, RLS, functions
  seed.sql, cron.sql
tests/                 Vitest: unit + DB tests (PGlite)
```

Key ideas:
- **Security in two layers.** Server code checks permissions (`src/lib/auth/permissions.ts`), and Postgres RLS enforces the same rules.
- **Secrets stay on the server.** The Supabase URL and keys, R2 and Instagram secrets are server-only env vars. The browser only gets an httpOnly session cookie.
- **One row per language.** Translations share a `translation_group_id`, and each language publishes on its own schedule.
- **Caching uses ISR.** Public pages use `revalidate`, and publishing calls `revalidatePath`. Cache Components is turned off (see DECISIONS.md).

The full schema is in `supabase/migrations/`; the design decisions are in `DECISIONS.md`.

## Setup

```bash
npm install
cp .env.example .env.local     # fill in values (never commit)
```

1. **Supabase:** follow `SUPABASE_SETUP.md` (link the project, `npx supabase db push`, seed, disable sign-ups).
2. **First admin:** `npm run provision-admin -- you@example.com "Your Name"`.
3. **R2:** follow `docs/R2_SETUP.md`.
4. **Instagram:** follow `docs/INSTAGRAM_SETUP.md`.
5. **Run:** `npm run dev`, then open http://localhost:3000. Staff sign in at `/login`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Vitest: unit tests and DB/RLS tests in PGlite (no Docker needed) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run provision-admin -- <email> "<name>"` | Create or promote the first admin |

Database migrations:

```bash
npx supabase db push               # apply migrations to the linked project
npx supabase migration new <name>  # create a new migration
```

## Deployment

See `docs/DEPLOYMENT.md` (Vercel, env vars, Supabase Cron, R2 CORS, Instagram redirect URI).

## Other docs

`AGENTS.md` (rules for AI agents) · `HANDOFF.md` (full context) · `MASTER_TODO.md` · `DECISIONS.md` · `CHANGELOG.md` · `CONTRIBUTING.md`
