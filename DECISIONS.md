# Architecture decisions

**D-001 · One Next.js project.** Frontend, backend (route handlers and server actions) and the CMS share one deployable app. This is the owner's requirement, and it keeps things simple.

**D-002 · Supabase keys are server-only.** The URL and publishable key are not sent to the browser, even though Supabase considers them public. This means there is no browser Supabase client; all data access goes through the server. RLS is still the real security boundary.

**D-003 · One article row per language.** Rows are linked by `translation_group_id`, with `unique(language, slug)` and `unique(translation_group_id, language)`. Each translation publishes independently. Slugs may contain Bangla characters.

**D-004 · Separate `authors` table.** Public bylines (with bn/en names and bios) are separate from staff `profiles`, so guest contributors don't need accounts. `articles.created_by` (profile) decides who owns an article and may edit it.

**D-005 · Roles come only from `app_metadata`.** The `handle_new_user` trigger reads the role from `raw_app_meta_data`, which only the service role can set. Public sign-up is disabled, staff are added by admin invitation, and the first admin is created by script. A trigger blocks self-promotion.

**D-006 · Permissions in two layers.** Server code checks permissions with `permissions.ts`; Postgres RLS enforces the same rules. Writer-only restrictions (no breaking/featured flags, no publish dates) are also enforced by a trigger.

**D-007 · Multi-step writes run in SQL functions.** Tag replacement, Instagram draft creation and scheduled publishing (with SKIP LOCKED) each run in a single transaction, since supabase-js has no client transactions.

**D-008 · ISR instead of Cache Components.** `create-next-app` enabled `cacheComponents`. We turned it off and use route `revalidate` plus `revalidatePath` on publish and unpublish. The model is simpler and fully supported; moving to `"use cache"` later is possible.

**D-009 · Revisions are captured by a trigger.** Revisions are taken on every status or title change, and on content changes at most every 10 minutes, so autosave doesn't flood the table.

**D-010 · Presigned upload, then server finalize.** This avoids Vercel's body-size limit while still validating real bytes and generating variants on the server.

**D-011 · Variants are pre-generated and served through `<picture>`.** We don't use `next/image`. This avoids paying twice for optimization and keeps media on the R2 custom domain.

**D-012 · Instagram tokens are encrypted in the app.** Tokens use AES-256-GCM with `TOKEN_ENCRYPTION_KEY` and are stored in a table with RLS on and no policies.

**D-013 · Instagram imports become drafts only.** The caption is kept verbatim. Title, language (detected from Bangla script) and slug (`…-ig-<id>`) are suggestions for editors.

**D-014 · Rate limiting is database-backed.** It uses a fixed window (`rate_limit_hit`) so it works across serverless instances, and it lets requests through if the database is unavailable.

**D-015 · Tiptap JSON is rendered by our own React renderer.** We don't use `dangerouslySetInnerHTML`. Links, images and embeds are whitelisted, and only YouTube embeds are allowed (stored as an id).

**D-016 · Search uses Postgres FTS with the `simple` config.** Postgres has no Bangla dictionary, so `simple` handles both languages consistently.

**D-017 · AI SEO is optional and provider-agnostic.** It works with any OpenAI-compatible endpoint, is never required, and every suggestion is reviewed by an editor.

**D-018 · Tests use PGlite.** The real migrations run against stubbed Supabase `auth` and roles in-process, so RLS tests need no Docker.

**D-019 · Instagram uses the Unified Login setup.** Meta no longer offers "Instagram API with Instagram Login" to new apps. We use the Facebook Login for Business dialog with a configuration ID, store the never-expiring Business Integration System User token encrypted, call `graph.facebook.com` with `appsecret_proof`, and pick the account from `/me/assigned_instagram_accounts` (only `dhakachronicles` is accepted). Supersedes the Instagram Login parts of earlier notes.
