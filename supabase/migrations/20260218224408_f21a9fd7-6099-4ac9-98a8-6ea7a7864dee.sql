
-- Table pour les documents RH des ressources (pièce d'identité, contrats, diplômes, etc.)
CREATE TABLE IF NOT EXISTS public.resource_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  document_type TEXT NOT NULL DEFAULT 'autre', -- 'identite', 'contrat', 'diplome', 'caces', 'medical', 'autre'
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  notes TEXT,
  expires_at DATE,
  ai_extracted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.resource_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view resource documents"
ON public.resource_documents FOR SELECT
USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can insert resource documents"
ON public.resource_documents FOR INSERT
WITH CHECK (is_member(company_id));

CREATE POLICY "Members can update resource documents"
ON public.resource_documents FOR UPDATE
USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can delete resource documents"
ON public.resource_documents FOR DELETE
USING (company_id IN (SELECT get_my_company_ids()));

-- Ajouter colonnes de contact et photo à resource_personnel
ALTER TABLE public.resource_personnel 
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS id_number TEXT,
  ADD COLUMN IF NOT EXISTS id_expiry DATE,
  ADD COLUMN IF NOT EXISTS social_security TEXT;

-- Bucket pour les documents RH
INSERT INTO storage.buckets (id, name, public)
VALUES ('resource-documents', 'resource-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies storage
CREATE POLICY "Authenticated users can upload resource documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resource-documents');

CREATE POLICY "Authenticated users can view resource documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resource-documents');

CREATE POLICY "Authenticated users can delete resource documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resource-documents');

CREATE POLICY "Authenticated users can update resource documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'resource-documents');
