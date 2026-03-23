
-- ═══════════════════════════════════════════════════════════════
-- 1. TVA configurable par société
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_tva_rate numeric NOT NULL DEFAULT 20;

-- ═══════════════════════════════════════════════════════════════
-- 2. Soft delete sur factures et devis
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS archived_by uuid;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS archive_reason text;

ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS archived_by uuid;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS archive_reason text;

-- ═══════════════════════════════════════════════════════════════
-- 3. Module Sous-traitants / Fournisseurs
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  address text,
  siret text,
  category text NOT NULL DEFAULT 'sous-traitant',
  specialties text[] DEFAULT '{}',
  hourly_rate numeric,
  daily_rate numeric,
  notes text,
  status text NOT NULL DEFAULT 'actif',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers: company members can read" ON public.suppliers
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Suppliers: company members can insert" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Suppliers: company members can update" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Suppliers: company members can delete" ON public.suppliers
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

-- Lien opération ↔ fournisseur
CREATE TABLE IF NOT EXISTS public.operation_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid REFERENCES public.operations(id) ON DELETE CASCADE NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'sous-traitant',
  amount numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operation_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OpSuppliers: read via operation" ON public.operation_suppliers
  FOR SELECT TO authenticated
  USING (operation_id IN (
    SELECT id FROM public.operations WHERE company_id IN (SELECT public.get_my_company_ids())
  ));

CREATE POLICY "OpSuppliers: insert via operation" ON public.operation_suppliers
  FOR INSERT TO authenticated
  WITH CHECK (operation_id IN (
    SELECT id FROM public.operations WHERE company_id IN (SELECT public.get_my_company_ids())
  ));

CREATE POLICY "OpSuppliers: update via operation" ON public.operation_suppliers
  FOR UPDATE TO authenticated
  USING (operation_id IN (
    SELECT id FROM public.operations WHERE company_id IN (SELECT public.get_my_company_ids())
  ));

CREATE POLICY "OpSuppliers: delete via operation" ON public.operation_suppliers
  FOR DELETE TO authenticated
  USING (operation_id IN (
    SELECT id FROM public.operations WHERE company_id IN (SELECT public.get_my_company_ids())
  ));

-- ═══════════════════════════════════════════════════════════════
-- 4. Absences / Congés pour les ressources
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.resource_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid REFERENCES public.resources(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL DEFAULT 'conge',
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resource_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Absences: read" ON public.resource_absences
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Absences: insert" ON public.resource_absences
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Absences: update" ON public.resource_absences
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "Absences: delete" ON public.resource_absences
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

-- ═══════════════════════════════════════════════════════════════
-- 5. Relances factures automatiques - table de suivi
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.facture_relances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid REFERENCES public.factures(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  relance_num integer NOT NULL DEFAULT 1,
  sent_at timestamptz NOT NULL DEFAULT now(),
  recipient_email text NOT NULL,
  recipient_name text,
  subject text,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facture_relances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FactRelances: read" ON public.facture_relances
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

CREATE POLICY "FactRelances: insert" ON public.facture_relances
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT public.get_my_company_ids()));

-- ═══════════════════════════════════════════════════════════════
-- 6. Champs de calcul de levage sur visites
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS lifting_charge_kg numeric;
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS lifting_height_m numeric;
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS lifting_reach_m numeric;
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS lifting_ground_pressure numeric;
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS complexity_score integer;

-- ═══════════════════════════════════════════════════════════════
-- 7. Champs de calcul de levage sur dossiers
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.dossiers ADD COLUMN IF NOT EXISTS lifting_charge_kg numeric;
ALTER TABLE public.dossiers ADD COLUMN IF NOT EXISTS lifting_height_m numeric;
ALTER TABLE public.dossiers ADD COLUMN IF NOT EXISTS lifting_reach_m numeric;
ALTER TABLE public.dossiers ADD COLUMN IF NOT EXISTS complexity_score integer;

-- updated_at triggers
CREATE OR REPLACE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
