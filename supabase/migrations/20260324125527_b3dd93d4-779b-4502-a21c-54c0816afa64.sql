ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS ape_naf text,
  ADD COLUMN IF NOT EXISTS tva_intra text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text;