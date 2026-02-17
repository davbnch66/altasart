
-- Table avaries/incidents liés aux dossiers
CREATE TABLE public.avaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  dossier_id UUID NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  title TEXT NOT NULL,
  description TEXT,
  photos TEXT[] DEFAULT '{}',
  responsibility TEXT,
  status TEXT NOT NULL DEFAULT 'ouverte',
  resolution TEXT,
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.avaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view avaries" ON public.avaries FOR SELECT USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create avaries" ON public.avaries FOR INSERT WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update avaries" ON public.avaries FOR UPDATE USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete avaries" ON public.avaries FOR DELETE USING (company_id IN (SELECT get_my_company_ids()));

CREATE TRIGGER update_avaries_updated_at BEFORE UPDATE ON public.avaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Table notes internes (annotations horodatées et signées)
CREATE TABLE public.client_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  dossier_id UUID REFERENCES public.dossiers(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'note',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view client_notes" ON public.client_notes FOR SELECT USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can create client_notes" ON public.client_notes FOR INSERT WITH CHECK (is_member(company_id));
CREATE POLICY "Members can update client_notes" ON public.client_notes FOR UPDATE USING (company_id IN (SELECT get_my_company_ids()));
CREATE POLICY "Members can delete client_notes" ON public.client_notes FOR DELETE USING (company_id IN (SELECT get_my_company_ids()));
