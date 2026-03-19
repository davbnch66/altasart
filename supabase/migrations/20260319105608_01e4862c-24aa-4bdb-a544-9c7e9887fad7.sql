
SELECT cron.unschedule('poll-email-accounts');

SELECT cron.schedule(
  'poll-email-accounts',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bsqqdtqzxajecgxgulce.supabase.co/functions/v1/poll-email-accounts'::text,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
