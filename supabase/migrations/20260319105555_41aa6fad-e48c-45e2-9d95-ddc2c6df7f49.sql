
ALTER TABLE public.inbound_emails ADD COLUMN IF NOT EXISTS message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_emails_message_id 
  ON public.inbound_emails (company_id, message_id) 
  WHERE message_id IS NOT NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.inbound_emails;
