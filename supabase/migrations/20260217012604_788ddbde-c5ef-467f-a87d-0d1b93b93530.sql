
-- Add client_type and tags to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'societe';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create client_contacts table
CREATE TABLE public.client_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  code text,
  civility text DEFAULT 'Monsieur',
  first_name text,
  last_name text NOT NULL,
  mobile text,
  phone_direct text,
  phone_office text,
  email text,
  function_title text,
  is_default boolean NOT NULL DEFAULT false,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view client_contacts"
  ON public.client_contacts FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can create client_contacts"
  ON public.client_contacts FOR INSERT
  WITH CHECK (is_member(company_id));

CREATE POLICY "Members can update client_contacts"
  ON public.client_contacts FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can delete client_contacts"
  ON public.client_contacts FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

-- Trigger for updated_at
CREATE TRIGGER update_client_contacts_updated_at
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Ensure only one default contact per client
CREATE OR REPLACE FUNCTION public.ensure_single_default_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE client_contacts
    SET is_default = false
    WHERE client_id = NEW.client_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_default_contact
  BEFORE INSERT OR UPDATE ON public.client_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_contact();
