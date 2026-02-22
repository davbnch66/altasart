-- Add missing columns to clients table for comprehensive form
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'France',
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS special_conditions text,
  ADD COLUMN IF NOT EXISTS commercial_notes text,
  ADD COLUMN IF NOT EXISTS site_address text;
