
CREATE OR REPLACE FUNCTION public.auto_set_valid_until_on_send()
RETURNS TRIGGER AS $$
BEGIN
  -- When sent_at is set and valid_until is still null, set it to sent_at + 30 days
  IF NEW.sent_at IS NOT NULL AND (OLD.sent_at IS NULL OR OLD.sent_at IS DISTINCT FROM NEW.sent_at) AND NEW.valid_until IS NULL THEN
    NEW.valid_until := (NEW.sent_at + INTERVAL '30 days')::date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_valid_until_on_send
BEFORE UPDATE ON public.devis
FOR EACH ROW
EXECUTE FUNCTION public.auto_set_valid_until_on_send();
