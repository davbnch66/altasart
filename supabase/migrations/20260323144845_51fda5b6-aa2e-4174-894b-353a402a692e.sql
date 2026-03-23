
CREATE TABLE public.company_fixed_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'personnel',
  label text NOT NULL,
  unit text NOT NULL DEFAULT 'jour',
  unit_cost numeric NOT NULL DEFAULT 0,
  charges_rate numeric NOT NULL DEFAULT 0,
  total_cost numeric GENERATED ALWAYS AS (unit_cost * (1 + charges_rate / 100)) STORED,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_fixed_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view company_fixed_costs" ON public.company_fixed_costs
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can create company_fixed_costs" ON public.company_fixed_costs
  FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

CREATE POLICY "Members can update company_fixed_costs" ON public.company_fixed_costs
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can delete company_fixed_costs" ON public.company_fixed_costs
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));
