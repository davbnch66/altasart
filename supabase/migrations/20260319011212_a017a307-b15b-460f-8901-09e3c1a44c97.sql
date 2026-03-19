CREATE POLICY "Members can delete messages"
ON public.messages
FOR DELETE
TO authenticated
USING (company_id IN (SELECT get_my_company_ids()));