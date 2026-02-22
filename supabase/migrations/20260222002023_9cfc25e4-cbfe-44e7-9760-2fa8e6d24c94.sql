
-- Table de liaison : plusieurs ressources (véhicules, personnel) par opération/BT
CREATE TABLE public.operation_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_id uuid NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(operation_id, resource_id)
);

-- Enable RLS
ALTER TABLE public.operation_resources ENABLE ROW LEVEL SECURITY;

-- RLS: members can view operation_resources if they can view the operation
CREATE POLICY "Members can view operation_resources"
  ON public.operation_resources FOR SELECT
  USING (operation_id IN (
    SELECT id FROM public.operations WHERE company_id IN (SELECT get_my_company_ids())
  ));

CREATE POLICY "Members can create operation_resources"
  ON public.operation_resources FOR INSERT
  WITH CHECK (operation_id IN (
    SELECT id FROM public.operations WHERE company_id IN (SELECT get_my_company_ids())
  ));

CREATE POLICY "Members can delete operation_resources"
  ON public.operation_resources FOR DELETE
  USING (operation_id IN (
    SELECT id FROM public.operations WHERE company_id IN (SELECT get_my_company_ids())
  ));

-- Seed existing data: migrate current assigned_to into operation_resources
-- For each operation that has an assigned_to, find the resource linked to that profile
INSERT INTO public.operation_resources (operation_id, resource_id)
SELECT o.id, r.id
FROM public.operations o
JOIN public.resources r ON r.linked_profile_id = o.assigned_to
WHERE o.assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;
