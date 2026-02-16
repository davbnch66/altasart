import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    // Support both Resend webhook format and manual test format
    const fromEmail = body.from_email || body.from?.address || body.from;
    const fromName = body.from_name || body.from?.name || fromEmail;
    const toEmail = body.to_email || (Array.isArray(body.to) ? body.to[0] : body.to);
    const subject = body.subject || "(sans objet)";
    const bodyText = body.body_text || body.text || body.body || "";
    const bodyHtml = body.body_html || body.html || "";
    const attachments = body.attachments || [];
    const companyId = body.company_id;

    if (!companyId) {
      return new Response(JSON.stringify({ error: "company_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Store the inbound email
    const { data: emailRow, error: insertErr } = await supabase
      .from("inbound_emails")
      .insert({
        company_id: companyId,
        from_email: fromEmail,
        from_name: fromName,
        to_email: toEmail,
        subject,
        body_text: bodyText,
        body_html: bodyHtml,
        attachments,
        status: "processing",
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;
    const emailId = emailRow.id;

    // 2. AI Analysis
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const contentForAnalysis = `De: ${fromName} <${fromEmail}>
Objet: ${subject}

${bodyText}`;

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
                  societe: { type: "string", description: "Nom de la société de l'expéditeur" },
                  contact: { type: "string", description: "Nom du contact" },
                  email: { type: "string", description: "Email de contact" },
                  telephone: { type: "string", description: "Numéro de téléphone si mentionné" },
                  adresse_chantier: { type: "string", description: "Adresse du chantier si mentionnée" },
                  type_demande: {
                    type: "array",
                    items: { type: "string", enum: ["devis", "visite", "information", "relance", "confirmation", "autre"] },
                    description: "Types de demandes détectées",
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
                    description: "Liste de matériel détecté",
                  },
                  date_souhaitee: { type: "string", description: "Date souhaitée pour intervention (format ISO si possible)" },
                  urgence: { type: "boolean", description: "L'email exprime-t-il une urgence ?" },
                  resume: { type: "string", description: "Résumé en 1-2 phrases de la demande" },
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
      console.error("AI analysis failed:", aiResponse.status, await aiResponse.text());
    }

    // 3. Try to match existing client by email
    let clientId: string | null = null;
    if (fromEmail) {
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("company_id", companyId)
        .eq("email", fromEmail)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      }
    }

    // 4. Update inbound_email with analysis and client
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

    // If no client found, suggest creating one
    if (!clientId) {
      actions.push({
        inbound_email_id: emailId,
        company_id: companyId,
        action_type: "create_client",
        payload: {
          name: analysis.societe || fromName || fromEmail,
          contact_name: analysis.contact || fromName,
          email: fromEmail,
          phone: analysis.telephone || null,
          address: analysis.adresse_chantier || null,
        },
      });
    }

    // Suggest dossier creation for devis/visite requests
    const types = analysis.type_demande || [];
    if (types.includes("devis") || types.includes("visite")) {
      actions.push({
        inbound_email_id: emailId,
        company_id: companyId,
        action_type: "create_dossier",
        payload: {
          title: subject,
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
          objet: subject,
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
          title: `Visite — ${analysis.societe || fromName || ""}`,
          address: analysis.adresse_chantier || null,
          date_souhaitee: analysis.date_souhaitee || null,
        },
      });
    }

    // If materiel detected
    if (analysis.materiel && analysis.materiel.length > 0) {
      actions.push({
        inbound_email_id: emailId,
        company_id: companyId,
        action_type: "extract_materiel",
        payload: { materials: analysis.materiel },
      });
    }

    // If client exists, suggest linking to existing dossier
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

    // 6. Insert into messages table for history
    await supabase.from("messages").insert({
      company_id: companyId,
      client_id: clientId,
      channel: "email",
      direction: "inbound",
      sender: fromName || fromEmail,
      subject,
      body: bodyText,
      inbound_email_id: emailId,
      is_read: false,
    });

    // 7. Create notifications for company members
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
        title: `Nouvel email: ${subject}`,
        body: analysis.resume || `De ${fromName || fromEmail}`,
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
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
