-- Add signature fields for client sign-off on BTs (start and end of chantier)
ALTER TABLE public.operations 
  ADD COLUMN start_signature_url text,
  ADD COLUMN start_signed_at timestamptz,
  ADD COLUMN start_signer_name text,
  ADD COLUMN end_signature_url text,
  ADD COLUMN end_signed_at timestamptz,
  ADD COLUMN end_signer_name text;