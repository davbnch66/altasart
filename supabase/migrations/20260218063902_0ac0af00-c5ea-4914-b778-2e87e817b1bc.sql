
-- Table pour tracker les relances de devis
CREATE TABLE public.devis_relances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id uuid NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  recipient_email text NOT NULL,
  recipient_name text,
  relance_num integer NOT NULL DEFAULT 1,
  subject text,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.devis_relances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view relances"
  ON public.devis_relances FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can create relances"
  ON public.devis_relances FOR INSERT
  WITH CHECK (is_member(company_id));

CREATE POLICY "Members can delete relances"
  ON public.devis_relances FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

-- Index pour performance
CREATE INDEX idx_devis_relances_devis_id ON public.devis_relances(devis_id);
CREATE INDEX idx_devis_relances_company_id ON public.devis_relances(company_id);

-- Ajouter extension pg_cron si pas déjà présente (pour relances auto)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
