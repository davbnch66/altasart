-- Fix security definer view by setting it to SECURITY INVOKER
ALTER VIEW public.unified_emails SET (security_invoker = on);