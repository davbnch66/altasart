
-- Function to sync dossier amount from sum of its devis
CREATE OR REPLACE FUNCTION public.sync_dossier_amount_from_devis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_dossier_id uuid;
  total numeric;
BEGIN
  -- Determine which dossier to update
  IF TG_OP = 'DELETE' THEN
    target_dossier_id := OLD.dossier_id;
  ELSE
    target_dossier_id := NEW.dossier_id;
  END IF;

  -- Update current dossier
  IF target_dossier_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO total
    FROM devis
    WHERE dossier_id = target_dossier_id;

    UPDATE dossiers SET amount = total WHERE id = target_dossier_id;
  END IF;

  -- Handle old dossier if dossier_id changed on UPDATE
  IF TG_OP = 'UPDATE' AND OLD.dossier_id IS DISTINCT FROM NEW.dossier_id AND OLD.dossier_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO total
    FROM devis
    WHERE dossier_id = OLD.dossier_id;

    UPDATE dossiers SET amount = total WHERE id = OLD.dossier_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger on devis table
CREATE TRIGGER sync_dossier_amount_on_devis_change
AFTER INSERT OR UPDATE OR DELETE ON public.devis
FOR EACH ROW
EXECUTE FUNCTION public.sync_dossier_amount_from_devis();
