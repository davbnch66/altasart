
-- ============================================================
-- FIX 1: Convert ALL RESTRICTIVE RLS policies to PERMISSIVE
-- PostgreSQL requires at least one PERMISSIVE policy for any
-- row to be accessible. RESTRICTIVE-only = no access at all.
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
    -- Drop the restrictive policy
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    
    -- Build role clause
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
    
    -- Build CREATE POLICY statement (PERMISSIVE is the default)
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
-- FIX 2: Create RPC function to securely get/create signature
-- tokens without exposing them via SELECT policy
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_or_create_signature_token(p_devis_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_company_id uuid;
BEGIN
  -- Verify caller has access to this devis via company membership
  SELECT company_id INTO v_company_id
  FROM devis
  WHERE id = p_devis_id
    AND company_id IN (SELECT get_my_company_ids());
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Check for existing valid pending token
  SELECT token INTO v_token
  FROM devis_signatures
  WHERE devis_id = p_devis_id
    AND status = 'pending'
    AND expires_at >= now();
  
  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;

  -- Create new signature record
  INSERT INTO devis_signatures (devis_id, company_id)
  VALUES (p_devis_id, v_company_id)
  RETURNING token INTO v_token;
  
  RETURN v_token;
END;
$$;
