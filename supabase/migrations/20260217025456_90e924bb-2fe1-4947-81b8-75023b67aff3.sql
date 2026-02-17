
-- 1. Registre flotte réelle (grues, camions, nacelles...)
CREATE TABLE public.fleet_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'grue',
  registration TEXT,
  brand TEXT,
  model TEXT,
  capacity_tons NUMERIC,
  reach_meters NUMERIC,
  height_meters NUMERIC,
  insurance_expiry DATE,
  technical_control_expiry DATE,
  next_maintenance DATE,
  daily_rate NUMERIC,
  status TEXT NOT NULL DEFAULT 'disponible',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view fleet" ON public.fleet_vehicles FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create fleet" ON public.fleet_vehicles FOR INSERT
  WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update fleet" ON public.fleet_vehicles FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete fleet" ON public.fleet_vehicles FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

-- 2. Templates de devis
CREATE TABLE public.devis_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'manutention',
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.devis_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view devis_templates" ON public.devis_templates FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create devis_templates" ON public.devis_templates FOR INSERT
  WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update devis_templates" ON public.devis_templates FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete devis_templates" ON public.devis_templates FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

-- 3. Coûts par dossier (rentabilité)
CREATE TABLE public.dossier_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dossier_id UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  category TEXT NOT NULL DEFAULT 'main_oeuvre',
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dossier_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view dossier_costs" ON public.dossier_costs FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create dossier_costs" ON public.dossier_costs FOR INSERT
  WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update dossier_costs" ON public.dossier_costs FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete dossier_costs" ON public.dossier_costs FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

-- 4. Catalogue matériel de référence
CREATE TABLE public.materiel_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  designation TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'machine',
  default_weight NUMERIC,
  default_volume NUMERIC,
  default_dimensions TEXT,
  fragility TEXT DEFAULT 'standard',
  handling_notes TEXT,
  unit_price NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.materiel_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view catalog" ON public.materiel_catalog FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create catalog" ON public.materiel_catalog FOR INSERT
  WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update catalog" ON public.materiel_catalog FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete catalog" ON public.materiel_catalog FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

-- 5. Unités de stockage (garde-meuble)
CREATE TABLE public.storage_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  size_m2 NUMERIC,
  volume_m3 NUMERIC,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'libre',
  client_id UUID REFERENCES clients(id),
  dossier_id UUID REFERENCES dossiers(id),
  start_date DATE,
  end_date DATE,
  monthly_rate NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.storage_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view storage" ON public.storage_units FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create storage" ON public.storage_units FOR INSERT
  WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update storage" ON public.storage_units FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete storage" ON public.storage_units FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

-- Trigger updated_at pour les nouvelles tables
CREATE TRIGGER update_fleet_vehicles_updated_at BEFORE UPDATE ON public.fleet_vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_devis_templates_updated_at BEFORE UPDATE ON public.devis_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_storage_units_updated_at BEFORE UPDATE ON public.storage_units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
