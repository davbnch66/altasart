
-- Custom email labels/folders table
CREATE TABLE public.email_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  icon text DEFAULT 'folder',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

ALTER TABLE public.email_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view email_labels" ON public.email_labels
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can create email_labels" ON public.email_labels
  FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

CREATE POLICY "Members can update email_labels" ON public.email_labels
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can delete email_labels" ON public.email_labels
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- Add folder and label columns to inbound_emails
ALTER TABLE public.inbound_emails 
  ADD COLUMN IF NOT EXISTS folder text NOT NULL DEFAULT 'inbox',
  ADD COLUMN IF NOT EXISTS label_id uuid REFERENCES public.email_labels(id) ON DELETE SET NULL;

-- Junction table for multiple labels per email
CREATE TABLE public.email_label_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_email_id uuid NOT NULL REFERENCES public.inbound_emails(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.email_labels(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inbound_email_id, label_id)
);

ALTER TABLE public.email_label_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view email_label_assignments" ON public.email_label_assignments
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can create email_label_assignments" ON public.email_label_assignments
  FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

CREATE POLICY "Members can delete email_label_assignments" ON public.email_label_assignments
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));
