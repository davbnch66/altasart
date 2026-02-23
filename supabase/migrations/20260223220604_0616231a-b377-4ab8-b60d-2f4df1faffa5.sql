ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS needs_voirie boolean NOT NULL DEFAULT false;
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS voirie_address text;