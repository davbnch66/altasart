
ALTER TABLE public.visites 
ADD COLUMN IF NOT EXISTS voirie_status text NOT NULL DEFAULT 'non_requise',
ADD COLUMN IF NOT EXISTS voirie_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS voirie_notes text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS voirie_requested_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS voirie_obtained_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.visites.voirie_status IS 'Status: non_requise, a_faire, demandee, en_attente, obtenue, refusee';
COMMENT ON COLUMN public.visites.voirie_type IS 'Type: arrete_stationnement, plan_voirie, emprise, autorisation_grue, autre';
