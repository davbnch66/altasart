
-- =============================================
-- ENUM TYPES
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'commercial', 'exploitation', 'terrain', 'comptable', 'readonly');
CREATE TYPE public.client_status AS ENUM ('nouveau_lead', 'actif', 'inactif', 'relance');
CREATE TYPE public.dossier_stage AS ENUM ('prospect', 'devis', 'accepte', 'planifie', 'en_cours', 'termine', 'facture', 'paye');
CREATE TYPE public.devis_status AS ENUM ('brouillon', 'envoye', 'accepte', 'refuse', 'expire');
CREATE TYPE public.facture_status AS ENUM ('brouillon', 'envoyee', 'payee', 'en_retard', 'annulee');
CREATE TYPE public.resource_type AS ENUM ('employe', 'grue', 'vehicule', 'equipement', 'equipe');
CREATE TYPE public.resource_status AS ENUM ('disponible', 'occupe', 'maintenance', 'absent');
CREATE TYPE public.visite_status AS ENUM ('planifiee', 'realisee', 'annulee');
CREATE TYPE public.message_channel AS ENUM ('email', 'whatsapp', 'phone', 'internal');

-- =============================================
-- COMPANIES
-- =============================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'primary',
  address TEXT,
  phone TEXT,
  email TEXT,
  siret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  default_company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- COMPANY MEMBERSHIPS
-- =============================================
CREATE TABLE public.company_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'readonly',
  invited_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, profile_id)
);
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CLIENTS
-- =============================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  billing_address TEXT,
  payment_terms TEXT DEFAULT '30 jours date de facture',
  advisor TEXT,
  status client_status NOT NULL DEFAULT 'nouveau_lead',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- =============================================
-- DOSSIERS
-- =============================================
CREATE TABLE public.dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  address TEXT,
  stage dossier_stage NOT NULL DEFAULT 'prospect',
  start_date DATE,
  end_date DATE,
  amount DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;

-- =============================================
-- DEVIS
-- =============================================
CREATE TABLE public.devis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  dossier_id UUID REFERENCES public.dossiers(id),
  code TEXT,
  objet TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status devis_status NOT NULL DEFAULT 'brouillon',
  valid_until DATE,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;

-- =============================================
-- DEVIS LINES
-- =============================================
CREATE TABLE public.devis_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id UUID NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.devis_lines ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FACTURES
-- =============================================
CREATE TABLE public.factures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  dossier_id UUID REFERENCES public.dossiers(id),
  devis_id UUID REFERENCES public.devis(id),
  code TEXT,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status facture_status NOT NULL DEFAULT 'brouillon',
  due_date DATE,
  sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;

-- =============================================
-- REGLEMENTS (PAYMENTS)
-- =============================================
CREATE TABLE public.reglements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  facture_id UUID NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  code TEXT,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  encaissement_date DATE,
  bank TEXT,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reglements ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RESOURCES
-- =============================================
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type resource_type NOT NULL,
  status resource_status NOT NULL DEFAULT 'disponible',
  skills TEXT[],
  permits TEXT[],
  certifications TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Resources can belong to multiple companies
CREATE TABLE public.resource_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  UNIQUE(resource_id, company_id)
);
ALTER TABLE public.resource_companies ENABLE ROW LEVEL SECURITY;

-- =============================================
-- VISITES TECHNIQUES
-- =============================================
CREATE TABLE public.visites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  dossier_id UUID REFERENCES public.dossiers(id),
  title TEXT NOT NULL,
  address TEXT,
  scheduled_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  status visite_status NOT NULL DEFAULT 'planifiee',
  technician_id UUID REFERENCES public.resources(id),
  report TEXT,
  photos_count INT DEFAULT 0,
  signature_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visites ENABLE ROW LEVEL SECURITY;

-- =============================================
-- MESSAGES / INBOX
-- =============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id),
  channel message_channel NOT NULL DEFAULT 'email',
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  sender TEXT,
  subject TEXT,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PLANNING EVENTS
-- =============================================
CREATE TABLE public.planning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  dossier_id UUID REFERENCES public.dossiers(id),
  resource_id UUID REFERENCES public.resources(id),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  color TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.planning_events ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Get company IDs user is member of
CREATE OR REPLACE FUNCTION public.get_my_company_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.company_memberships WHERE profile_id = auth.uid();
$$;

-- Check membership
CREATE OR REPLACE FUNCTION public.is_member(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = p_company_id AND profile_id = auth.uid()
  );
$$;

-- Check role in company
CREATE OR REPLACE FUNCTION public.has_role_in_company(p_company_id UUID, p_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = p_company_id AND profile_id = auth.uid() AND role = p_role
  );
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- PROFILES
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- COMPANIES
CREATE POLICY "Members can view their companies" ON public.companies FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_my_company_ids()));

-- COMPANY MEMBERSHIPS
CREATE POLICY "Members can view memberships" ON public.company_memberships FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Admins can manage memberships" ON public.company_memberships FOR INSERT TO authenticated
  WITH CHECK (public.has_role_in_company(company_id, 'admin') AND profile_id <> auth.uid());
CREATE POLICY "Admins can update memberships" ON public.company_memberships FOR UPDATE TO authenticated
  USING (public.has_role_in_company(company_id, 'admin'));
