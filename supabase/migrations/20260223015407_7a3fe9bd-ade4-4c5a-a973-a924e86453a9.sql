
-- Create event_resources junction table (like operation_resources)
CREATE TABLE public.event_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.planning_events(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, resource_id)
);

-- Enable RLS
ALTER TABLE public.event_resources ENABLE ROW LEVEL SECURITY;

-- RLS policies matching operation_resources pattern
CREATE POLICY "Members can view event_resources"
  ON public.event_resources FOR SELECT
  USING (event_id IN (
    SELECT id FROM planning_events WHERE company_id IN (SELECT get_my_company_ids())
  ));

CREATE POLICY "Members can create event_resources"
  ON public.event_resources FOR INSERT
  WITH CHECK (event_id IN (
    SELECT id FROM planning_events WHERE company_id IN (SELECT get_my_company_ids())
  ));

CREATE POLICY "Members can delete event_resources"
  ON public.event_resources FOR DELETE
  USING (event_id IN (
    SELECT id FROM planning_events WHERE company_id IN (SELECT get_my_company_ids())
  ));

-- Migrate existing resource_id data to the new junction table
INSERT INTO public.event_resources (event_id, resource_id)
SELECT id, resource_id FROM public.planning_events WHERE resource_id IS NOT NULL
ON CONFLICT DO NOTHING;
