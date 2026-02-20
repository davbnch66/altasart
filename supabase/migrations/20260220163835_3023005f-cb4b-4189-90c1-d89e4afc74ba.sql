-- Make bt-reports bucket public so signed URLs work without auth (email context)
UPDATE storage.buckets SET public = true WHERE id = 'bt-reports';

-- Drop old restrictive SELECT policies
DROP POLICY IF EXISTS "Authenticated users can read BT reports" ON storage.objects;
DROP POLICY IF EXISTS "Service role can read BT reports" ON storage.objects;

-- Allow public read (files protected by random UUID paths + signed tokens)
CREATE POLICY "Public can read BT reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'bt-reports');