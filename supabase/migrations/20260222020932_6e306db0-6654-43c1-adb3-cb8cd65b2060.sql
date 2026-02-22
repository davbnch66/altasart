
-- Add detailed fields to dossiers matching Safari GT
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS volume numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_mode text DEFAULT 'route',
  ADD COLUMN IF NOT EXISTS nature text,
  ADD COLUMN IF NOT EXISTS dossier_type text,
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS advisor text,
  ADD COLUMN IF NOT EXISTS coordinator text,
  ADD COLUMN IF NOT EXISTS loss_reason text,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS visite_date date,
  ADD COLUMN IF NOT EXISTS confirmation_date date,
  -- Loading address details
  ADD COLUMN IF NOT EXISTS loading_address text,
  ADD COLUMN IF NOT EXISTS loading_postal_code text,
  ADD COLUMN IF NOT EXISTS loading_city text,
  ADD COLUMN IF NOT EXISTS loading_floor text,
  ADD COLUMN IF NOT EXISTS loading_access text,
  ADD COLUMN IF NOT EXISTS loading_elevator boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loading_parking_request boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loading_comments text,
  -- Delivery address details
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_postal_code text,
  ADD COLUMN IF NOT EXISTS delivery_city text,
  ADD COLUMN IF NOT EXISTS delivery_floor text,
  ADD COLUMN IF NOT EXISTS delivery_access text,
  ADD COLUMN IF NOT EXISTS delivery_elevator boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_parking_request boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_comments text;
