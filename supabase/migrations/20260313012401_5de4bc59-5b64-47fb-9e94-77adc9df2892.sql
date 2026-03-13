-- 1. Remove the weak notifications INSERT policy (public role, no user_id check)
DROP POLICY IF EXISTS "Members can insert notifications" ON public.notifications;

-- 2. Harden sensitive tables: change RLS policies from {public} to {authenticated}
-- resource_personnel
DROP POLICY IF EXISTS "Members can view personnel" ON public.resource_personnel;
CREATE POLICY "Members can view personnel" ON public.resource_personnel FOR SELECT TO authenticated
  USING (resource_id IN (SELECT rc.resource_id FROM resource_companies rc WHERE rc.company_id IN (SELECT get_my_company_ids())));

DROP POLICY IF EXISTS "Members can create personnel" ON public.resource_personnel;
CREATE POLICY "Members can create personnel" ON public.resource_personnel FOR INSERT TO authenticated
  WITH CHECK (resource_id IN (SELECT rc.resource_id FROM resource_companies rc WHERE rc.company_id IN (SELECT get_my_company_ids())));

DROP POLICY IF EXISTS "Members can update personnel" ON public.resource_personnel;
CREATE POLICY "Members can update personnel" ON public.resource_personnel FOR UPDATE TO authenticated
  USING (resource_id IN (SELECT rc.resource_id FROM resource_companies rc WHERE rc.company_id IN (SELECT get_my_company_ids())));

DROP POLICY IF EXISTS "Members can delete personnel" ON public.resource_personnel;
CREATE POLICY "Members can delete personnel" ON public.resource_personnel FOR DELETE TO authenticated
  USING (resource_id IN (SELECT rc.resource_id FROM resource_companies rc WHERE rc.company_id IN (SELECT get_my_company_ids())));

-- email_actions
DROP POLICY IF EXISTS "Members can view email_actions" ON public.email_actions;
CREATE POLICY "Members can view email_actions" ON public.email_actions FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can insert email_actions" ON public.email_actions;
CREATE POLICY "Members can insert email_actions" ON public.email_actions FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update email_actions" ON public.email_actions;
CREATE POLICY "Members can update email_actions" ON public.email_actions FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- client_contacts
DROP POLICY IF EXISTS "Members can view client_contacts" ON public.client_contacts;
CREATE POLICY "Members can view client_contacts" ON public.client_contacts FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create client_contacts" ON public.client_contacts;
CREATE POLICY "Members can create client_contacts" ON public.client_contacts FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update client_contacts" ON public.client_contacts;
CREATE POLICY "Members can update client_contacts" ON public.client_contacts FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete client_contacts" ON public.client_contacts;
CREATE POLICY "Members can delete client_contacts" ON public.client_contacts FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- inbound_emails
DROP POLICY IF EXISTS "Members can view inbound_emails" ON public.inbound_emails;
CREATE POLICY "Members can view inbound_emails" ON public.inbound_emails FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can insert inbound_emails" ON public.inbound_emails;
CREATE POLICY "Members can insert inbound_emails" ON public.inbound_emails FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update inbound_emails" ON public.inbound_emails;
CREATE POLICY "Members can update inbound_emails" ON public.inbound_emails FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- visite_pieces
DROP POLICY IF EXISTS "Members can view visite_pieces" ON public.visite_pieces;
CREATE POLICY "Members can view visite_pieces" ON public.visite_pieces FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create visite_pieces" ON public.visite_pieces;
CREATE POLICY "Members can create visite_pieces" ON public.visite_pieces FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update visite_pieces" ON public.visite_pieces;
CREATE POLICY "Members can update visite_pieces" ON public.visite_pieces FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete visite_pieces" ON public.visite_pieces;
CREATE POLICY "Members can delete visite_pieces" ON public.visite_pieces FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- visite_materiel_affectations
DROP POLICY IF EXISTS "Members can view affectations" ON public.visite_materiel_affectations;
CREATE POLICY "Members can view affectations" ON public.visite_materiel_affectations FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create affectations" ON public.visite_materiel_affectations;
CREATE POLICY "Members can create affectations" ON public.visite_materiel_affectations FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update affectations" ON public.visite_materiel_affectations;
CREATE POLICY "Members can update affectations" ON public.visite_materiel_affectations FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete affectations" ON public.visite_materiel_affectations;
CREATE POLICY "Members can delete affectations" ON public.visite_materiel_affectations FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- event_resources
DROP POLICY IF EXISTS "Members can view event_resources" ON public.event_resources;
CREATE POLICY "Members can view event_resources" ON public.event_resources FOR SELECT TO authenticated
  USING (event_id IN (SELECT id FROM planning_events WHERE company_id IN (SELECT get_my_company_ids())));

DROP POLICY IF EXISTS "Members can create event_resources" ON public.event_resources;
CREATE POLICY "Members can create event_resources" ON public.event_resources FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT id FROM planning_events WHERE company_id IN (SELECT get_my_company_ids())));

