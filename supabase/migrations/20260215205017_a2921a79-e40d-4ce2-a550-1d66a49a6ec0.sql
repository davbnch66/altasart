
-- Create a security definer function to auto-assign first user to all companies
CREATE OR REPLACE FUNCTION public.auto_assign_companies_for_new_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  membership_count int;
BEGIN
  -- Check if user already has memberships
  SELECT count(*) INTO membership_count FROM company_memberships WHERE profile_id = p_user_id;
  
  IF membership_count = 0 THEN
    -- Auto-assign to all companies as admin
    INSERT INTO company_memberships (company_id, profile_id, role)
    SELECT id, p_user_id, 'admin'::app_role
    FROM companies
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
