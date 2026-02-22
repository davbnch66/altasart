
-- Add detailed logistics columns to operations table
ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS loading_postal_code text,
  ADD COLUMN IF NOT EXISTS loading_floor text,
  ADD COLUMN IF NOT EXISTS loading_access text,
  ADD COLUMN IF NOT EXISTS loading_elevator boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loading_parking_request boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loading_comments text,
  ADD COLUMN IF NOT EXISTS loading_time_start time,
  ADD COLUMN IF NOT EXISTS loading_time_end time,
  ADD COLUMN IF NOT EXISTS delivery_postal_code text,
  ADD COLUMN IF NOT EXISTS delivery_floor text,
  ADD COLUMN IF NOT EXISTS delivery_access text,
  ADD COLUMN IF NOT EXISTS delivery_elevator boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_parking_request boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_comments text,
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS delivery_time_start time,
  ADD COLUMN IF NOT EXISTS delivery_time_end time,
  ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instructions text;
