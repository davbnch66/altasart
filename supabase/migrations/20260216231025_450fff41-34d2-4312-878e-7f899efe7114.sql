
-- Enums
CREATE TYPE public.inbound_email_status AS ENUM ('pending', 'processing', 'processed', 'error');
CREATE TYPE public.email_action_type AS ENUM ('create_client', 'create_dossier', 'create_devis', 'plan_visite', 'extract_materiel', 'link_dossier');
CREATE TYPE public.email_action_status AS ENUM ('suggested', 'accepted', 'rejected');
CREATE TYPE public.notification_type AS ENUM ('new_lead', 'materiel_detected', 'visite_requested', 'client_response', 'date_to_validate');

-- Table inbound_emails
CREATE TABLE public.inbound_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  from_email text,
  from_name text,
  to_email text,
  subject text,
  body_text text,
  body_html text,
  attachments jsonb DEFAULT '[]'::jsonb,
  status public.inbound_email_status NOT NULL DEFAULT 'pending',
  ai_analysis jsonb,
  client_id uuid REFERENCES public.clients(id),
  dossier_id uuid REFERENCES public.dossiers(id),
  devis_id uuid REFERENCES public.devis(id),
  visite_id uuid REFERENCES public.visites(id),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view inbound_emails" ON public.inbound_emails
  FOR SELECT USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can update inbound_emails" ON public.inbound_emails
  FOR UPDATE USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Service can insert inbound_emails" ON public.inbound_emails
  FOR INSERT WITH CHECK (true);

-- Table email_actions
CREATE TABLE public.email_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_email_id uuid NOT NULL REFERENCES public.inbound_emails(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  action_type public.email_action_type NOT NULL,
  status public.email_action_status NOT NULL DEFAULT 'suggested',
  payload jsonb DEFAULT '{}'::jsonb,
  executed_at timestamptz,
  executed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view email_actions" ON public.email_actions
  FOR SELECT USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can update email_actions" ON public.email_actions
  FOR UPDATE USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Service can insert email_actions" ON public.email_actions
  FOR INSERT WITH CHECK (true);

-- Add inbound_email_id to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS inbound_email_id uuid REFERENCES public.inbound_emails(id);

-- Table notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Service can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Index for performance
CREATE INDEX idx_inbound_emails_company_status ON public.inbound_emails(company_id, status);
CREATE INDEX idx_inbound_emails_client ON public.inbound_emails(client_id);
CREATE INDEX idx_email_actions_email ON public.email_actions(inbound_email_id);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX idx_messages_inbound_email ON public.messages(inbound_email_id);
