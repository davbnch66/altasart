import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(unsafe: string): string {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (str, [key, val]) => str.replaceAll(`{{${key}}}`, escapeHtml(val ?? "")),
    template
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authErr } = await serviceSupabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY non configuré." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const to = body.to;
    const fileName = body.fileName;

    // Support both legacy pdfBase64 and new storagePath approach
    let pdfBase64: string | undefined = body.pdfBase64;
    const storagePath: string | undefined = body.storagePath;

    // Context for variable substitution
    const visiteId: string | undefined = body.visiteId;
    const companyId: string | undefined = body.companyId;
    const fallbackSubject: string = body.subject || "Rapport de visite";
    const fallbackBody: string = body.body || "";
    const fallbackClientName: string = body.clientName || "";
    const fallbackContactName: string = body.contactName || "";
    const fallbackCompanyName: string = body.companyName || "Votre prestataire";

    if (!to || typeof to !== "string" || !to.includes("@") || to.length > 320) {
      return new Response(
        JSON.stringify({ error: "Adresse email destinataire invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If storagePath provided, download from storage and convert to base64
    if (storagePath && !pdfBase64) {
      const { data: fileData, error: dlErr } = await serviceSupabase.storage
        .from("bt-reports")
        .download(storagePath);

      if (dlErr || !fileData) {
        console.error("Storage download error:", dlErr);
        return new Response(
          JSON.stringify({ error: "Impossible de récupérer la pièce jointe depuis le stockage." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check size (max 25MB from storage — Resend supports up to 40MB)
      if (fileData.size > 25_000_000) {
        return new Response(
          JSON.stringify({ error: "Pièce jointe trop volumineuse (max 25MB)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      pdfBase64 = btoa(binary);
    }

    // Legacy base64 size check — only applies to direct pdfBase64 from client (not storage-fetched)
    if (!storagePath && pdfBase64 && typeof pdfBase64 === "string" && pdfBase64.length > 14_000_000) {
      return new Response(
        JSON.stringify({ error: "Pièce jointe trop volumineuse (max ~10MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch sender name from profile
    const { data: senderProfile } = await serviceSupabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    const senderName = senderProfile?.full_name || fallbackCompanyName;

    const formatDate = (d: string | null | undefined) =>
      d ? new Intl.DateTimeFormat("fr-FR").format(new Date(d)) : "";

    let contactName = fallbackContactName || fallbackClientName;
    let clientName = fallbackClientName;
    let companyName = fallbackCompanyName;
    let visiteTitle = "";
    let visiteDate = "";
    let visiteAddress = "";
    let dossierCode = "";
    let dossierTitle = "";
    let dossierEndDate = "";

    if (visiteId) {
      const { data: visite } = await serviceSupabase
        .from("visites")
        .select("client_id, company_id, title, date, address, dossier_id, clients(name), companies(name, short_name)")
        .eq("id", visiteId)
        .maybeSingle();

      if (visite) {
        clientName = (visite.clients as any)?.name || fallbackClientName;
        companyName = (visite.companies as any)?.name || (visite.companies as any)?.short_name || fallbackCompanyName;
        visiteTitle = (visite as any).title || "";
        visiteDate = formatDate((visite as any).date);
        visiteAddress = (visite as any).address || "";

        if (visite.client_id) {
          const { data: defaultContact } = await serviceSupabase
            .from("client_contacts")
            .select("first_name, last_name")
            .eq("client_id", visite.client_id)
            .eq("is_default", true)
            .maybeSingle();
          if (defaultContact) {
            const fullContactName = [defaultContact.first_name, defaultContact.last_name].filter(Boolean).join(" ");
            if (fullContactName) contactName = fullContactName;
          } else {
            contactName = clientName;
          }
        }

        if ((visite as any).dossier_id) {
          const { data: dossier } = await serviceSupabase
            .from("dossiers")
            .select("code, title, end_date")
            .eq("id", (visite as any).dossier_id)
            .maybeSingle();
          dossierCode = dossier?.code || "";
          dossierTitle = dossier?.title || "";
          dossierEndDate = formatDate(dossier?.end_date);
        }
      }
    }

    const templateVars: Record<string, string> = {
      client_name: clientName,
      contact_name: contactName,
      devis_code: "",
      devis_objet: "",
      devis_amount: "",
      devis_valid_until: "",
      devis_sent_at: "",
      dossier_code: dossierCode,
      dossier_title: dossierTitle,
      dossier_end_date: dossierEndDate,
      visite_title: visiteTitle,
      visite_date: visiteDate,
      visite_address: visiteAddress,
      company_name: companyName,
      signature_url: "",
      sender_name: senderName,
    };

    let finalSubject = fallbackSubject;
    let finalBody = fallbackBody;

    const targetCompanyId = companyId || undefined;
    if (targetCompanyId) {
      const { data: tpl } = await serviceSupabase
        .from("email_templates")
        .select("subject, body")
        .eq("company_id", targetCompanyId)
        .eq("type", "rapport_visite")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (tpl) {
        finalSubject = applyTemplate(tpl.subject, templateVars);
        finalBody = applyTemplate(tpl.body, templateVars);
      }
    }

    if (!finalSubject || finalSubject.length > 500) {
      return new Response(
        JSON.stringify({ error: "Sujet requis (max 500 caractères)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const htmlBody = finalBody
      ? `<div style="font-family:sans-serif;white-space:pre-wrap;color:#333;font-size:15px;line-height:1.7;">${escapeHtml(String(finalBody)).replace(/\n/g, "<br>")}</div>`
      : "<p></p>";

    const isTestMode = Deno.env.get("RESEND_TEST_MODE") === "true";
    const testEmail = Deno.env.get("RESEND_TEST_EMAIL");
    const recipientEmail = isTestMode && testEmail ? testEmail : to;
    const emailSubject = isTestMode && testEmail && to !== testEmail ? `[TEST - Pour: ${to}] ${finalSubject}` : finalSubject;

    const emailPayload: Record<string, unknown> = {
      from: `${companyName} <noreply@altasart.fr>`,
      to: [recipientEmail],
      subject: emailSubject,
      html: htmlBody,
    };

    if (pdfBase64) {
      emailPayload.attachments = [
        {
          filename: String(fileName || "rapport.pdf").slice(0, 100),
          content: pdfBase64,
        },
      ];
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendData);
      throw new Error("Erreur lors de l'envoi de l'email");
    }

    // Cleanup storage file after successful send
    if (storagePath) {
      await serviceSupabase.storage.from("bt-reports").remove([storagePath]);
    }

    return new Response(
      JSON.stringify({ success: true, id: resendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Email send error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur lors de l'envoi de l'email. Veuillez réessayer." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
