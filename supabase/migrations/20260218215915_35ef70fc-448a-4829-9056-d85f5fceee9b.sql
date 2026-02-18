
-- Update trigger to also set valid_until on INSERT if not provided
CREATE OR REPLACE FUNCTION public.auto_set_valid_until_on_send()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT: set valid_until to created_at + 30 days if not provided
  IF TG_OP = 'INSERT' AND NEW.valid_until IS NULL THEN
    NEW.valid_until := (NEW.created_at + INTERVAL '30 days')::date;
  END IF;

  -- On UPDATE: when sent_at is newly set and valid_until is still null, use sent_at + 30 days
  IF TG_OP = 'UPDATE' AND NEW.sent_at IS NOT NULL 
     AND (OLD.sent_at IS NULL OR OLD.sent_at IS DISTINCT FROM NEW.sent_at) 
     AND NEW.valid_until IS NULL THEN
    NEW.valid_until := (NEW.sent_at + INTERVAL '30 days')::date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add INSERT trigger as well
DROP TRIGGER IF EXISTS set_valid_until_on_send ON public.devis;

CREATE TRIGGER set_valid_until_on_send
BEFORE INSERT OR UPDATE ON public.devis
FOR EACH ROW
EXECUTE FUNCTION public.auto_set_valid_until_on_send();
