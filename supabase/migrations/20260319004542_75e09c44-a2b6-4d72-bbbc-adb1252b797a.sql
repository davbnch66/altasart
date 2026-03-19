
ALTER TABLE public.inbound_emails
  ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS read_at timestamptz;
