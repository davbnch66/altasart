-- Reset the inbound email to re-trigger analysis with the forwarding fix
UPDATE inbound_emails SET status = 'pending', ai_analysis = NULL, client_id = NULL, processed_at = NULL WHERE id = 'fe7ee040-b5de-4d5b-8ff7-70a36eb0b73c';
-- Remove old incorrect actions for this email
DELETE FROM email_actions WHERE inbound_email_id = 'fe7ee040-b5de-4d5b-8ff7-70a36eb0b73c';