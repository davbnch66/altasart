
-- Storage policies for resource-documents bucket (private bucket)
-- Allow authenticated members to upload files
CREATE POLICY "Members can upload resource documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resource-documents'
);

-- Allow authenticated members to download/view files
CREATE POLICY "Members can download resource documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resource-documents'
);

-- Allow authenticated members to delete their files
CREATE POLICY "Members can delete resource documents storage"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resource-documents'
);
