
-- Fix overly permissive INSERT policy on resources
DROP POLICY "Members can create resources" ON public.resources;
CREATE POLICY "Members can create resources" ON public.resources FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_memberships WHERE profile_id = auth.uid()));
