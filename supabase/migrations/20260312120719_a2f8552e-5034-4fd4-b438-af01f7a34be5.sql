
CREATE TABLE public.user_theme_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dark_mode boolean NOT NULL DEFAULT false,
  border_radius text NOT NULL DEFAULT '0.5rem',
  font_size text NOT NULL DEFAULT 'normal',
  company_colors jsonb NOT NULL DEFAULT '{}'::jsonb,
  sidebar_style text NOT NULL DEFAULT 'default',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_theme_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own theme" ON public.user_theme_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own theme" ON public.user_theme_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own theme" ON public.user_theme_settings
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_theme_updated_at BEFORE UPDATE ON public.user_theme_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
