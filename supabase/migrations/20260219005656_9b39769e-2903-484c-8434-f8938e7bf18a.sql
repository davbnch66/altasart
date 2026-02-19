-- Add new roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'commercial';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'exploitation';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'terrain';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'comptable';
