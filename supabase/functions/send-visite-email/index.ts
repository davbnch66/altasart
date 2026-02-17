import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY non configuré. Veuillez renseigner la clé API Resend dans les secrets." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const to = body.to;
    const subject = body.subject;
    const emailBody = body.body;
    const pdfBase64 = body.pdfBase64;
    const fileName = body.fileName;

    // Input validation
    if (!to || typeof to !== "string" || !to.includes("@") || to.length > 320) {
      return new Response(
        JSON.stringify({ error: "Adresse email destinataire invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!subject || typeof subject !== "string" || subject.length > 500) {
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

    const htmlBody = emailBody
      ? `<div style="font-family:sans-serif;white-space:pre-wrap">${String(emailBody).replace(/\n/g, "<br>")}</div>`
      : "<p></p>";

    // Use test mode via env var, not hardcoded email
    const isTestMode = Deno.env.get("RESEND_TEST_MODE") === "true";
    const testEmail = Deno.env.get("RESEND_TEST_EMAIL");
    const recipientEmail = isTestMode && testEmail ? testEmail : to;
    const emailSubject = isTestMode && testEmail && to !== testEmail ? `[TEST - Pour: ${to}] ${subject}` : subject;

    const emailPayload: Record<string, unknown> = {
      from: "Altas Art <onboarding@resend.dev>",
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
