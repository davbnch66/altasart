
CREATE TABLE public.supplier_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'grue',
  brand TEXT,
  model TEXT,
  category TEXT DEFAULT 'levage',
  capacity_tons NUMERIC,
  reach_meters NUMERIC,
  height_meters NUMERIC,
  technical_specs JSONB DEFAULT '{}',
  daily_rate NUMERIC,
  weekly_rate NUMERIC,
  monthly_rate NUMERIC,
  availability TEXT DEFAULT 'disponible',
  notes TEXT,
  document_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.supplier_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view supplier equipment"
  ON public.supplier_equipment FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.company_memberships WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Members can insert supplier equipment"
  ON public.supplier_equipment FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.company_memberships WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Members can update supplier equipment"
  ON public.supplier_equipment FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.company_memberships WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Members can delete supplier equipment"
  ON public.supplier_equipment FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.company_memberships WHERE profile_id = auth.uid()
  ));