DROP POLICY IF EXISTS "Members can delete event_resources" ON public.event_resources;
CREATE POLICY "Members can delete event_resources" ON public.event_resources FOR DELETE TO authenticated
  USING (event_id IN (SELECT id FROM planning_events WHERE company_id IN (SELECT get_my_company_ids())));

-- operation_resources
DROP POLICY IF EXISTS "Members can view operation_resources" ON public.operation_resources;
CREATE POLICY "Members can view operation_resources" ON public.operation_resources FOR SELECT TO authenticated
  USING (operation_id IN (SELECT id FROM operations WHERE company_id IN (SELECT get_my_company_ids())));

DROP POLICY IF EXISTS "Members can create operation_resources" ON public.operation_resources;
CREATE POLICY "Members can create operation_resources" ON public.operation_resources FOR INSERT TO authenticated
  WITH CHECK (operation_id IN (SELECT id FROM operations WHERE company_id IN (SELECT get_my_company_ids())));

DROP POLICY IF EXISTS "Members can delete operation_resources" ON public.operation_resources;
CREATE POLICY "Members can delete operation_resources" ON public.operation_resources FOR DELETE TO authenticated
  USING (operation_id IN (SELECT id FROM operations WHERE company_id IN (SELECT get_my_company_ids())));

-- email_templates
DROP POLICY IF EXISTS "Members can view email_templates" ON public.email_templates;
CREATE POLICY "Members can view email_templates" ON public.email_templates FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create email_templates" ON public.email_templates;
CREATE POLICY "Members can create email_templates" ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update email_templates" ON public.email_templates;
CREATE POLICY "Members can update email_templates" ON public.email_templates FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete email_templates" ON public.email_templates;
CREATE POLICY "Members can delete email_templates" ON public.email_templates FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- avaries
DROP POLICY IF EXISTS "Members can view avaries" ON public.avaries;
CREATE POLICY "Members can view avaries" ON public.avaries FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create avaries" ON public.avaries;
CREATE POLICY "Members can create avaries" ON public.avaries FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update avaries" ON public.avaries;
CREATE POLICY "Members can update avaries" ON public.avaries FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete avaries" ON public.avaries;
CREATE POLICY "Members can delete avaries" ON public.avaries FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- client_notes
DROP POLICY IF EXISTS "Members can view client_notes" ON public.client_notes;
CREATE POLICY "Members can view client_notes" ON public.client_notes FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create client_notes" ON public.client_notes;
CREATE POLICY "Members can create client_notes" ON public.client_notes FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update client_notes" ON public.client_notes;
CREATE POLICY "Members can update client_notes" ON public.client_notes FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete client_notes" ON public.client_notes;
CREATE POLICY "Members can delete client_notes" ON public.client_notes FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- document_templates
DROP POLICY IF EXISTS "Members can view document_templates" ON public.document_templates;
CREATE POLICY "Members can view document_templates" ON public.document_templates FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create document_templates" ON public.document_templates;
CREATE POLICY "Members can create document_templates" ON public.document_templates FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update document_templates" ON public.document_templates;
CREATE POLICY "Members can update document_templates" ON public.document_templates FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete document_templates" ON public.document_templates;
CREATE POLICY "Members can delete document_templates" ON public.document_templates FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- devis_templates
DROP POLICY IF EXISTS "Members can view devis_templates" ON public.devis_templates;
CREATE POLICY "Members can view devis_templates" ON public.devis_templates FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create devis_templates" ON public.devis_templates;
CREATE POLICY "Members can create devis_templates" ON public.devis_templates FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update devis_templates" ON public.devis_templates;
CREATE POLICY "Members can update devis_templates" ON public.devis_templates FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete devis_templates" ON public.devis_templates;
CREATE POLICY "Members can delete devis_templates" ON public.devis_templates FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- visite_contraintes
DROP POLICY IF EXISTS "Members can view visite_contraintes" ON public.visite_contraintes;
CREATE POLICY "Members can view visite_contraintes" ON public.visite_contraintes FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create visite_contraintes" ON public.visite_contraintes;
CREATE POLICY "Members can create visite_contraintes" ON public.visite_contraintes FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update visite_contraintes" ON public.visite_contraintes;
CREATE POLICY "Members can update visite_contraintes" ON public.visite_contraintes FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete visite_contraintes" ON public.visite_contraintes;
CREATE POLICY "Members can delete visite_contraintes" ON public.visite_contraintes FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- visite_methodologie
DROP POLICY IF EXISTS "Members can view visite_methodologie" ON public.visite_methodologie;
CREATE POLICY "Members can view visite_methodologie" ON public.visite_methodologie FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create visite_methodologie" ON public.visite_methodologie;
CREATE POLICY "Members can create visite_methodologie" ON public.visite_methodologie FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update visite_methodologie" ON public.visite_methodologie;
CREATE POLICY "Members can update visite_methodologie" ON public.visite_methodologie FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete visite_methodologie" ON public.visite_methodologie;
CREATE POLICY "Members can delete visite_methodologie" ON public.visite_methodologie FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- visite_vehicules
DROP POLICY IF EXISTS "Members can view visite_vehicules" ON public.visite_vehicules;
CREATE POLICY "Members can view visite_vehicules" ON public.visite_vehicules FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create visite_vehicules" ON public.visite_vehicules;
CREATE POLICY "Members can create visite_vehicules" ON public.visite_vehicules FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update visite_vehicules" ON public.visite_vehicules;
CREATE POLICY "Members can update visite_vehicules" ON public.visite_vehicules FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete visite_vehicules" ON public.visite_vehicules;
CREATE POLICY "Members can delete visite_vehicules" ON public.visite_vehicules FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- visite_materiel
DROP POLICY IF EXISTS "Members can view visite_materiel" ON public.visite_materiel;
CREATE POLICY "Members can view visite_materiel" ON public.visite_materiel FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create visite_materiel" ON public.visite_materiel;
CREATE POLICY "Members can create visite_materiel" ON public.visite_materiel FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update visite_materiel" ON public.visite_materiel;
CREATE POLICY "Members can update visite_materiel" ON public.visite_materiel FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete visite_materiel" ON public.visite_materiel;
CREATE POLICY "Members can delete visite_materiel" ON public.visite_materiel FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- visite_photos
DROP POLICY IF EXISTS "Members can view visite_photos" ON public.visite_photos;
CREATE POLICY "Members can view visite_photos" ON public.visite_photos FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create visite_photos" ON public.visite_photos;
CREATE POLICY "Members can create visite_photos" ON public.visite_photos FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update visite_photos" ON public.visite_photos;
CREATE POLICY "Members can update visite_photos" ON public.visite_photos FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete visite_photos" ON public.visite_photos;
CREATE POLICY "Members can delete visite_photos" ON public.visite_photos FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- fleet_vehicles
DROP POLICY IF EXISTS "Members can view fleet" ON public.fleet_vehicles;
CREATE POLICY "Members can view fleet" ON public.fleet_vehicles FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create fleet" ON public.fleet_vehicles;
CREATE POLICY "Members can create fleet" ON public.fleet_vehicles FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update fleet" ON public.fleet_vehicles;
CREATE POLICY "Members can update fleet" ON public.fleet_vehicles FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete fleet" ON public.fleet_vehicles;
CREATE POLICY "Members can delete fleet" ON public.fleet_vehicles FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- dossier_costs
DROP POLICY IF EXISTS "Members can view dossier_costs" ON public.dossier_costs;
CREATE POLICY "Members can view dossier_costs" ON public.dossier_costs FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create dossier_costs" ON public.dossier_costs;
CREATE POLICY "Members can create dossier_costs" ON public.dossier_costs FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update dossier_costs" ON public.dossier_costs;
CREATE POLICY "Members can update dossier_costs" ON public.dossier_costs FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete dossier_costs" ON public.dossier_costs;
CREATE POLICY "Members can delete dossier_costs" ON public.dossier_costs FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- storage_units
DROP POLICY IF EXISTS "Members can view storage" ON public.storage_units;
CREATE POLICY "Members can view storage" ON public.storage_units FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can create storage" ON public.storage_units;
CREATE POLICY "Members can create storage" ON public.storage_units FOR INSERT TO authenticated
  WITH CHECK (is_member(company_id));

