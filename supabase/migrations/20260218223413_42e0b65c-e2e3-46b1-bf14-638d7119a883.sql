
-- Table: interventions sur les ressources (VGP, entretiens, réparations)
CREATE TABLE public.resource_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'entretien', -- 'vgp', 'entretien', 'reparation', 'controle', 'nettoyage'
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planifie', -- 'planifie', 'en_cours', 'termine', 'annule'
  priority text NOT NULL DEFAULT 'normale', -- 'urgente', 'haute', 'normale', 'basse'
  scheduled_date date,
  completed_date date,
  next_due_date date,
  cost numeric DEFAULT 0,
  provider text, -- prestataire
  reference text, -- numéro de bon de commande, rapport...
  notes text,
  attachments text[] DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resource_interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view interventions"
  ON public.resource_interventions FOR SELECT
  USING (resource_id IN (
    SELECT rc.resource_id FROM resource_companies rc
    WHERE rc.company_id IN (SELECT get_my_company_ids())
  ));

CREATE POLICY "Members can create interventions"
  ON public.resource_interventions FOR INSERT
  WITH CHECK (resource_id IN (
    SELECT rc.resource_id FROM resource_companies rc
    WHERE rc.company_id IN (SELECT get_my_company_ids())
  ));

CREATE POLICY "Members can update interventions"
  ON public.resource_interventions FOR UPDATE
  USING (resource_id IN (
    SELECT rc.resource_id FROM resource_companies rc
    WHERE rc.company_id IN (SELECT get_my_company_ids())
  ));

CREATE POLICY "Members can delete interventions"
  ON public.resource_interventions FOR DELETE
  USING (resource_id IN (
    SELECT rc.resource_id FROM resource_companies rc
    WHERE rc.company_id IN (SELECT get_my_company_ids())
  ));

-- Table: données spécifiques au personnel (RH)
CREATE TABLE public.resource_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL UNIQUE REFERENCES public.resources(id) ON DELETE CASCADE,
  -- Infos pro
  job_title text,
  employee_id text, -- matricule
  hire_date date,
  contract_type text DEFAULT 'CDI', -- CDI, CDD, intérim, apprentissage
  -- Certifications & habilitations
  caces text[], -- R372, R489, etc.
  habilitations_elec text[], -- B0, H0, BR, etc.
  aipr boolean DEFAULT false, -- autorisation d'intervention à proximité des réseaux
  sst boolean DEFAULT false, -- sauveteur-secouriste du travail
  -- Visites médicales
  last_medical_visit date,
  next_medical_visit date,
  medical_aptitude text DEFAULT 'apte', -- apte, apte_restrictions, inapte
  -- Formations
  -- Congés et absences seront gérés via resource_interventions type absence
  -- Infos personnelles optionnelles
  phone text,
  emergency_contact text,
  emergency_phone text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resource_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view personnel"
  ON public.resource_personnel FOR SELECT
  USING (resource_id IN (
    SELECT rc.resource_id FROM resource_companies rc
    WHERE rc.company_id IN (SELECT get_my_company_ids())
  ));

CREATE POLICY "Members can create personnel"
  ON public.resource_personnel FOR INSERT
  WITH CHECK (resource_id IN (
    SELECT rc.resource_id FROM resource_companies rc
    WHERE rc.company_id IN (SELECT get_my_company_ids())
  ));

CREATE POLICY "Members can update personnel"
  ON public.resource_personnel FOR UPDATE
  USING (resource_id IN (
    SELECT rc.resource_id FROM resource_companies rc
    WHERE rc.company_id IN (SELECT get_my_company_ids())
  ));

CREATE POLICY "Members can delete personnel"
  ON public.resource_personnel FOR DELETE
  USING (resource_id IN (
    SELECT rc.resource_id FROM resource_companies rc
    WHERE rc.company_id IN (SELECT get_my_company_ids())
  ));

-- Table: données techniques pour les engins/véhicules
CREATE TABLE public.resource_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL UNIQUE REFERENCES public.resources(id) ON DELETE CASCADE,
  -- Identification
  registration text,
  serial_number text,
  brand text,
  model text,
  year_manufacture integer,
  -- Caractéristiques techniques
  capacity_tons numeric,
  reach_meters numeric,
  height_meters numeric,
  weight_tons numeric,
  -- Réglementaire
  insurance_expiry date,
  insurance_policy text,
  technical_control_expiry date,
  vgp_expiry date, -- Vérification Générale Périodique
  vgp_frequency_months integer DEFAULT 12,
  next_maintenance_date date,
  maintenance_interval_km integer,
  current_km integer,
  -- Financier
  daily_rate numeric,
  purchase_date date,
  purchase_price numeric,
  -- Notes
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resource_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view equipment"
  ON public.resource_equipment FOR SELECT
  USING (resource_id IN (
    SELECT rc.resource_id FROM resource_companies rc
    WHERE rc.company_id IN (SELECT get_my_company_ids())
  ));

CREATE POLICY "Members can create equipment"
  ON public.resource_equipment FOR INSERT
  WITH CHECK (resource_id IN (
    SELECT rc.resource_id FROM resource_companies rc
    WHERE rc.company_id IN (SELECT get_my_company_ids())
  ));

CREATE POLICY "Members can update equipment"
  ON public.resource_equipment FOR UPDATE
  USING (resource_id IN (
    SELECT rc.resource_id FROM resource_companies rc
    WHERE rc.company_id IN (SELECT get_my_company_ids())
  ));

CREATE POLICY "Members can delete equipment"
  ON public.resource_equipment FOR DELETE
  USING (resource_id IN (
    SELECT rc.resource_id FROM resource_companies rc
    WHERE rc.company_id IN (SELECT get_my_company_ids())
  ));

-- Trigger updated_at
CREATE TRIGGER update_resource_interventions_updated_at
  BEFORE UPDATE ON public.resource_interventions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_resource_personnel_updated_at
  BEFORE UPDATE ON public.resource_personnel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_resource_equipment_updated_at
  BEFORE UPDATE ON public.resource_equipment
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
