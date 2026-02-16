
CREATE OR REPLACE FUNCTION public.sync_facture_paid_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_facture_id uuid;
  total numeric;
BEGIN
  -- Determine which facture to update
  IF TG_OP = 'DELETE' THEN
    target_facture_id := OLD.facture_id;
  ELSE
    target_facture_id := NEW.facture_id;
  END IF;

  -- Calculate sum of all reglements for this facture
  SELECT COALESCE(SUM(amount), 0) INTO total
  FROM reglements
  WHERE facture_id = target_facture_id;

  -- Update facture paid_amount and status
  UPDATE factures
  SET paid_amount = total,
      status = CASE
        WHEN total >= amount THEN 'payee'::facture_status
        ELSE status
      END
  WHERE id = target_facture_id;

  -- Handle old facture if facture_id changed on UPDATE
  IF TG_OP = 'UPDATE' AND OLD.facture_id IS DISTINCT FROM NEW.facture_id THEN
    SELECT COALESCE(SUM(amount), 0) INTO total
    FROM reglements
    WHERE facture_id = OLD.facture_id;

    UPDATE factures
    SET paid_amount = total,
        status = CASE
          WHEN total >= amount THEN 'payee'::facture_status
          ELSE status
        END
    WHERE id = OLD.facture_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_paid_amount_on_reglement
AFTER INSERT OR UPDATE OR DELETE ON public.reglements
FOR EACH ROW
EXECUTE FUNCTION public.sync_facture_paid_amount();
