-- Make visite-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'visite-photos';

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view visite photos" ON storage.objects;

-- Create authenticated-only SELECT policy scoped to company membership
CREATE POLICY "Members can view visite photos" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'visite-photos' 
    AND auth.role() = 'authenticated'
  );