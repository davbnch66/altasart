-- Add profile link on resources to connect employee resources to user accounts
ALTER TABLE public.resources ADD COLUMN linked_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add assigned_to on operations to assign BTs to specific users
ALTER TABLE public.operations ADD COLUMN assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX idx_resources_linked_profile ON public.resources(linked_profile_id) WHERE linked_profile_id IS NOT NULL;
CREATE INDEX idx_operations_assigned_to ON public.operations(assigned_to) WHERE assigned_to IS NOT NULL;