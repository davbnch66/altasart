
-- Outbox table for queued outbound emails
CREATE TABLE public.email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  to_recipients JSONB NOT NULL DEFAULT '[]',
  cc_recipients JSONB DEFAULT '[]',
  bcc_recipients JSONB DEFAULT '[]',
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  reply_to_message_id TEXT,
  attachments JSONB DEFAULT '[]',
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  dossier_id UUID REFERENCES public.dossiers(id) ON DELETE SET NULL,
  created_by UUID,
  status TEXT NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  sent_message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their company outbox"
  ON public.email_outbox FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can insert into outbox"
  ON public.email_outbox FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_my_company_ids()));
