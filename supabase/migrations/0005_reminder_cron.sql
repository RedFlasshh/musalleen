-- Schedules the send-reminders edge function to run every 15 minutes via
-- pg_cron + pg_net. The x-cron-secret header is what the function checks
-- (see supabase/functions/send-reminders/index.ts) since this is a system
-- tick with no user session to carry a JWT.
--
-- Both the function URL and the shared secret are read from Vault (set via
-- `select vault.create_secret(...)`, run once outside this migration file
-- since the actual secret value must never be committed to the repo) rather
-- than hardcoded here, for the same reason the edge function itself reads
-- them from Deno.env rather than literals.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-reminders-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'send_reminders_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
