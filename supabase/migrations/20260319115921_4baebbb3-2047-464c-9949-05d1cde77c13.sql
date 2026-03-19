-- Reset this specific email for re-processing to test deep attachment analysis
UPDATE inbound_emails SET status = 'pending', ai_analysis = NULL WHERE id = '1c1b0673-2e1a-42b0-bd3b-f7def9a0098e';

-- Also delete old actions and materiel for this email to avoid duplicates
DELETE FROM email_actions WHERE inbound_email_id = '1c1b0673-2e1a-42b0-bd3b-f7def9a0098e';
DELETE FROM visite_materiel WHERE visite_id = '29fda72e-0a60-4f82-8e35-f2b7b5427b3b';
DELETE FROM visite_pieces WHERE visite_id = '29fda72e-0a60-4f82-8e35-f2b7b5427b3b';