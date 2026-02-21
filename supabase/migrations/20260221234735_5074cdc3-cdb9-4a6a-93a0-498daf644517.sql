
-- Table des dépenses véhicules (gasoil, entretien, péages, lavage, amendes, etc.)
CREATE TABLE public.vehicle_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  expense_type TEXT NOT NULL DEFAULT 'gasoil',
  -- gasoil, entretien, peage, lavage, amende, reparation, autre
  amount NUMERIC NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor TEXT,
  description TEXT,
  liters NUMERIC,
  mileage_km INTEGER,
  reference TEXT,
  photo_url TEXT,
  ai_extracted BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_expenses ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view vehicle_expenses"
  ON public.vehicle_expenses FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can create vehicle_expenses"
  ON public.vehicle_expenses FOR INSERT
  WITH CHECK (is_member(company_id));

CREATE POLICY "Members can update vehicle_expenses"
  ON public.vehicle_expenses FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can delete vehicle_expenses"
  ON public.vehicle_expenses FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

-- Trigger updated_at
CREATE TRIGGER update_vehicle_expenses_updated_at
  BEFORE UPDATE ON public.vehicle_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Storage bucket pour les photos de tickets/factures
INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-expenses', 'vehicle-expenses', false)
ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Auth users can upload expense photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vehicle-expenses' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users can view expense photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-expenses' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete expense photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'vehicle-expenses' AND auth.role() = 'authenticated');
