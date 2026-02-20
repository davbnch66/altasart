
ALTER TABLE public.operations
ADD COLUMN operator_signature_url text,
ADD COLUMN operator_signer_name text,
ADD COLUMN operator_signed_at timestamptz;
