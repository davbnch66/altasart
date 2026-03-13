
CREATE OR REPLACE FUNCTION public.notify_on_bt_signature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sig_type text;
  signer text;
  dossier_title text;
  dossier_code text;
  member_id uuid;
BEGIN
  -- Determine which signature was just added
  IF OLD.operator_signature_url IS NULL AND NEW.operator_signature_url IS NOT NULL THEN
    sig_type := 'Opérateur';
    signer := COALESCE(NEW.operator_signer_name, 'Inconnu');
  ELSIF OLD.start_signature_url IS NULL AND NEW.start_signature_url IS NOT NULL THEN
    sig_type := 'Début client';
    signer := COALESCE(NEW.start_signer_name, 'Inconnu');
  ELSIF OLD.end_signature_url IS NULL AND NEW.end_signature_url IS NOT NULL THEN
    sig_type := 'Fin client';
    signer := COALESCE(NEW.end_signer_name, 'Inconnu');
  ELSE
    RETURN NEW;
  END IF;

  -- Get dossier info
  SELECT d.title, d.code INTO dossier_title, dossier_code
  FROM dossiers d WHERE d.id = NEW.dossier_id;

  -- Notify all company members
  FOR member_id IN
    SELECT profile_id FROM company_memberships WHERE company_id = NEW.company_id
  LOOP
    INSERT INTO notifications (company_id, user_id, type, title, body, link)
    VALUES (
      NEW.company_id,
      member_id,
      'info',
      'BT signé – ' || sig_type,
      'BT #' || NEW.operation_number || ' (' || COALESCE(dossier_code, dossier_title) || ') signé par ' || signer,
      '/dossiers/' || NEW.dossier_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_bt_signature
AFTER UPDATE ON operations
FOR EACH ROW
EXECUTE FUNCTION notify_on_bt_signature();
