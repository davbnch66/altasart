
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS siret text,
  ADD COLUMN IF NOT EXISTS ape_naf text,
  ADD COLUMN IF NOT EXISTS tva_intra text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS fax text;
