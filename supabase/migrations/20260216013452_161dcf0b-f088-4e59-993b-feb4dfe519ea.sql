
-- Add visite_id to devis table to track AI-generated quotes from visits
ALTER TABLE public.devis ADD COLUMN visite_id uuid REFERENCES public.visites(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_devis_visite_id ON public.devis(visite_id);