CREATE POLICY "Admins can delete memberships" ON public.company_memberships FOR DELETE TO authenticated
  USING (public.has_role_in_company(company_id, 'admin'));

-- CLIENTS
CREATE POLICY "Members can view clients" ON public.clients FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can create clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_member(company_id));
CREATE POLICY "Members can update clients" ON public.clients FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Admins can delete clients" ON public.clients FOR DELETE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

-- DOSSIERS
CREATE POLICY "Members can view dossiers" ON public.dossiers FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can create dossiers" ON public.dossiers FOR INSERT TO authenticated
  WITH CHECK (public.is_member(company_id));
CREATE POLICY "Members can update dossiers" ON public.dossiers FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can delete dossiers" ON public.dossiers FOR DELETE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

-- DEVIS
CREATE POLICY "Members can view devis" ON public.devis FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can create devis" ON public.devis FOR INSERT TO authenticated
  WITH CHECK (public.is_member(company_id));
CREATE POLICY "Members can update devis" ON public.devis FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can delete devis" ON public.devis FOR DELETE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

-- DEVIS LINES
CREATE POLICY "Members can view devis lines" ON public.devis_lines FOR SELECT TO authenticated
  USING (devis_id IN (SELECT id FROM public.devis WHERE company_id IN (SELECT public.get_my_company_ids())));
CREATE POLICY "Members can create devis lines" ON public.devis_lines FOR INSERT TO authenticated
  WITH CHECK (devis_id IN (SELECT id FROM public.devis WHERE company_id IN (SELECT public.get_my_company_ids())));
CREATE POLICY "Members can update devis lines" ON public.devis_lines FOR UPDATE TO authenticated
  USING (devis_id IN (SELECT id FROM public.devis WHERE company_id IN (SELECT public.get_my_company_ids())));
CREATE POLICY "Members can delete devis lines" ON public.devis_lines FOR DELETE TO authenticated
  USING (devis_id IN (SELECT id FROM public.devis WHERE company_id IN (SELECT public.get_my_company_ids())));

-- FACTURES
CREATE POLICY "Members can view factures" ON public.factures FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can create factures" ON public.factures FOR INSERT TO authenticated
  WITH CHECK (public.is_member(company_id));
CREATE POLICY "Members can update factures" ON public.factures FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can delete factures" ON public.factures FOR DELETE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

-- REGLEMENTS
CREATE POLICY "Members can view reglements" ON public.reglements FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can create reglements" ON public.reglements FOR INSERT TO authenticated
  WITH CHECK (public.is_member(company_id));
CREATE POLICY "Members can update reglements" ON public.reglements FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can delete reglements" ON public.reglements FOR DELETE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

-- RESOURCES
CREATE POLICY "Members can view resources" ON public.resources FOR SELECT TO authenticated
  USING (id IN (SELECT resource_id FROM public.resource_companies WHERE company_id IN (SELECT public.get_my_company_ids())));
CREATE POLICY "Members can create resources" ON public.resources FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Members can update resources" ON public.resources FOR UPDATE TO authenticated
  USING (id IN (SELECT resource_id FROM public.resource_companies WHERE company_id IN (SELECT public.get_my_company_ids())));

-- RESOURCE COMPANIES
CREATE POLICY "Members can view resource companies" ON public.resource_companies FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can link resources" ON public.resource_companies FOR INSERT TO authenticated
  WITH CHECK (public.is_member(company_id));
CREATE POLICY "Members can unlink resources" ON public.resource_companies FOR DELETE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

-- VISITES
CREATE POLICY "Members can view visites" ON public.visites FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can create visites" ON public.visites FOR INSERT TO authenticated
  WITH CHECK (public.is_member(company_id));
CREATE POLICY "Members can update visites" ON public.visites FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can delete visites" ON public.visites FOR DELETE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

-- MESSAGES
CREATE POLICY "Members can view messages" ON public.messages FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can create messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (public.is_member(company_id));
CREATE POLICY "Members can update messages" ON public.messages FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

-- PLANNING EVENTS
CREATE POLICY "Members can view events" ON public.planning_events FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can create events" ON public.planning_events FOR INSERT TO authenticated
  WITH CHECK (public.is_member(company_id));
CREATE POLICY "Members can update events" ON public.planning_events FOR UPDATE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));
CREATE POLICY "Members can delete events" ON public.planning_events FOR DELETE TO authenticated
  USING (company_id IN (SELECT public.get_my_company_ids()));

-- =============================================
-- TRIGGER: Auto-create profile on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- TRIGGER: Auto-update updated_at
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_dossiers_updated_at BEFORE UPDATE ON public.dossiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_devis_updated_at BEFORE UPDATE ON public.devis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_factures_updated_at BEFORE UPDATE ON public.factures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_visites_updated_at BEFORE UPDATE ON public.visites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_planning_events_updated_at BEFORE UPDATE ON public.planning_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- SEED: Insert the 3 companies
-- =============================================
INSERT INTO public.companies (id, name, short_name, color) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'ART Levage', 'ART', 'company-art'),
  ('a0000000-0000-0000-0000-000000000002', 'Altigrues', 'ALT', 'company-altigrues'),
  ('a0000000-0000-0000-0000-000000000003', 'ASDGM', 'ASDGM', 'company-asdgm');
