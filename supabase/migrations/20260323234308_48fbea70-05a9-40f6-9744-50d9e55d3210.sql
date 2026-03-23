
-- Table pour la facturation de situation / acomptes
CREATE TABLE public.facture_situations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid REFERENCES public.dossiers(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) NOT NULL,
  facture_id uuid REFERENCES public.factures(id) ON DELETE SET NULL,
  label text NOT NULL DEFAULT 'Situation',
  percentage numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'prevu',
  due_date date,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facture_situations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view facture_situations" ON public.facture_situations
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can insert facture_situations" ON public.facture_situations
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can update facture_situations" ON public.facture_situations
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can delete facture_situations" ON public.facture_situations
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));
