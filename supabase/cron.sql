-- =============================================================================
-- Supabase Cron setup. Run ONCE in the Supabase SQL editor AFTER deploying the
-- site (it needs your public site URL and the CRON_SECRET from your env vars).
-- Not a migration because it contains deployment-specific values.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Store secrets in Vault (replace the placeholders; never commit real values).
select vault.create_secret('https://YOUR-SITE.example.com', 'app_url');
select vault.create_secret('REPLACE_WITH_CRON_SECRET', 'cron_secret');

-- 2. Publish scheduled articles every minute.
select cron.schedule('publish-scheduled-articles', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/publish',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$$);

-- 3. Instagram sync every 15 minutes (endpoint is a no-op unless auto-import is on).
select cron.schedule('instagram-sync', '*/15 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/instagram-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$$);

-- 4. Housekeeping: expired OAuth states and old rate-limit rows, daily.
select cron.schedule('cleanup', '15 3 * * *', $$
  delete from public.oauth_states where expires_at < now();
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$);

-- Inspect: select * from cron.job;  select * from cron.job_run_details order by start_time desc limit 20;
