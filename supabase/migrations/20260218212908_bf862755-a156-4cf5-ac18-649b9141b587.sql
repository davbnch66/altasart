
-- Function to generate a devis code like DEV-2026-001
CREATE OR REPLACE FUNCTION public.generate_devis_code()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INT;
  new_code TEXT;
BEGIN
  -- Only generate if code is NULL
  IF NEW.code IS NOT NULL AND NEW.code != '' THEN
    RETURN NEW;
  END IF;

  year_part := TO_CHAR(NOW(), 'YYYY');

  -- Get next sequence number for this company and year
  SELECT COALESCE(MAX(
    CASE 
      WHEN code ~ ('^DEV-' || year_part || '-[0-9]+$')
      THEN CAST(SPLIT_PART(code, '-', 3) AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO seq_num
  FROM devis
  WHERE company_id = NEW.company_id
    AND code LIKE 'DEV-' || year_part || '-%';

  new_code := 'DEV-' || year_part || '-' || LPAD(seq_num::TEXT, 3, '0');
  NEW.code := new_code;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on devis table
DROP TRIGGER IF EXISTS trg_generate_devis_code ON public.devis;
CREATE TRIGGER trg_generate_devis_code
  BEFORE INSERT ON public.devis
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_devis_code();

-- Backfill existing devis without code, ordered by created_at
DO $$
DECLARE
  r RECORD;
  seq_num INT;
  year_part TEXT;
BEGIN
  FOR r IN (
    SELECT id, company_id, created_at
    FROM devis
    WHERE code IS NULL OR code = ''
    ORDER BY company_id, created_at
  ) LOOP
    year_part := TO_CHAR(r.created_at, 'YYYY');

    SELECT COALESCE(MAX(
      CASE 
        WHEN code ~ ('^DEV-' || year_part || '-[0-9]+$')
        THEN CAST(SPLIT_PART(code, '-', 3) AS INT)
        ELSE 0
      END
    ), 0) + 1
    INTO seq_num
    FROM devis
    WHERE company_id = r.company_id
      AND code LIKE 'DEV-' || year_part || '-%'
      AND id != r.id;

    UPDATE devis
    SET code = 'DEV-' || year_part || '-' || LPAD(seq_num::TEXT, 3, '0')
    WHERE id = r.id;
  END LOOP;
END;
$$;
