-- Create a storage bucket for BT reports
INSERT INTO storage.buckets (id, name, public) VALUES ('bt-reports', 'bt-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload reports
CREATE POLICY "Authenticated users can upload BT reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bt-reports');

-- Allow authenticated users to read reports
CREATE POLICY "Authenticated users can read BT reports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'bt-reports');

-- Allow service role (edge function) to read reports
CREATE POLICY "Service role can read BT reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'bt-reports');

-- Allow cleanup of old reports
CREATE POLICY "Authenticated users can delete BT reports"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'bt-reports');