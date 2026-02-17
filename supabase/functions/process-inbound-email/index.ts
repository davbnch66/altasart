import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // This is a webhook endpoint - authenticate via shared secret or accept from known sources
    // For now, validate inputs strictly since this is a webhook
    const body = await req.json();

    const fromEmail = body.from_email || body.from?.address || body.from;
    const fromName = body.from_name || body.from?.name || fromEmail;
    const toEmail = body.to_email || (Array.isArray(body.to) ? body.to[0] : body.to);
    const subject = body.subject || "(sans objet)";
    const bodyText = body.body_text || body.text || body.body || "";
    const bodyHtml = body.body_html || body.html || "";
    const attachments = body.attachments || [];
    const companyId = body.company_id;

    // Input validation
    if (!companyId || typeof companyId !== "string") {
      return new Response(JSON.stringify({ error: "company_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyId)) {
      return new Response(JSON.stringify({ error: "company_id invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Limit text sizes
    const safeSubject = String(subject).slice(0, 1000);
    const safeBodyText = String(bodyText).slice(0, 100000);
    const safeBodyHtml = String(bodyHtml).slice(0, 200000);
    const safeFromEmail = fromEmail ? String(fromEmail).slice(0, 320) : null;
    const safeFromName = fromName ? String(fromName).slice(0, 200) : null;
    const safeToEmail = toEmail ? String(toEmail).slice(0, 320) : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify company exists
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle();
    if (companyErr || !company) {
      return new Response(JSON.stringify({ error: "Société introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Store the inbound email
    const { data: emailRow, error: insertErr } = await supabase
      .from("inbound_emails")
      .insert({
        company_id: companyId,
        from_email: safeFromEmail,
        from_name: safeFromName,
        to_email: safeToEmail,
        subject: safeSubject,
        body_text: safeBodyText,
        body_html: safeBodyHtml,
        attachments: Array.isArray(attachments) ? attachments.slice(0, 20) : [],
        status: "processing",
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;
    const emailId = emailRow.id;

    // 2. AI Analysis
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const contentForAnalysis = `De: ${safeFromName} <${safeFromEmail}>
Objet: ${safeSubject}

${safeBodyText.slice(0, 10000)}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Tu es un assistant d'analyse d'emails commerciaux pour une entreprise de levage/déménagement.
Analyse l'email et extrais les informations structurées. Sois précis et ne devine pas ce qui n'est pas dans l'email.`,
          },
          {
            role: "user",
            content: `Analyse cet email entrant :\n\n${contentForAnalysis}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_email",
              description: "Analyse structurée d'un email commercial entrant",
              parameters: {
                type: "object",
                properties: {
                  societe: { type: "string" },
                  contact: { type: "string" },
                  email: { type: "string" },
                  telephone: { type: "string" },
                  mobile: { type: "string" },
                  adresse_chantier: { type: "string" },
                  code_postal: { type: "string" },
                  ville: { type: "string" },
                  adresse_origine: { type: "string" },
                  ville_origine: { type: "string" },
                  cp_origine: { type: "string" },
                  adresse_destination: { type: "string" },
                  ville_destination: { type: "string" },
                  cp_destination: { type: "string" },
                  nature: { type: "string" },
                  volume: { type: "number" },
                  etage: { type: "string" },
                  ascenseur: { type: "boolean" },
                  instructions: { type: "string" },
                  type_demande: {
                    type: "array",
                    items: { type: "string", enum: ["devis", "visite", "information", "relance", "confirmation", "autre"] },
                  },
                  materiel: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        designation: { type: "string" },
                        quantity: { type: "number" },
                        dimensions: { type: "string" },
                        weight: { type: "number" },
                      },
                      required: ["designation"],
                      additionalProperties: false,
                    },
                  },
                  date_souhaitee: { type: "string" },
                  periode: { type: "string" },
                  urgence: { type: "boolean" },
                  resume: { type: "string" },
                },
                required: ["type_demande", "resume"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_email" } },
      }),
    });

    let analysis: any = {};
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        analysis = JSON.parse(toolCall.function.arguments);
      }
    } else {
      console.error("AI analysis failed:", aiResponse.status);
    }

    // 3. Try to match existing client
    let clientId: string | null = null;
    if (safeFromEmail) {
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("company_id", companyId)
        .eq("email", safeFromEmail)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: existingContact } = await supabase
          .from("client_contacts")
          .select("client_id")
          .eq("company_id", companyId)
          .eq("email", safeFromEmail)
          .limit(1)
          .maybeSingle();

        if (existingContact) {
          clientId = existingContact.client_id;
        }
      }
    }

    // 4. Update inbound_email
    await supabase
      .from("inbound_emails")
      .update({
        ai_analysis: analysis,
        client_id: clientId,
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", emailId);

    // 5. Generate suggested actions
    const actions: any[] = [];

    if (!clientId) {
      actions.push({
        inbound_email_id: emailId,
        company_id: companyId,
        action_type: "create_client",
        payload: {
          name: analysis.societe || safeFromName || safeFromEmail,
          contact_name: analysis.contact || safeFromName,
          email: safeFromEmail,
          phone: analysis.telephone || null,
          mobile: analysis.mobile || null,
          address: analysis.adresse_chantier || null,
          postal_code: analysis.code_postal || null,
          city: analysis.ville || null,
        },
      });
    }

    const types = analysis.type_demande || [];
    if (types.includes("devis") || types.includes("visite")) {
      actions.push({
        inbound_email_id: emailId,
        company_id: companyId,
        action_type: "create_dossier",
        payload: {
          title: safeSubject,
          description: analysis.resume || "",
          address: analysis.adresse_chantier || null,
        },
      });
    }

    if (types.includes("devis")) {
      actions.push({
        inbound_email_id: emailId,
        company_id: companyId,
        action_type: "create_devis",
        payload: {
          objet: safeSubject,
          notes: analysis.resume || "",
        },
      });
    }

    if (types.includes("visite")) {
      actions.push({
        inbound_email_id: emailId,
        company_id: companyId,
        action_type: "plan_visite",
        payload: {
          title: `Visite — ${analysis.societe || safeFromName || ""}`,
          address: analysis.adresse_chantier || null,
          code_postal: analysis.code_postal || null,
          ville: analysis.ville || null,
          origin_address: analysis.adresse_origine || null,
          origin_city: analysis.ville_origine || null,
          origin_postal_code: analysis.cp_origine || null,
          dest_address: analysis.adresse_destination || null,
          dest_city: analysis.ville_destination || null,
          dest_postal_code: analysis.cp_destination || null,
          date_souhaitee: analysis.date_souhaitee || null,
          periode: analysis.periode || null,
          nature: analysis.nature || null,
          volume: analysis.volume || null,
          etage: analysis.etage || null,
          ascenseur: analysis.ascenseur || null,
          instructions: analysis.instructions || null,
          contact_name: analysis.contact || null,
          zone: analysis.ville || null,
        },
      });
    }

    if (analysis.materiel && analysis.materiel.length > 0) {
      actions.push({
        inbound_email_id: emailId,
        company_id: companyId,
        action_type: "extract_materiel",
        payload: { materials: analysis.materiel.slice(0, 200) },
      });
    }

    if (clientId) {
      actions.push({
        inbound_email_id: emailId,
        company_id: companyId,
        action_type: "link_dossier",
        payload: { client_id: clientId },
      });
    }

    if (actions.length > 0) {
      await supabase.from("email_actions").insert(actions);
    }

    // 6. Insert into messages table
    await supabase.from("messages").insert({
      company_id: companyId,
      client_id: clientId,
      channel: "email",
      direction: "inbound",
      sender: safeFromName || safeFromEmail,
      subject: safeSubject,
      body: safeBodyText.slice(0, 10000),
      inbound_email_id: emailId,
      is_read: false,
    });

    // 7. Create notifications
    const { data: members } = await supabase
      .from("company_memberships")
      .select("profile_id")
      .eq("company_id", companyId);

    if (members && members.length > 0) {
      const notifType = types.includes("visite")
        ? "visite_requested"
        : analysis.materiel?.length > 0
          ? "materiel_detected"
          : "new_lead";

      const notifications = members.map((m: any) => ({
        company_id: companyId,
        user_id: m.profile_id,
        type: notifType,
        title: `Nouvel email: ${safeSubject.slice(0, 100)}`,
        body: String(analysis.resume || `De ${safeFromName || safeFromEmail}`).slice(0, 500),
        link: `/inbox?email=${emailId}`,
      }));

      await supabase.from("notifications").insert(notifications);
    }

    return new Response(JSON.stringify({
      success: true,
      email_id: emailId,
      client_id: clientId,
      actions_count: actions.length,
      analysis,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-inbound-email error:", e);
    return new Response(JSON.stringify({ error: "Erreur lors du traitement de l'email." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
