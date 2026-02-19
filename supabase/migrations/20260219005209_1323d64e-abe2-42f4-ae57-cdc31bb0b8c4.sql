-- Allow admins to update company info
CREATE POLICY "Admins can update their companies"
ON public.companies
FOR UPDATE
USING (id IN (
  SELECT company_id FROM public.company_memberships
  WHERE profile_id = auth.uid() AND role = 'admin'
));
