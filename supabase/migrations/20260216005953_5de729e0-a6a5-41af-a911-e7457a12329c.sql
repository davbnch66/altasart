
-- =============================================
-- 1. PIÈCES / ZONES
-- =============================================
CREATE TABLE public.visite_pieces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visite_id UUID NOT NULL REFERENCES public.visites(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  name TEXT NOT NULL,
  floor_level TEXT,
  dimensions TEXT,
  access_comments TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visite_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view visite_pieces" ON public.visite_pieces FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create visite_pieces" ON public.visite_pieces FOR INSERT
  WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update visite_pieces" ON public.visite_pieces FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete visite_pieces" ON public.visite_pieces FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE TRIGGER update_visite_pieces_updated_at BEFORE UPDATE ON public.visite_pieces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 2. PHOTOS (liées à une pièce ou directement à la visite)
-- =============================================
CREATE TABLE public.visite_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visite_id UUID NOT NULL REFERENCES public.visites(id) ON DELETE CASCADE,
  piece_id UUID REFERENCES public.visite_pieces(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  storage_path TEXT NOT NULL,
  file_name TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visite_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view visite_photos" ON public.visite_photos FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create visite_photos" ON public.visite_photos FOR INSERT
  WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update visite_photos" ON public.visite_photos FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete visite_photos" ON public.visite_photos FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

-- =============================================
-- 3. MATÉRIEL (liste globale par visite)
-- =============================================
CREATE TABLE public.visite_materiel (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visite_id UUID NOT NULL REFERENCES public.visites(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  designation TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  dimensions TEXT,
  weight NUMERIC,
  unit TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visite_materiel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view visite_materiel" ON public.visite_materiel FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create visite_materiel" ON public.visite_materiel FOR INSERT
  WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update visite_materiel" ON public.visite_materiel FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete visite_materiel" ON public.visite_materiel FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE TRIGGER update_visite_materiel_updated_at BEFORE UPDATE ON public.visite_materiel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 4. AFFECTATION MATÉRIEL → PIÈCES
-- =============================================
CREATE TABLE public.visite_materiel_affectations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  materiel_id UUID NOT NULL REFERENCES public.visite_materiel(id) ON DELETE CASCADE,
  piece_id UUID NOT NULL REFERENCES public.visite_pieces(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visite_materiel_affectations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view affectations" ON public.visite_materiel_affectations FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create affectations" ON public.visite_materiel_affectations FOR INSERT
  WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update affectations" ON public.visite_materiel_affectations FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete affectations" ON public.visite_materiel_affectations FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

-- =============================================
-- 5. RESSOURCES HUMAINES
-- =============================================
CREATE TABLE public.visite_ressources_humaines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visite_id UUID NOT NULL REFERENCES public.visites(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  role TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  duration_estimate TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visite_ressources_humaines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view visite_rh" ON public.visite_ressources_humaines FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create visite_rh" ON public.visite_ressources_humaines FOR INSERT
  WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update visite_rh" ON public.visite_ressources_humaines FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete visite_rh" ON public.visite_ressources_humaines FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

-- =============================================
-- 6. VÉHICULES ET ENGINS
-- =============================================
CREATE TYPE public.vehicule_type AS ENUM (
  'utilitaire', 'camion', 'semi', 'grue_mobile', 'bras_de_grue',
  'nacelle', 'chariot', 'palan', 'autre'
);

CREATE TABLE public.visite_vehicules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visite_id UUID NOT NULL REFERENCES public.visites(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  type public.vehicule_type NOT NULL DEFAULT 'utilitaire',
  label TEXT,
  height NUMERIC,
  reach NUMERIC,
  capacity NUMERIC,
  road_constraints TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visite_vehicules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view visite_vehicules" ON public.visite_vehicules FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create visite_vehicules" ON public.visite_vehicules FOR INSERT
  WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update visite_vehicules" ON public.visite_vehicules FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete visite_vehicules" ON public.visite_vehicules FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

-- =============================================
-- 7. CONTRAINTES ACCÈS
-- =============================================
CREATE TABLE public.visite_contraintes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visite_id UUID NOT NULL REFERENCES public.visites(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  door_width TEXT,
  stairs TEXT,
  freight_elevator BOOLEAN DEFAULT false,
  ramp BOOLEAN DEFAULT false,
  obstacles TEXT,
  authorizations TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visite_contraintes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view visite_contraintes" ON public.visite_contraintes FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create visite_contraintes" ON public.visite_contraintes FOR INSERT
  WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update visite_contraintes" ON public.visite_contraintes FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete visite_contraintes" ON public.visite_contraintes FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE TRIGGER update_visite_contraintes_updated_at BEFORE UPDATE ON public.visite_contraintes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 8. MÉTHODOLOGIE / NOTES TECHNIQUES
-- =============================================
CREATE TABLE public.visite_methodologie (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visite_id UUID NOT NULL REFERENCES public.visites(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  title TEXT NOT NULL DEFAULT 'Méthodologie',
  content TEXT,
  checklist JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visite_methodologie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view visite_methodologie" ON public.visite_methodologie FOR SELECT
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create visite_methodologie" ON public.visite_methodologie FOR INSERT
  WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update visite_methodologie" ON public.visite_methodologie FOR UPDATE
  USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete visite_methodologie" ON public.visite_methodologie FOR DELETE
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE TRIGGER update_visite_methodologie_updated_at BEFORE UPDATE ON public.visite_methodologie
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 9. STORAGE BUCKET pour les photos visites
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('visite-photos', 'visite-photos', true);

CREATE POLICY "Members can upload visite photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'visite-photos');

CREATE POLICY "Anyone can view visite photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'visite-photos');

CREATE POLICY "Members can delete visite photos" ON storage.objects FOR DELETE
  USING (bucket_id = 'visite-photos');

-- =============================================
-- 10. INDEX PERFORMANCE
-- =============================================
CREATE INDEX idx_visite_pieces_visite ON public.visite_pieces(visite_id);
CREATE INDEX idx_visite_photos_visite ON public.visite_photos(visite_id);
CREATE INDEX idx_visite_photos_piece ON public.visite_photos(piece_id);
CREATE INDEX idx_visite_materiel_visite ON public.visite_materiel(visite_id);
CREATE INDEX idx_visite_affectations_materiel ON public.visite_materiel_affectations(materiel_id);
CREATE INDEX idx_visite_affectations_piece ON public.visite_materiel_affectations(piece_id);
CREATE INDEX idx_visite_rh_visite ON public.visite_ressources_humaines(visite_id);
CREATE INDEX idx_visite_vehicules_visite ON public.visite_vehicules(visite_id);
CREATE INDEX idx_visite_contraintes_visite ON public.visite_contraintes(visite_id);
CREATE INDEX idx_visite_methodologie_visite ON public.visite_methodologie(visite_id);
