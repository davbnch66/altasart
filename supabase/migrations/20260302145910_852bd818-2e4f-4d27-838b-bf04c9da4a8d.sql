
-- Table pour stocker les plans de voirie avec leurs éléments positionnés
CREATE TABLE public.voirie_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  visite_id uuid REFERENCES public.visites(id) ON DELETE SET NULL,
  dossier_id uuid REFERENCES public.dossiers(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  address text,
  plan_pdf_path text,
  plan_image_url text,
  elements jsonb NOT NULL DEFAULT '[]'::jsonb,
  legend jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'brouillon',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.voirie_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view voirie_plans" ON public.voirie_plans
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can create voirie_plans" ON public.voirie_plans
  FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

CREATE POLICY "Members can update voirie_plans" ON public.voirie_plans
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can delete voirie_plans" ON public.voirie_plans
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- Storage bucket pour les plans PDF
INSERT INTO storage.buckets (id, name, public) VALUES ('voirie-plans', 'voirie-plans', false);

CREATE POLICY "Members can upload voirie plans" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voirie-plans');

CREATE POLICY "Members can view voirie plans" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'voirie-plans');

CREATE POLICY "Members can delete voirie plans" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'voirie-plans');
