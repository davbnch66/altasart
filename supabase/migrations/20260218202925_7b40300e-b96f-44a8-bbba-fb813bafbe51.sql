
CREATE TABLE public.email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  type text NOT NULL, -- 'devis_envoi' | 'devis_relance_1' | 'devis_relance_2' | 'devis_relance_3' | 'rapport_visite' | 'suivi_client'
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL, -- HTML avec variables {{client_name}}, {{devis_code}}, etc.
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view email_templates"
ON public.email_templates FOR SELECT
USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can create email_templates"
ON public.email_templates FOR INSERT
WITH CHECK (is_member(company_id));

CREATE POLICY "Members can update email_templates"
ON public.email_templates FOR UPDATE
USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can delete email_templates"
ON public.email_templates FOR DELETE
USING (company_id IN (SELECT get_my_company_ids()));

CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
