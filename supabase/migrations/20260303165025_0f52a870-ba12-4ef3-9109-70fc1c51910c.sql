
-- Add new voirie-related action types to the enum
ALTER TYPE public.email_action_type ADD VALUE IF NOT EXISTS 'attach_voirie_plan';
ALTER TYPE public.email_action_type ADD VALUE IF NOT EXISTS 'attach_pv_roc';
ALTER TYPE public.email_action_type ADD VALUE IF NOT EXISTS 'attach_arrete';

-- Add columns to visites for storing voirie document paths
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS voirie_plan_storage_path text;
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS voirie_pv_roc_storage_path text;
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS voirie_arrete_storage_path text;
ALTER TABLE public.visites ADD COLUMN IF NOT EXISTS voirie_arrete_date date;
