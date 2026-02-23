
-- Auto-sync dossier stage based on devis/facture lifecycle
CREATE OR REPLACE FUNCTION public.sync_dossier_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_dossier_id uuid;
  has_devis boolean;
  has_accepted_devis boolean;
  has_facture boolean;
  has_sent_facture boolean;
  all_paid boolean;
  has_operations boolean;
  has_completed_ops boolean;
  current_stage text;
  new_stage text;
BEGIN
  -- Determine which dossier to check
  IF TG_TABLE_NAME = 'devis' THEN
    target_dossier_id := COALESCE(NEW.dossier_id, OLD.dossier_id);
  ELSIF TG_TABLE_NAME = 'factures' THEN
    target_dossier_id := COALESCE(NEW.dossier_id, OLD.dossier_id);
  ELSIF TG_TABLE_NAME = 'reglements' THEN
    -- Get dossier_id from the facture
    SELECT f.dossier_id INTO target_dossier_id
    FROM factures f
    WHERE f.id = COALESCE(NEW.facture_id, OLD.facture_id);
  END IF;

  IF target_dossier_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  -- Get current stage
  SELECT stage::text INTO current_stage FROM dossiers WHERE id = target_dossier_id;
  IF current_stage IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  -- Don't auto-downgrade: only move forward
  -- Check conditions
  SELECT EXISTS(SELECT 1 FROM devis WHERE dossier_id = target_dossier_id) INTO has_devis;
  SELECT EXISTS(SELECT 1 FROM devis WHERE dossier_id = target_dossier_id AND status = 'accepte') INTO has_accepted_devis;
  SELECT EXISTS(SELECT 1 FROM factures WHERE dossier_id = target_dossier_id) INTO has_facture;
  SELECT EXISTS(SELECT 1 FROM factures WHERE dossier_id = target_dossier_id AND status IN ('envoyee', 'payee', 'partielle')) INTO has_sent_facture;
  
  -- Check if all factures are fully paid
  SELECT NOT EXISTS(
    SELECT 1 FROM factures WHERE dossier_id = target_dossier_id AND status != 'payee'
  ) AND has_facture INTO all_paid;

  -- Determine the appropriate stage (only advance, never go back)
  new_stage := current_stage;

  IF all_paid AND has_facture THEN
    new_stage := 'paye';
  ELSIF has_sent_facture THEN
    new_stage := 'facture';
  ELSIF has_accepted_devis THEN
    -- Only advance to accepte if currently at prospect or devis
    IF current_stage IN ('prospect', 'devis') THEN
      new_stage := 'accepte';
    END IF;
  ELSIF has_devis THEN
    IF current_stage = 'prospect' THEN
      new_stage := 'devis';
    END IF;
  END IF;

  -- Only update if advancing (stage order check)
  IF new_stage != current_stage THEN
    -- Define stage order
    DECLARE
      stage_order jsonb := '{"prospect":1,"devis":2,"accepte":3,"planifie":4,"en_cours":5,"termine":6,"facture":7,"paye":8}';
      current_order int;
      new_order int;
    BEGIN
      current_order := (stage_order->>current_stage)::int;
      new_order := (stage_order->>new_stage)::int;
      
      -- Only advance, never go back (except for paye/facture which override)
      IF new_order > current_order OR new_stage IN ('paye', 'facture') THEN
        UPDATE dossiers SET stage = new_stage::dossier_stage WHERE id = target_dossier_id;
      END IF;
    END;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Trigger on devis changes
CREATE TRIGGER sync_dossier_stage_on_devis
AFTER INSERT OR UPDATE OF status, dossier_id OR DELETE ON public.devis
FOR EACH ROW EXECUTE FUNCTION public.sync_dossier_stage();

-- Trigger on factures changes  
CREATE TRIGGER sync_dossier_stage_on_factures
AFTER INSERT OR UPDATE OF status, dossier_id OR DELETE ON public.factures
FOR EACH ROW EXECUTE FUNCTION public.sync_dossier_stage();

-- Trigger on reglements changes (payment received → facture paid → dossier paye)
CREATE TRIGGER sync_dossier_stage_on_reglements
AFTER INSERT OR UPDATE OR DELETE ON public.reglements
FOR EACH ROW EXECUTE FUNCTION public.sync_dossier_stage();
