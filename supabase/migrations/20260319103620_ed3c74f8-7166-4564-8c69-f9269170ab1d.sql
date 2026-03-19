
-- Table for storing flag assignments on emails (multiple flags per email)
CREATE TABLE public.email_flag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  inbound_email_id uuid NOT NULL REFERENCES public.inbound_emails(id) ON DELETE CASCADE,
  flag_color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inbound_email_id, flag_color)
);

ALTER TABLE public.email_flag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view email flags"
  ON public.email_flag_assignments FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can insert email flags"
  ON public.email_flag_assignments FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can delete email flags"
  ON public.email_flag_assignments FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE INDEX idx_email_flag_assignments_email ON public.email_flag_assignments(inbound_email_id);
CREATE INDEX idx_email_flag_assignments_company ON public.email_flag_assignments(company_id);
