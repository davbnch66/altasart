
-- Table opérations liées à un dossier (comme dans Safari)
CREATE TABLE public.operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dossier_id UUID NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  operation_number INTEGER NOT NULL DEFAULT 1,
  type TEXT NOT NULL DEFAULT 'B.T.',
  facture_id UUID REFERENCES public.factures(id) ON DELETE SET NULL,
  loading_date DATE,
  loading_address TEXT,
  loading_city TEXT,
  delivery_address TEXT,
  delivery_city TEXT,
  lv_bt_number TEXT,
  volume NUMERIC DEFAULT 0,
  notes TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add cost column to dossiers for margin calculation
ALTER TABLE public.dossiers ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0;

-- RLS
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view operations"
  ON public.operations FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can create operations"
  ON public.operations FOR INSERT
  WITH CHECK (is_member(company_id));

CREATE POLICY "Members can update operations"
  ON public.operations FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can delete operations"
  ON public.operations FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

-- Trigger updated_at
CREATE TRIGGER update_operations_updated_at
  BEFORE UPDATE ON public.operations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
