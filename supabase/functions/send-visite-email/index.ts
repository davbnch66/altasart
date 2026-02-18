import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (str, [key, val]) => str.replaceAll(`{{${key}}}`, val ?? ""),
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
    const pdfBase64 = body.pdfBase64;
    const fileName = body.fileName;

    // Context for variable substitution
    const visiteId: string | undefined = body.visiteId;
    const companyId: string | undefined = body.companyId;
    // Fallback values sent from client
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

    // Fetch sender name from profile (logged-in user)
    const { data: senderProfile } = await serviceSupabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    const senderName = senderProfile?.full_name || fallbackCompanyName;

    // Resolve contact name from client_contacts if visiteId provided
    let contactName = fallbackContactName || fallbackClientName;
    let clientName = fallbackClientName;
    let companyName = fallbackCompanyName;

    if (visiteId) {
      const { data: visite } = await serviceSupabase
        .from("visites")
        .select("client_id, company_id, title, clients(name), companies(name, short_name)")
        .eq("id", visiteId)
        .single();

      if (visite) {
        clientName = (visite.clients as any)?.name || fallbackClientName;
        companyName = (visite.companies as any)?.name || (visite.companies as any)?.short_name || fallbackCompanyName;

        if (visite.client_id) {
          const { data: defaultContact } = await serviceSupabase
            .from("client_contacts")
            .select("first_name, last_name")
            .eq("client_id", visite.client_id)
            .eq("is_default", true)
            .single();
          if (defaultContact) {
            const fullContactName = [defaultContact.first_name, defaultContact.last_name].filter(Boolean).join(" ");
            if (fullContactName) contactName = fullContactName;
          } else {
            contactName = clientName;
          }
        }
      }
    }

    const templateVars: Record<string, string> = {
      client_name: clientName,
      contact_name: contactName,
      devis_code: "",
      devis_objet: "",
      devis_amount: "",
      company_name: companyName,
      signature_url: "",
      sender_name: senderName,
    };

    let finalSubject = fallbackSubject;
    let finalBody = fallbackBody;

    // Try to load rapport_visite template
    const targetCompanyId = companyId || (visiteId ? undefined : undefined);
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

    if (pdfBase64 && typeof pdfBase64 === "string" && pdfBase64.length > 7_000_000) {
      return new Response(
        JSON.stringify({ error: "Pièce jointe trop volumineuse (max ~5MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const htmlBody = finalBody
      ? `<div style="font-family:sans-serif;white-space:pre-wrap;color:#333;font-size:15px;line-height:1.7;">${String(finalBody).replace(/\n/g, "<br>")}</div>`
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