DROP POLICY IF EXISTS "Members can update storage" ON public.storage_units;
CREATE POLICY "Members can update storage" ON public.storage_units FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

DROP POLICY IF EXISTS "Members can delete storage" ON public.storage_units;
CREATE POLICY "Members can delete storage" ON public.storage_units FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_my_company_ids()));

-- resource_interventions
DROP POLICY IF EXISTS "Members can view interventions" ON public.resource_interventions;
CREATE POLICY "Members can view interventions" ON public.resource_interventions FOR SELECT TO authenticated
  USING (resource_id IN (SELECT rc.resource_id FROM resource_companies rc WHERE rc.company_id IN (SELECT get_my_company_ids())));

DROP POLICY IF EXISTS "Members can create interventions" ON public.resource_interventions;
CREATE POLICY "Members can create interventions" ON public.resource_interventions FOR INSERT TO authenticated
  WITH CHECK (resource_id IN (SELECT rc.resource_id FROM resource_companies rc WHERE rc.company_id IN (SELECT get_my_company_ids())));

DROP POLICY IF EXISTS "Members can update interventions" ON public.resource_interventions;
CREATE POLICY "Members can update interventions" ON public.resource_interventions FOR UPDATE TO authenticated
  USING (resource_id IN (SELECT rc.resource_id FROM resource_companies rc WHERE rc.company_id IN (SELECT get_my_company_ids())));

DROP POLICY IF EXISTS "Members can delete interventions" ON public.resource_interventions;
CREATE POLICY "Members can delete interventions" ON public.resource_interventions FOR DELETE TO authenticated
  USING (resource_id IN (SELECT rc.resource_id FROM resource_companies rc WHERE rc.company_id IN (SELECT get_my_company_ids())));