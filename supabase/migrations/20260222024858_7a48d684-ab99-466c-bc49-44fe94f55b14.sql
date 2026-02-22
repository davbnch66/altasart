
-- Add missing logistics fields to operations (matching Safari GT)
ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS loading_portage integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loading_passage_fenetre boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loading_monte_meubles boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loading_transbordement boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_portage integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_passage_fenetre boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_monte_meubles boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_transbordement boolean DEFAULT false;
