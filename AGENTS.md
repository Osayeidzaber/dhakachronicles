> Starting fresh on a new device/agent? Read `HANDOFF.md` first.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project rules — Dhaka Chronicles

- One Next.js project: frontend and backend live together (App Router, Server Components, route handlers, server actions). No separate servers.
- Supabase URL and keys are **server-only**. Never use `NEXT_PUBLIC_` for them; read them via `src/lib/env.ts`.
- Never import `src/lib/supabase/admin.ts` (service role) from client code; use it only for cron, provisioning and integrations.
- Every schema change is a new file in `supabase/migrations/`; add a test in `tests/db.test.ts` for constraints and RLS.
- Articles are one row per language, linked by `translation_group_id`. Never mix languages in one article.
- Instagram imports become drafts only; never auto-publish. Only the `dhakachronicles` account may be connected.
- Validate input with Zod. No `any` without a comment explaining why.
- Keep `MASTER_TODO.md` updated as work progresses.
- Never commit credentials. `.env*` is git-ignored except `.env.example`.
- Before finishing: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
