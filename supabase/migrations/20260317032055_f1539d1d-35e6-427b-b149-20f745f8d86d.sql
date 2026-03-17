
-- Create client_companies junction table
CREATE TABLE public.client_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, company_id)
);

-- Enable RLS
ALTER TABLE public.client_companies ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view client_companies"
  ON public.client_companies FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can create client_companies"
  ON public.client_companies FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

CREATE POLICY "Members can delete client_companies"
  ON public.client_companies FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- Migrate existing data: create a row in client_companies for each client
INSERT INTO public.client_companies (client_id, company_id)
SELECT id, company_id FROM public.clients;

-- Create a security definer function to check client visibility via client_companies
CREATE OR REPLACE FUNCTION public.get_my_client_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id FROM public.client_companies
  WHERE company_id IN (SELECT get_my_company_ids());
$$;

-- Update clients RLS: drop old policies and create new ones based on client_companies
DROP POLICY IF EXISTS "Members can view clients" ON public.clients;
DROP POLICY IF EXISTS "Members can create clients" ON public.clients;
DROP POLICY IF EXISTS "Members can update clients" ON public.clients;
DROP POLICY IF EXISTS "Members can delete clients" ON public.clients;

-- Keep company_id as "primary" company, but visibility is through client_companies
CREATE POLICY "Members can view clients"
  ON public.clients FOR SELECT TO authenticated
  USING (id IN (SELECT get_my_client_ids()));

CREATE POLICY "Members can create clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

CREATE POLICY "Members can update clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (id IN (SELECT get_my_client_ids()));

CREATE POLICY "Members can delete clients"
  ON public.clients FOR DELETE TO authenticated
  USING (id IN (SELECT get_my_client_ids()));
