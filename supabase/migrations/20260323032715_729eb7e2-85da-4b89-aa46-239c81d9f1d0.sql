
-- Create documents-pdf bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents-pdf', 'documents-pdf', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload/update PDFs for their companies
CREATE POLICY "Authenticated users can upload PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents-pdf');

CREATE POLICY "Authenticated users can update PDFs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents-pdf');

CREATE POLICY "Authenticated users can read PDFs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents-pdf');

CREATE POLICY "Authenticated users can delete PDFs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents-pdf');
