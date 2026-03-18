
-- Add attachments and delivery status columns to messages table
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_id text;

-- delivery_status values: 'queued', 'sent', 'delivered', 'read', 'failed'
-- external_id stores the Twilio SID or email message-id for tracking

COMMENT ON COLUMN public.messages.delivery_status IS 'queued, sent, delivered, read, failed';
COMMENT ON COLUMN public.messages.external_id IS 'External message ID (Twilio SID, email Message-ID)';
