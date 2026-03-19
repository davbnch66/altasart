CREATE POLICY "Members can delete inbound_emails"
ON public.inbound_emails
FOR DELETE
TO authenticated
USING (company_id IN (SELECT get_my_company_ids()));

CREATE POLICY "Members can delete email_actions"
ON public.email_actions
FOR DELETE
TO authenticated
USING (company_id IN (SELECT get_my_company_ids()));