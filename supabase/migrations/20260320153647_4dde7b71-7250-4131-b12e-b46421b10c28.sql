
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  new_email boolean NOT NULL DEFAULT true,
  email_action_suggested boolean NOT NULL DEFAULT true,
  new_client boolean NOT NULL DEFAULT true,
  visite_reminder boolean NOT NULL DEFAULT true,
  devis_signed boolean NOT NULL DEFAULT true,
  popup_new_email boolean NOT NULL DEFAULT true,
  popup_email_action boolean NOT NULL DEFAULT false,
  popup_new_client boolean NOT NULL DEFAULT true,
  popup_visite_reminder boolean NOT NULL DEFAULT false,
  popup_devis_signed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
