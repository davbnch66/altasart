-- Create storage bucket for PPSPS files (images, attachments)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ppsps-files', 'ppsps-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for ppsps-files bucket
CREATE POLICY "Authenticated users can upload ppsps files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ppsps-files');

CREATE POLICY "Authenticated users can read ppsps files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ppsps-files');

CREATE POLICY "Authenticated users can delete ppsps files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ppsps-files');

-- Add attachments column to ppsps table for email attachments
ALTER TABLE public.ppsps ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Add images column to ppsps table for embedded images
ALTER TABLE public.ppsps ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb;

-- Add custom_sections column for user-added sections
ALTER TABLE public.ppsps ADD COLUMN IF NOT EXISTS custom_sections jsonb DEFAULT '[]'::jsonb;