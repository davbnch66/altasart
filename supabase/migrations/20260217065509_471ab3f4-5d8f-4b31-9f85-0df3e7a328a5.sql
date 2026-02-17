
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a restricted policy: users can only see profiles of people in their companies
CREATE POLICY "Users can view profiles in their companies"
ON public.profiles
FOR SELECT
USING (
  id = auth.uid()
  OR id IN (
    SELECT cm.profile_id
    FROM public.company_memberships cm
    WHERE cm.company_id IN (SELECT public.get_my_company_ids())
  )
);
