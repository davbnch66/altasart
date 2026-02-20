
-- Add photos array to operations table
ALTER TABLE public.operations ADD COLUMN photos text[] DEFAULT '{}'::text[];

-- Create storage bucket for operation photos
INSERT INTO storage.buckets (id, name, public) VALUES ('operation-photos', 'operation-photos', false);

-- RLS policies for operation-photos bucket
CREATE POLICY "Authenticated users can upload operation photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'operation-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view operation photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'operation-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete operation photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'operation-photos' AND auth.role() = 'authenticated');
