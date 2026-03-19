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
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    const body = await req.json();
    const action_id = body.action_id;
    const newStatus = body.status;
    const override_payload = body.override_payload;

    // Input validation
    if (!action_id || !newStatus) {
      return new Response(JSON.stringify({ error: "action_id et status requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(action_id)) {
      return new Response(JSON.stringify({ error: "action_id invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const validStatuses = ["accepted", "rejected", "suggested"];
    if (!validStatuses.includes(newStatus)) {
      return new Response(JSON.stringify({ error: "Status invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has access to this action via RLS (user-scoped client)
    const { data: actionAccess, error: accessErr } = await supabaseAuth
      .from("email_actions")
      .select("id")
      .eq("id", action_id)
      .maybeSingle();
    if (accessErr || !actionAccess) {
      return new Response(JSON.stringify({ error: "Action introuvable ou accès refusé" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      return new Response(JSON.stringify({ error: "Action introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let createdId: string | null = null;

    // Only execute creation logic when accepting
    if (newStatus === "accepted") {
      const payload = override_payload ? { ...(action.payload || {}), ...override_payload } : (action.payload || {});
      const companyId = action.company_id;
      
      // Always re-fetch the latest inbound_email data to pick up changes from prior actions
      const { data: freshEmail } = await supabase
        .from("inbound_emails")
        .select("client_id, company_id, dossier_id, visite_id")
        .eq("id", action.inbound_email_id)
        .single();
      const clientId = freshEmail?.client_id || action.inbound_emails?.client_id;
      const emailDossierId = freshEmail?.dossier_id || action.inbound_emails?.dossier_id;
      const emailVisiteId = freshEmail?.visite_id || action.inbound_emails?.visite_id;

      switch (action.action_type) {
        case "create_client": {
          const { data, error } = await supabase.from("clients").insert({
            name: String(payload.name || "Client sans nom").slice(0, 500),
            contact_name: payload.contact_name ? String(payload.contact_name).slice(0, 200) : null,
            email: payload.email ? String(payload.email).slice(0, 320) : null,
            phone: payload.phone ? String(payload.phone).slice(0, 30) : null,
            mobile: payload.mobile ? String(payload.mobile).slice(0, 30) : null,
            address: payload.address ? String(payload.address).slice(0, 500) : null,
            postal_code: payload.postal_code ? String(payload.postal_code).slice(0, 10) : null,
            city: payload.city ? String(payload.city).slice(0, 200) : null,
            company_id: companyId,
          }).select("id").single();
          if (error) throw error;
          createdId = data.id;

          if (payload.contact_name) {
            const nameParts = String(payload.contact_name).trim().split(/\s+/);
            const lastName = nameParts.pop() || String(payload.contact_name);
            const firstName = nameParts.join(" ") || null;
            await supabase.from("client_contacts").insert({
              client_id: data.id,
              company_id: companyId,
              first_name: firstName,
              last_name: lastName,
              email: payload.email ? String(payload.email).slice(0, 320) : null,
              phone_office: payload.phone ? String(payload.phone).slice(0, 30) : null,
              mobile: payload.mobile ? String(payload.mobile).slice(0, 30) : null,
              is_default: true,
            });
          }

          await supabase.from("inbound_emails")
            .update({ client_id: data.id })
            .eq("id", action.inbound_email_id);
          break;
        }

        case "create_dossier": {
          if (!clientId) throw new Error("Aucun client associé à cet email. Créez d'abord le client.");
          const { data, error } = await supabase.from("dossiers").insert({
            title: String(payload.title || "Nouveau dossier").slice(0, 500),
            description: payload.description ? String(payload.description).slice(0, 2000) : null,
            address: payload.address ? String(payload.address).slice(0, 500) : null,
            client_id: clientId,
            company_id: companyId,
            stage: "prospect",
          }).select("id").single();
          if (error) throw error;
          createdId = data.id;

          await supabase.from("inbound_emails")
            .update({ dossier_id: data.id })
            .eq("id", action.inbound_email_id);
          break;
        }

        case "create_devis": {
          if (!clientId) throw new Error("Aucun client associé à cet email. Créez d'abord le client.");
          const { data, error } = await supabase.from("devis").insert({
            objet: String(payload.objet || "Devis").slice(0, 500),
            notes: payload.notes ? String(payload.notes).slice(0, 2000) : null,
            client_id: clientId,
            company_id: companyId,
            dossier_id: emailDossierId || null,
            created_by: userId,
            status: "brouillon",
            amount: 0,
          }).select("id").single();
          if (error) throw error;
          createdId = data.id;

          await supabase.from("inbound_emails")
            .update({ devis_id: data.id })
            .eq("id", action.inbound_email_id);
          break;
        }

        case "plan_visite": {
          if (!clientId) throw new Error("Aucun client associé à cet email. Créez d'abord le client.");

          let scheduledDate: string | null = payload.scheduled_date || payload.date_souhaitee || null;
          if (scheduledDate && typeof scheduledDate === "string") {
            const dateMatch = scheduledDate.match(/(\d{4}-\d{2}-\d{2})/);
            scheduledDate = dateMatch ? dateMatch[1] : null;
          }

          const { data, error } = await supabase.from("visites").insert({
            title: String(payload.title || "Visite technique").slice(0, 500),
            address: payload.address ? String(payload.address).slice(0, 500) : null,
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
            instructions: payload.instructions ? String(payload.instructions).slice(0, 2000) : null,
            client_id: clientId,
            company_id: companyId,
            dossier_id: emailDossierId || null,
            created_by: userId,
            status: "planifiee",
            scheduled_date: scheduledDate,
          }).select("id").single();
          if (error) throw error;
          createdId = data.id;

          await supabase.from("inbound_emails")
            .update({ visite_id: data.id })
            .eq("id", action.inbound_email_id);
          break;
        }

        case "extract_materiel": {
          let targetVisiteId = email?.visite_id || null;
          
          if (!targetVisiteId) {
            const { data: freshEmail } = await supabase
              .from("inbound_emails")
              .select("visite_id")
              .eq("id", action.inbound_email_id)
              .single();
            targetVisiteId = freshEmail?.visite_id || null;
          }

          if (!targetVisiteId) {
            if (!clientId) throw new Error("Aucun client associé. Créez d'abord le client.");
            const { data: newVisite, error: vErr } = await supabase.from("visites").insert({
              title: String(payload.title || "Visite technique").slice(0, 500),
              address: payload.address ? String(payload.address).slice(0, 500) : null,
              client_id: clientId,
              company_id: companyId,
              dossier_id: email?.dossier_id || null,
              created_by: userId,
              status: "planifiee",
            }).select("id").single();
            if (vErr) throw vErr;
            targetVisiteId = newVisite.id;

            await supabase.from("inbound_emails")
              .update({ visite_id: targetVisiteId })
              .eq("id", action.inbound_email_id);
          }

          const materials = payload.materials || [];
          if (materials.length > 0) {
            const inserts = materials.slice(0, 200).map((m: any, i: number) => ({
              designation: String(m.designation || "Matériel").slice(0, 500),
              quantity: m.quantity || 1,
              weight: m.weight || null,
              dimensions: m.dimensions ? String(m.dimensions).slice(0, 200) : null,
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
          if (payload.dossier_id) {
            await supabase.from("inbound_emails")
              .update({ dossier_id: payload.dossier_id })
              .eq("id", action.inbound_email_id);
          }
          break;
        }

        case "attach_voirie_plan":
        case "attach_pv_roc":
        case "attach_arrete": {
          const visiteId = payload.visite_id;
          if (!visiteId) throw new Error("Aucune visite voirie associée. Associez d'abord une visite avec démarche voirie.");

          // Store attachments in voirie-plans bucket
          const attachmentsList = payload.attachments || [];
          let storagePath: string | null = null;

          for (const att of attachmentsList.slice(0, 3)) {
            const ext = (att.filename || "document.pdf").split(".").pop() || "pdf";
            const fileName = `${visiteId}/${action.action_type}_${Date.now()}.${ext}`;

            let fileData: Uint8Array | null = null;
            if (att.content) {
              // Base64 content
              const binaryStr = atob(att.content);
              fileData = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                fileData[i] = binaryStr.charCodeAt(i);
              }
            } else if (att.url) {
              // Download from URL
              try {
                const resp = await fetch(att.url);
                if (resp.ok) {
                  fileData = new Uint8Array(await resp.arrayBuffer());
                }
              } catch (e) {
                console.error("Failed to fetch attachment URL:", e);
              }
            }

            if (fileData) {
              const { error: uploadErr } = await supabase.storage
                .from("voirie-plans")
                .upload(fileName, fileData, {
                  contentType: att.content_type || "application/pdf",
                  upsert: true,
                });
              if (uploadErr) {
                console.error("Upload error:", uploadErr);
              } else {
                storagePath = fileName;
              }
            } else {
              // No real file data but attachment metadata exists — record the reference
              console.log("Attachment has no downloadable content, recording metadata reference");
              storagePath = storagePath || `${visiteId}/${action.action_type}_ref_${Date.now()}.${ext}`;
            }
          }

          // Update visites table with the document path
          const updateData: Record<string, any> = {};
          if (action.action_type === "attach_voirie_plan") {
            updateData.voirie_plan_storage_path = storagePath;
          } else if (action.action_type === "attach_pv_roc") {
            updateData.voirie_pv_roc_storage_path = storagePath;
          } else if (action.action_type === "attach_arrete") {
            updateData.voirie_arrete_storage_path = storagePath;
            updateData.voirie_status = "obtenue";
            updateData.voirie_obtained_at = new Date().toISOString();
            if (payload.arrete_date) {
              updateData.voirie_arrete_date = payload.arrete_date;
            }
          }

          if (Object.keys(updateData).length > 0) {
            const { error: updateVisiteErr } = await supabase
              .from("visites")
              .update(updateData)
              .eq("id", visiteId);
            if (updateVisiteErr) {
              console.error("Update visite error:", updateVisiteErr);
              throw new Error("Erreur lors de la mise à jour de la visite voirie.");
            }
          }

          // Keep voirie_plans in sync so the plan editor can load the imported document
          if (action.action_type === "attach_voirie_plan" && storagePath) {
            const isPdf = storagePath.toLowerCase().endsWith(".pdf");
            const title = payload.address
              ? `Plan voirie - ${String(payload.address).slice(0, 120)}`
              : "Plan voirie";

            const { data: existingPlan, error: findPlanErr } = await supabase
              .from("voirie_plans")
              .select("id")
              .eq("company_id", companyId)
              .eq("visite_id", visiteId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (findPlanErr) {
              console.error("Find existing plan error:", findPlanErr);
            }

            const planPayload: Record<string, any> = {
              company_id: companyId,
              visite_id: visiteId,
              dossier_id: payload.dossier_id || email?.dossier_id || null,
              title,
              address: payload.address ? String(payload.address).slice(0, 500) : null,
              ...(isPdf ? { plan_pdf_path: storagePath } : { plan_image_url: storagePath }),
            };

            if (existingPlan?.id) {
              const { error: updatePlanErr } = await supabase
                .from("voirie_plans")
                .update(planPayload)
                .eq("id", existingPlan.id);
              if (updatePlanErr) {
                console.error("Update voirie_plans error:", updatePlanErr);
              }
            } else {
              const { error: insertPlanErr } = await supabase
                .from("voirie_plans")
                .insert(planPayload);
              if (insertPlanErr) {
                console.error("Insert voirie_plans error:", insertPlanErr);
              }
            }
          }

          createdId = visiteId;
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
    // Return safe error messages for known business errors
    const msg = e instanceof Error ? e.message : "";
    const safeMessages = [
      "Aucun client associé",
      "Créez d'abord le client",
    ];
    const isSafe = safeMessages.some(s => msg.includes(s));
    return new Response(JSON.stringify({ error: isSafe ? msg : "Erreur lors de l'exécution de l'action." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
