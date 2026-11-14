# Supabase Setup

Everything Supabase-related is in `supabase/`. Frontend and backend live in this one Next.js project.

## Files

| File | What it is |
|---|---|
| `supabase/migrations/…01_core_schema.sql` | All tables, indexes, constraints, triggers (timestamps, revisions, media-delete guard, profile creation) |
| `supabase/migrations/…02_rls_policies.sql` | Row Level Security + role helpers (`admin`, `editor`, `writer`) |
| `supabase/migrations/…03_workflow_functions.sql` | Scheduled publishing, Instagram draft creation, tag replacement, default settings |
| `supabase/seed.sql` | Starter categories (Bangla + English) |
| `supabase/cron.sql` | Supabase Cron jobs — run once **after** deploying |
| `scripts/provision-admin.mjs` | Creates the first admin (no public sign-up exists) |

## Keys stay hidden

The Supabase URL and keys are **server-only** env vars (no `NEXT_PUBLIC_` prefix). `src/lib/env.ts` imports
`server-only`, so the build fails if any browser code tries to use them. All database traffic goes through the
Next.js server; the browser only gets an httpOnly session cookie.

> Hiding the URL/publishable key is extra protection, not the main one. Real security comes from RLS
> (tested in `tests/db.test.ts`) and from never exposing the **secret** key.

## Steps (when you have your project)

1. Create a project at supabase.com. From **Project Settings → API keys** copy the Project URL,
   the publishable key and a secret key.
2. `cp .env.example .env.local` and fill in `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
   plus a random `CRON_SECRET`.
3. Push the database:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase db push
   ```
   Then run `supabase/seed.sql` in the SQL editor (optional).
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up". Staff accounts are created by admins only.
5. Create your admin:
   ```bash
   npm run provision-admin -- you@example.com "Your Name"
   ```
6. After deploying, edit the placeholders at the top of `supabase/cron.sql` and run it in the SQL editor.

## Verify

```bash
npm test
```
Runs every migration in an in-memory Postgres (PGlite) and checks slugs, translations, scheduled publishing,
duplicate Instagram imports and RLS (anonymous users can't see drafts, writers can't publish, no self-promotion).

## Staff invitation email (custom HTML)

Invites use our own email design in `supabase/templates/invite.html`.

- **Local (`supabase start`)**: already wired in `supabase/config.toml` (`[auth.email.template.invite]`).
- **Hosted project**: Dashboard → Authentication → Emails → Templates → **Invite user**.
  Subject: `You're invited to the Dhaka Chronicles newsroom`. Paste the whole HTML file into the body.
- Dashboard → Authentication → URL Configuration: set **Site URL** to your `SITE_URL`, and add
  `https://YOUR-DOMAIN/auth/confirm` to the redirect allow-list.

The email links to `/auth/confirm?token_hash=…&type=invite`, which verifies the token on the server,
signs the person in with an httpOnly cookie, and sends them to `/set-password` to choose a password and name.
For real delivery volume, configure custom SMTP (Authentication → Emails → SMTP settings); Supabase's
built-in sender is rate-limited.

### Free plan: custom SMTP is required for the custom email

Supabase's free plan refuses custom email templates while it sends mail itself. To use our invite design:
1. Pick an SMTP provider (e.g. Resend, Postmark, Brevo or a Google Workspace app password) and verify the sending domain.
2. Dashboard → Authentication → Emails → SMTP settings, or `[auth.email.smtp]` in `supabase/config.toml`
   with `pass = "env(SMTP_PASS)"`.
3. Uncomment `[auth.email.template.invite]` in `supabase/config.toml` and run `npx supabase config push`.

Until then, invites still work: Supabase sends its plain default email, and its link still lands on
`/auth/confirm` → `/set-password` only if the default template's link is changed. With the default template the
link goes to the Site URL with a session in the URL fragment, which the app does not read; so set up SMTP before
inviting staff, or create accounts with a starting password from Team → "Create account".
