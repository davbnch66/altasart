import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = user.id;

    const { action_id, status: newStatus } = await req.json();
    if (!action_id || !newStatus) {
      return new Response(JSON.stringify({ error: "action_id and status required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch the action to get type, payload, and related email
    const { data: action, error: fetchErr } = await supabase
      .from("email_actions")
      .select("*, inbound_emails(client_id, company_id, dossier_id)")
      .eq("id", action_id)
      .single();

    if (fetchErr || !action) {
      return new Response(JSON.stringify({ error: "Action not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let createdId: string | null = null;

    // Only execute creation logic when accepting
    if (newStatus === "accepted") {
      const payload = action.payload || {};
      const companyId = action.company_id;
      const email = action.inbound_emails;
      const clientId = email?.client_id;

      switch (action.action_type) {
        case "create_client": {
          const { data, error } = await supabase.from("clients").insert({
            name: payload.name || "Client sans nom",
            contact_name: payload.contact_name || null,
            email: payload.email || null,
            phone: payload.phone || null,
            mobile: payload.mobile || null,
            address: payload.address || null,
            postal_code: payload.postal_code || null,
            city: payload.city || null,
            company_id: companyId,
          }).select("id").single();
          if (error) throw error;
          createdId = data.id;

          // Auto-create default contact
          if (payload.contact_name) {
            const nameParts = (payload.contact_name as string).trim().split(/\s+/);
            const lastName = nameParts.pop() || payload.contact_name;
            const firstName = nameParts.join(" ") || null;
            await supabase.from("client_contacts").insert({
              client_id: data.id,
              company_id: companyId,
              first_name: firstName,
              last_name: lastName,
              email: payload.email || null,
              phone_office: payload.phone || null,
              mobile: payload.mobile || null,
              is_default: true,
            });
          }

          // Link client to the inbound email
          await supabase.from("inbound_emails")
            .update({ client_id: data.id })
            .eq("id", action.inbound_email_id);
          break;
        }

        case "create_dossier": {
          if (!clientId) {
            throw new Error("Aucun client associé à cet email. Créez d'abord le client.");
          }
          const { data, error } = await supabase.from("dossiers").insert({
            title: payload.title || "Nouveau dossier",
            description: payload.description || null,
            address: payload.address || null,
            client_id: clientId,
            company_id: companyId,
            stage: "prospect",
          }).select("id").single();
          if (error) throw error;
          createdId = data.id;

          // Link dossier to inbound email
          await supabase.from("inbound_emails")
            .update({ dossier_id: data.id })
            .eq("id", action.inbound_email_id);
          break;
        }

        case "create_devis": {
          if (!clientId) {
            throw new Error("Aucun client associé à cet email. Créez d'abord le client.");
          }
          const { data, error } = await supabase.from("devis").insert({
            objet: payload.objet || "Devis",
            notes: payload.notes || null,
            client_id: clientId,
            company_id: companyId,
            dossier_id: email?.dossier_id || null,
            created_by: userId,
            status: "brouillon",
            amount: 0,
          }).select("id").single();
          if (error) throw error;
          createdId = data.id;

          // Link devis to inbound email
          await supabase.from("inbound_emails")
            .update({ devis_id: data.id })
            .eq("id", action.inbound_email_id);
          break;
        }

        case "plan_visite": {
          if (!clientId) {
            throw new Error("Aucun client associé à cet email. Créez d'abord le client.");
          }
          const { data, error } = await supabase.from("visites").insert({
            title: payload.title || "Visite technique",
            address: payload.address || null,
            origin_address_line1: payload.origin_address || payload.address || null,
            origin_postal_code: payload.origin_postal_code || payload.code_postal || null,
            origin_city: payload.origin_city || payload.ville || null,
            dest_address_line1: payload.dest_address || null,
            dest_city: payload.dest_city || null,
            dest_postal_code: payload.dest_postal_code || null,
            zone: payload.zone || null,
            period: payload.periode || null,
            nature: payload.nature || null,
            volume: payload.volume || null,
            origin_floor: payload.etage || null,
            origin_elevator: payload.ascenseur || null,
            instructions: payload.instructions || null,
            client_id: clientId,
            company_id: companyId,
            dossier_id: email?.dossier_id || null,
            created_by: userId,
            status: "planifiee",
            scheduled_date: payload.date_souhaitee || null,
          }).select("id").single();
          if (error) throw error;
          createdId = data.id;

          // Link visite to inbound email
          await supabase.from("inbound_emails")
            .update({ visite_id: data.id })
            .eq("id", action.inbound_email_id);
          break;
        }

        case "extract_materiel": {
          // Need a visite_id from the email to attach materiel
          const visiteId = email?.visite_id || (email?.dossier_id ? null : null);
          
          // Try to find a visite linked to this email
          let targetVisiteId = visiteId;
          if (!targetVisiteId) {
            // Check if another action in this email created a visite
            const { data: visiteAction } = await supabase
              .from("email_actions")
              .select("id")
              .eq("inbound_email_id", action.inbound_email_id)
              .eq("action_type", "plan_visite")
              .eq("status", "accepted")
              .single();

            if (visiteAction) {
              // Re-fetch the email to get the linked visite
              const { data: freshEmail } = await supabase
                .from("inbound_emails")
                .select("visite_id")
                .eq("id", action.inbound_email_id)
                .single();
              targetVisiteId = freshEmail?.visite_id;
            }
          }

          if (!targetVisiteId) {
            throw new Error("Aucune visite associée. Planifiez d'abord une visite.");
          }

          const materials = payload.materials || [];
          if (materials.length > 0) {
            const inserts = materials.map((m: any, i: number) => ({
              designation: m.designation || "Matériel",
              quantity: m.quantity || 1,
              weight: m.weight || null,
              dimensions: m.dimensions || null,
              visite_id: targetVisiteId,
              company_id: companyId,
              sort_order: i,
            }));
            const { error } = await supabase.from("visite_materiel").insert(inserts);
            if (error) throw error;
          }
          break;
        }

        case "link_dossier": {
          // Just link the dossier to the email
          if (payload.dossier_id) {
            await supabase.from("inbound_emails")
              .update({ dossier_id: payload.dossier_id })
              .eq("id", action.inbound_email_id);
          }
          break;
        }
      }
    }

    // Update action status
    const { error: updateErr } = await supabase
      .from("email_actions")
      .update({
        status: newStatus,
        executed_at: newStatus === "accepted" ? new Date().toISOString() : null,
        executed_by: newStatus === "accepted" ? userId : null,
      })
      .eq("id", action_id);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true, created_id: createdId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("execute-email-action error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
