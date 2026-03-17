
-- Enum for email account provider type
CREATE TYPE public.email_provider AS ENUM (
  'generic',
  'gandi',
  'gmail',
  'outlook',
  'ovh',
  'zoho',
  'ionos',
  'yahoo'
);

-- Enum for connection status
CREATE TYPE public.email_account_status AS ENUM (
  'active',
  'error',
  'disconnected',
  'testing'
);

-- Enum for auth method
CREATE TYPE public.email_auth_method AS ENUM (
  'password',
  'oauth2'
);

-- Main email accounts table
CREATE TABLE public.email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  email_address TEXT NOT NULL,
  provider email_provider NOT NULL DEFAULT 'generic',
  auth_method email_auth_method NOT NULL DEFAULT 'password',

  -- SMTP config
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_security TEXT DEFAULT 'STARTTLS',
  smtp_username TEXT,
  smtp_password_encrypted TEXT,

  -- IMAP config
  imap_host TEXT,
  imap_port INTEGER DEFAULT 993,
  imap_security TEXT DEFAULT 'SSL',
  imap_username TEXT,
  imap_password_encrypted TEXT,

  -- OAuth config (for Gmail/Outlook)
  oauth_access_token_encrypted TEXT,
  oauth_refresh_token_encrypted TEXT,
  oauth_token_expires_at TIMESTAMPTZ,
  oauth_client_id TEXT,

  -- Sync state
  status email_account_status NOT NULL DEFAULT 'disconnected',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  sync_from_date TIMESTAMPTZ DEFAULT now(),

  -- Settings
  is_default BOOLEAN NOT NULL DEFAULT false,
  auto_link_clients BOOLEAN NOT NULL DEFAULT true,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(company_id, email_address)
);

-- Enable RLS
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies (authenticated, company-scoped)
CREATE POLICY "Members can view their company email accounts"
  ON public.email_accounts FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can insert email accounts for their company"
  ON public.email_accounts FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can update their company email accounts"
  ON public.email_accounts FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()))
  WITH CHECK (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can delete their company email accounts"
  ON public.email_accounts FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- Updated_at trigger
CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Ensure only one default per company
CREATE OR REPLACE FUNCTION public.ensure_single_default_email_account()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE email_accounts
    SET is_default = false
    WHERE company_id = NEW.company_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_default_email_account
  BEFORE INSERT OR UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION ensure_single_default_email_account();

-- Synced emails table (emails fetched by the bridge)
CREATE TABLE public.synced_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  from_email TEXT,
  from_name TEXT,
  to_emails JSONB DEFAULT '[]',
  cc_emails JSONB DEFAULT '[]',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  attachments JSONB DEFAULT '[]',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  dossier_id UUID REFERENCES public.dossiers(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  folder TEXT DEFAULT 'INBOX',
  raw_headers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email_account_id, message_id)
);

ALTER TABLE public.synced_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their company synced emails"
  ON public.synced_emails FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can update their company synced emails"
  ON public.synced_emails FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()))
  WITH CHECK (company_id IN (SELECT get_my_company_ids()));
