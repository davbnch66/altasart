-- Add email_account_id to inbound_emails for attachment re-fetching
ALTER TABLE public.inbound_emails 
ADD COLUMN IF NOT EXISTS email_account_id uuid REFERENCES public.email_accounts(id) ON DELETE SET NULL;

-- Add piece_id to visite_materiel for room assignment
ALTER TABLE public.visite_materiel 
ADD COLUMN IF NOT EXISTS piece_id uuid REFERENCES public.visite_pieces(id) ON DELETE SET NULL;