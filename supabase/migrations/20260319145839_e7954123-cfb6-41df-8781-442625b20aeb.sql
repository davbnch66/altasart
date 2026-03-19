
-- Enable pg_trgm extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add new action types for intelligent client matching
ALTER TYPE public.email_action_type ADD VALUE IF NOT EXISTS 'link_existing_client';
ALTER TYPE public.email_action_type ADD VALUE IF NOT EXISTS 'enrich_client';

-- Create a table to store client matching corrections for learning
CREATE TABLE IF NOT EXISTS public.client_match_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_email text NOT NULL,
  from_domain text,
  matched_client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  corrected_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_match_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage match corrections"
  ON public.client_match_corrections
  FOR ALL
  TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()))
  WITH CHECK (company_id IN (SELECT get_my_company_ids()));

-- Create index on client name for trigram similarity searches
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON public.clients USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_email_trgm ON public.clients USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_client_contacts_email ON public.client_contacts (email);
CREATE INDEX IF NOT EXISTS idx_client_match_corrections_email ON public.client_match_corrections (from_email, company_id);
