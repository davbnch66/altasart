
-- Create document_templates table for Word template storage
CREATE TABLE public.document_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  document_type text NOT NULL DEFAULT 'devis',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view document_templates" ON public.document_templates
  FOR SELECT USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can create document_templates" ON public.document_templates
  FOR INSERT WITH CHECK (is_member(company_id));

CREATE POLICY "Members can update document_templates" ON public.document_templates
  FOR UPDATE USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can delete document_templates" ON public.document_templates
  FOR DELETE USING (company_id IN (SELECT get_my_company_ids()));

-- Ensure only one default per company per document_type
CREATE OR REPLACE FUNCTION public.ensure_single_default_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE document_templates
    SET is_default = false
    WHERE company_id = NEW.company_id AND document_type = NEW.document_type AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ensure_single_default_template
  BEFORE INSERT OR UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_template();

-- Create storage bucket for document templates
INSERT INTO storage.buckets (id, name, public) VALUES ('document-templates', 'document-templates', false);

-- Storage RLS policies
CREATE POLICY "Members can upload templates" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'document-templates' AND auth.role() = 'authenticated');

CREATE POLICY "Members can view templates" ON storage.objects
  FOR SELECT USING (bucket_id = 'document-templates' AND auth.role() = 'authenticated');

CREATE POLICY "Members can delete templates" ON storage.objects
  FOR DELETE USING (bucket_id = 'document-templates' AND auth.role() = 'authenticated');
