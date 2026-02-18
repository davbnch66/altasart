
-- Table pour les signatures de devis
CREATE TABLE public.devis_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id UUID NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'expired')),
  signer_name TEXT,
  signer_email TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour la recherche par token (accès public)
CREATE INDEX idx_devis_signatures_token ON public.devis_signatures(token);
CREATE INDEX idx_devis_signatures_devis_id ON public.devis_signatures(devis_id);

-- RLS
ALTER TABLE public.devis_signatures ENABLE ROW LEVEL SECURITY;

-- Les membres peuvent créer et voir les signatures de leur société
CREATE POLICY "Members can create signatures"
  ON public.devis_signatures FOR INSERT
  WITH CHECK (is_member(company_id));

CREATE POLICY "Members can view signatures"
  ON public.devis_signatures FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can update signatures"
  ON public.devis_signatures FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can delete signatures"
  ON public.devis_signatures FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

-- Accès public par token (pour la page de signature côté client)
CREATE POLICY "Public can view signature by token"
  ON public.devis_signatures FOR SELECT
  USING (true);

CREATE POLICY "Public can sign by token"
  ON public.devis_signatures FOR UPDATE
  USING (status = 'pending' AND expires_at > now());
