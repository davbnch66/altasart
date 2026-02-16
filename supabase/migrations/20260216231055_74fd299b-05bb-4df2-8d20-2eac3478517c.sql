
-- Fix overly permissive INSERT policies

-- inbound_emails: keep permissive for webhook (service role bypasses RLS anyway)
-- But restrict for anon/authenticated
DROP POLICY "Service can insert inbound_emails" ON public.inbound_emails;
CREATE POLICY "Members can insert inbound_emails" ON public.inbound_emails
  FOR INSERT WITH CHECK (is_member(company_id));

-- email_actions
DROP POLICY "Service can insert email_actions" ON public.email_actions;
CREATE POLICY "Members can insert email_actions" ON public.email_actions
  FOR INSERT WITH CHECK (is_member(company_id));

-- notifications
DROP POLICY "Service can insert notifications" ON public.notifications;
CREATE POLICY "Members can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (is_member(company_id));
