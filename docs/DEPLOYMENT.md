# Deployment (Vercel)

1. **Supabase:** finish `SUPABASE_SETUP.md`, including migrations, seed, sign-ups turned off and the first admin.
2. **Vercel:** import the GitHub repo. The framework preset (Next.js) is detected automatically.
3. **Environment variables:** add every variable from `.env.example` in Vercel → Settings → Environment Variables.
   - None of them use `NEXT_PUBLIC_`, so all of them stay on the server.
   - Set `SITE_URL` to the production origin, for example `https://dhakachronicles.com`.
4. **Supabase Auth URLs:** in Supabase → Authentication → URL Configuration, set the Site URL to your domain and add `https://YOUR-DOMAIN/login` to the redirect URLs. Invitation emails link there.
5. **Deploy**, then run `supabase/cron.sql` once in the Supabase SQL editor after replacing its two placeholders (`app_url`, `cron_secret`; the secret must equal `CRON_SECRET`). This sets up:
   - publish scheduled articles every minute → `POST /api/cron/publish`
   - Instagram sync every 15 minutes → `POST /api/cron/instagram-sync` (does nothing unless auto-import is on)
   - daily cleanup of OAuth states and rate-limit rows
6. **R2 CORS:** add the production origin (see `docs/R2_SETUP.md`).
7. **Instagram:** register `https://YOUR-DOMAIN/api/instagram/callback` in the Meta app (see `docs/INSTAGRAM_SETUP.md`).
8. **Google:** submit `/sitemap.xml` and `/news-sitemap.xml` in Search Console. Google News inclusion is reviewed separately by Google.

## Checks after deploy

```bash
curl -I https://YOUR-DOMAIN/            # 307 → /bn
curl https://YOUR-DOMAIN/robots.txt
curl -X POST https://YOUR-DOMAIN/api/cron/publish -H "Authorization: Bearer $CRON_SECRET"   # {"ok":true,...}
```

In Supabase, `select * from cron.job_run_details order by start_time desc limit 10;` shows the cron history, and `public.job_runs` records each publish run.

## Notes

- `/api/cron/instagram-sync` and `/api/media/finalize` set `maxDuration`. Long historical imports are better run from the admin page in batches of about 100 posts.
- Sharp runs on Vercel's Node runtime. The proxy (`src/proxy.ts`) only refreshes sessions and guards `/admin`.
