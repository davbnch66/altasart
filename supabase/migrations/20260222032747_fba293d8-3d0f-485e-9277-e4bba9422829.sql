
-- Make bt-reports bucket private (may already be done)
UPDATE storage.buckets SET public = false WHERE id = 'bt-reports';

-- Drop old public policy if it exists
DROP POLICY IF EXISTS "Anyone can view BT reports" ON storage.objects;

-- Drop policies if they already exist to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can view BT reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload BT reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update BT reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete BT reports" ON storage.objects;

-- Recreate proper policies
CREATE POLICY "Authenticated users can view BT reports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'bt-reports');

CREATE POLICY "Authenticated users can upload BT reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'bt-reports');

CREATE POLICY "Authenticated users can update BT reports"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'bt-reports');

CREATE POLICY "Authenticated users can delete BT reports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'bt-reports');
