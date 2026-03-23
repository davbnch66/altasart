-- Add missing columns to synced_emails to unify with inbound_emails
ALTER TABLE public.synced_emails
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb DEFAULT null,
  ADD COLUMN IF NOT EXISTS devis_id uuid REFERENCES public.devis(id) DEFAULT null,
  ADD COLUMN IF NOT EXISTS visite_id uuid REFERENCES public.visites(id) DEFAULT null,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz DEFAULT null,
  ADD COLUMN IF NOT EXISTS read_by uuid DEFAULT null,
  ADD COLUMN IF NOT EXISTS read_at timestamptz DEFAULT null,
  ADD COLUMN IF NOT EXISTS label_id uuid DEFAULT null;

-- Create a unified view combining both tables
CREATE OR REPLACE VIEW public.unified_emails AS
SELECT 
  se.id,
  se.company_id,
  se.email_account_id,
  se.message_id,
  se.direction,
  se.from_email,
  se.from_name,
  se.to_emails,
  se.cc_emails,
  se.subject,
  se.body_text,
  se.body_html,
  se.attachments,
  se.received_at,
  se.client_id,
  se.dossier_id,
  se.is_read,
  se.folder,
  se.created_at,
  se.in_reply_to,
  se.status,
  se.ai_analysis,
  se.devis_id,
  se.visite_id,
  se.processed_at,
  se.read_by,
  se.read_at,
  se.label_id,
  'synced' as source
FROM public.synced_emails se
UNION ALL
SELECT
  ie.id,
  ie.company_id,
  ie.email_account_id,
  ie.message_id,
  'inbound' as direction,
  ie.from_email,
  ie.from_name,
  jsonb_build_array(jsonb_build_object('email', ie.to_email)) as to_emails,
  '[]'::jsonb as cc_emails,
  ie.subject,
  ie.body_text,
  ie.body_html,
  ie.attachments,
  ie.created_at as received_at,
  ie.client_id,
  ie.dossier_id,
  ie.is_read,
  ie.folder,
  ie.created_at,
  null as in_reply_to,
  ie.status::text,
  ie.ai_analysis,
  ie.devis_id,
  ie.visite_id,
  ie.processed_at,
  ie.read_by,
  ie.read_at,
  ie.label_id,
  'inbound' as source
FROM public.inbound_emails ie
WHERE ie.message_id IS NULL 
   OR ie.message_id NOT IN (SELECT message_id FROM public.synced_emails WHERE message_id IS NOT NULL);