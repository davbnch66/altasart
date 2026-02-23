
-- Remove overly permissive public SELECT policy on devis_signatures
-- Public access is handled securely via edge functions (get-signature-data, submit-signature)
DROP POLICY IF EXISTS "Public can view signature by token" ON public.devis_signatures;
DROP POLICY IF EXISTS "Public can sign by token" ON public.devis_signatures;
