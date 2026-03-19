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

    // Auth: internal call (inbound_email_id) skips webhook check
    // External webhook requires X-Webhook-Secret
    if (!body.inbound_email_id) {
      const webhookSecret = req.headers.get("X-Webhook-Secret");
      const expectedSecret = Deno.env.get("INBOUND_EMAIL_WEBHOOK_SECRET");
      if (!expectedSecret || webhookSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Mode 1: Called with inbound_email_id (from poll-email-accounts)
    // Mode 2: Called with raw email data (from webhook)
    let emailId: string;
    let companyId: string;
    let safeFromEmail: string | null;
    let safeFromName: string | null;
    let safeToEmail: string | null;
    let safeSubject: string;
    let safeBodyText: string;
    let safeBodyHtml: string;
    let attachments: any[];

    if (body.inbound_email_id) {
      // Mode 1: fetch existing inbound_email
      const { data: existing, error: fetchErr } = await supabase
        .from("inbound_emails")
        .select("*")
        .eq("id", body.inbound_email_id)
        .single();

      if (fetchErr || !existing) {
        return new Response(JSON.stringify({ error: "Inbound email not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Skip if already processed
      if (existing.status === "processed") {
        return new Response(JSON.stringify({ success: true, already_processed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      emailId = existing.id;
      companyId = existing.company_id;
      safeFromEmail = existing.from_email;
      safeFromName = existing.from_name;
      safeToEmail = existing.to_email;
      safeSubject = existing.subject || "(sans objet)";
      safeBodyText = existing.body_text || "";
      safeBodyHtml = existing.body_html || "";
      attachments = Array.isArray(existing.attachments) ? existing.attachments : [];

      // Mark as processing
      await supabase.from("inbound_emails").update({ status: "processing" }).eq("id", emailId);

    } else {
      // Mode 2: raw webhook data
      const fromEmail = body.from_email || body.from?.address || body.from;
      const fromName = body.from_name || body.from?.name || fromEmail;
      const toEmail = body.to_email || (Array.isArray(body.to) ? body.to[0] : body.to);
      const subject = body.subject || "(sans objet)";
      const bodyText = body.body_text || body.text || body.body || "";
      const bodyHtml = body.body_html || body.html || "";
      attachments = body.attachments || [];
      companyId = body.company_id;

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

      safeSubject = String(subject).slice(0, 1000);
      safeBodyText = String(bodyText).slice(0, 100000);
      safeBodyHtml = String(bodyHtml).slice(0, 200000);
      safeFromEmail = fromEmail ? String(fromEmail).slice(0, 320) : null;
      safeFromName = fromName ? String(fromName).slice(0, 200) : null;
      safeToEmail = toEmail ? String(toEmail).slice(0, 320) : null;

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

      // Store the inbound email
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
      emailId = emailRow.id;
    }

    // Build attachment info for AI analysis
    const attachmentNames = (Array.isArray(attachments) ? attachments : [])
      .map((a: any) => a.filename || a.name || "").filter(Boolean).slice(0, 20);

    // 2. AI Analysis (with voirie document detection)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const contentForAnalysis = `De: ${safeFromName} <${safeFromEmail}>
Objet: ${safeSubject}
Pièces jointes: ${attachmentNames.length > 0 ? attachmentNames.join(", ") : "aucune"}

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
            content: `Tu es un assistant d'analyse d'emails commerciaux pour une entreprise spécialisée en MANUTENTION LOURDE, LEVAGE, DÉMÉNAGEMENT INDUSTRIEL et RÉCEPTION DE MATÉRIEL.

Analyse MINUTIEUSEMENT l'email ET ses pièces jointes (noms de fichiers) pour extraire TOUTES les informations pertinentes.

CLASSIFICATION - type_demande :
- "devis" : demande de chiffrage, estimation, tarif
- "visite" : demande de visite technique, reconnaissance terrain
- "information" : demande de renseignements, disponibilité, capacités
- "relance" : suivi d'une demande précédente
- "confirmation" : validation, bon de commande, accord
- "autre" : newsletters, spam, notifications automatiques, emails sans rapport avec la manutention/levage/déménagement

ATTENTION AUX PIÈCES JOINTES - Analyse les noms de fichiers pour détecter :
- Plans (PDF, DWG, images) : plans d'implantation, plans de masse, plans d'accès, plans de levage, plans de rigging
- Documents techniques : fiches techniques machines, spécifications, cahiers des charges
- Documents voirie : plans de voirie, arrêtés, PV de ROC
- Photos de matériel : pour évaluer poids, dimensions, contraintes d'accès
- Bons de commande, bons de livraison

EXTRACTION MATÉRIEL - Sois EXHAUSTIF sur le champ "materiel" :
- Machines industrielles (CNC, presses, tours, fraiseuses, compresseurs, groupes froids, transformateurs, etc.)
- Équipements lourds (cuves, chaudières, pompes, moteurs, coffrets électriques)
- Mobilier industriel (armoires fortes, serveurs, racks)
- Extrais systématiquement : désignation, quantité, dimensions (LxlxH), poids estimé, étage, contraintes d'accès

DOCUMENTS VOIRIE dans les pièces jointes :
- "plan_voirie" : plan de voirie, plan d'emprise, plan de masse, plan de stationnement
- "pv_roc" : procès-verbal de reconnaissance, PV de ROC
- "arrete" : arrêté municipal, arrêté de stationnement, autorisation de voirie

Si un arrêté est détecté, extrais la date d'intervention/d'autorisation (champ arrete_date).`,
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
                  voirie_documents: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["plan_voirie", "pv_roc", "arrete"],
                    },
                    description: "Types de documents voirie détectés dans les pièces jointes ou le contenu",
                  },
                  arrete_date: {
                    type: "string",
                    description: "Date d'intervention/autorisation extraite de l'arrêté (format YYYY-MM-DD si possible)",
                  },
                  materiel: {
                    type: "array",
                    description: "Liste EXHAUSTIVE de tous les équipements, machines, matériels mentionnés dans l'email ou suggérés par les pièces jointes",
                    items: {
                      type: "object",
                      properties: {
                        designation: { type: "string", description: "Nom précis de la machine ou du matériel" },
                        quantity: { type: "number", description: "Nombre d'unités" },
                        dimensions: { type: "string", description: "Dimensions LxlxH en mètres ou cm" },
                        weight: { type: "number", description: "Poids en kg" },
                        etage: { type: "string", description: "Étage de chargement ou livraison" },
                        acces_contraintes: { type: "string", description: "Contraintes d'accès (escalier, passage étroit, hauteur limitée, etc.)" },
                        fragile: { type: "boolean", description: "Matériel fragile nécessitant précautions" },
                      },
                      required: ["designation"],
                      additionalProperties: false,
                    },
                  },
                  pieces_jointes_detectees: {
                    type: "array",
                    description: "Analyse des pièces jointes pertinentes pour le métier",
                    items: {
                      type: "object",
                      properties: {
                        filename: { type: "string" },
                        type_document: { type: "string", enum: ["plan_levage", "plan_acces", "plan_implantation", "fiche_technique", "photo_materiel", "bon_commande", "cahier_charges", "plan_voirie", "arrete", "pv_roc", "autre"] },
                        description: { type: "string", description: "Ce que contient probablement ce document" },
                      },
                      required: ["filename", "type_document"],
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

    // 5b. Voirie document actions
    const voirieDocs = analysis.voirie_documents || [];
    if (voirieDocs.length > 0) {
      // Try to find a visite with voirie needs linked to the client's dossiers
      let targetVisiteId: string | null = null;
      if (clientId) {
        const { data: voirieVisites } = await supabase
          .from("visites")
          .select("id, dossier_id, voirie_address")
          .eq("company_id", companyId)
          .eq("needs_voirie", true)
          .order("created_at", { ascending: false })
          .limit(10);

        if (voirieVisites && voirieVisites.length > 0) {
          // Filter to visites linked to this client's dossiers
          const { data: clientDossiers } = await supabase
            .from("dossiers")
            .select("id")
            .eq("client_id", clientId)
            .eq("company_id", companyId);

          const dossierIds = (clientDossiers || []).map((d: any) => d.id);
          const matchingVisite = voirieVisites.find((v: any) => dossierIds.includes(v.dossier_id));
          targetVisiteId = matchingVisite?.id || voirieVisites[0]?.id || null;
        }
      }

      // Build attachment info to pass along
      const pdfAttachments = (Array.isArray(attachments) ? attachments : [])
        .filter((a: any) => {
          const name = (a.filename || a.name || "").toLowerCase();
          return name.endsWith(".pdf") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg");
        })
        .slice(0, 5);

      for (const docType of voirieDocs) {
        const actionType = docType === "plan_voirie" ? "attach_voirie_plan"
          : docType === "pv_roc" ? "attach_pv_roc"
          : docType === "arrete" ? "attach_arrete"
          : null;

        if (actionType) {
          actions.push({
            inbound_email_id: emailId,
            company_id: companyId,
            action_type: actionType,
            payload: {
              visite_id: targetVisiteId,
              attachments: pdfAttachments.map((a: any) => ({
                filename: a.filename || a.name,
                content_type: a.content_type || a.type || "application/pdf",
                url: a.url || null,
                content: a.content ? String(a.content).slice(0, 500000) : null,
              })),
              arrete_date: docType === "arrete" ? (analysis.arrete_date || null) : undefined,
              address: analysis.adresse_chantier || null,
            },
          });
        }
      }
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
      const notifType = voirieDocs.length > 0
        ? "new_lead" // voirie docs are important
        : types.includes("visite")
          ? "visite_requested"
          : analysis.materiel?.length > 0
            ? "materiel_detected"
            : "new_lead";

      const notifTitle = voirieDocs.length > 0
        ? `📋 Document voirie reçu: ${safeSubject.slice(0, 80)}`
        : `Nouvel email: ${safeSubject.slice(0, 100)}`;

      const notifications = members.map((m: any) => ({
        company_id: companyId,
        user_id: m.profile_id,
        type: notifType,
        title: notifTitle,
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
      voirie_docs: voirieDocs,
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
