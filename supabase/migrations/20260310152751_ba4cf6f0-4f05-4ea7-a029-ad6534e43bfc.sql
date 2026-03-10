
-- ============================================================
-- FIX: Convert ALL remaining RESTRICTIVE RLS policies to PERMISSIVE
-- ============================================================
DO $$
DECLARE
  pol RECORD;
  sql_text TEXT;
  role_clause TEXT;
  r TEXT;
  roles_arr TEXT[];
BEGIN
  FOR pol IN
    SELECT
      schemaname, tablename, policyname, permissive, roles, cmd,
      qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND permissive = 'RESTRICTIVE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    
    roles_arr := pol.roles;
    role_clause := '';
    FOR i IN 1..array_length(roles_arr, 1) LOOP
      IF i > 1 THEN role_clause := role_clause || ', '; END IF;
      r := roles_arr[i];
      IF r = 'public' OR r = 'authenticated' OR r = 'anon' OR r = 'service_role' THEN
        role_clause := role_clause || r;
      ELSE
        role_clause := role_clause || quote_ident(r);
      END IF;
    END LOOP;
    
    sql_text := format('CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR %s TO %s',
      pol.policyname, pol.schemaname, pol.tablename, pol.cmd, role_clause);
      
    IF pol.qual IS NOT NULL THEN
      sql_text := sql_text || ' USING (' || pol.qual || ')';
    END IF;
    
    IF pol.with_check IS NOT NULL THEN
      sql_text := sql_text || ' WITH CHECK (' || pol.with_check || ')';
    END IF;
    
    EXECUTE sql_text;
  END LOOP;
END;
$$;

-- ============================================================
-- FIX: Notifications cross-tenant vulnerability
-- Ensure user_id must belong to the same company
-- ============================================================
DROP POLICY IF EXISTS "Members can create notifications" ON public.notifications;
CREATE POLICY "Members can create notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    is_member(company_id) 
    AND user_id IN (
      SELECT profile_id FROM company_memberships WHERE company_id = notifications.company_id
    )
  );

-- ============================================================
-- TVA: Add tva_rate column to devis_lines
-- ============================================================
ALTER TABLE public.devis_lines ADD COLUMN IF NOT EXISTS tva_rate numeric NOT NULL DEFAULT 20;

-- ============================================================
-- TVA: Add tva_rate column to factures for global TVA rate
-- ============================================================
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS tva_rate numeric NOT NULL DEFAULT 20;
