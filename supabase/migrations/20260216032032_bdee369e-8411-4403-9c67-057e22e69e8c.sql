CREATE POLICY "Members can update visite photos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'visite-photos')
WITH CHECK (bucket_id = 'visite-photos');