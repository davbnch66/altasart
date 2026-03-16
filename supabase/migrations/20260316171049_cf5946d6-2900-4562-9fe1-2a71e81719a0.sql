
CREATE TABLE public.ppsps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid REFERENCES public.devis(id) ON DELETE CASCADE NOT NULL,
  dossier_id uuid REFERENCES public.dossiers(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'brouillon',
  version integer NOT NULL DEFAULT 1,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.ppsps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view ppsps" ON public.ppsps
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Members can insert ppsps" ON public.ppsps
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Members can update ppsps" ON public.ppsps
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Members can delete ppsps" ON public.ppsps
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

CREATE TRIGGER update_ppsps_updated_at
  BEFORE UPDATE ON public.ppsps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
