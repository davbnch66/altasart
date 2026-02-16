import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY non configuré. Veuillez renseigner la clé API Resend dans les secrets." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, subject, body, pdfBase64, fileName } = await req.json();

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: "Destinataire et sujet requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const htmlBody = body
      ? `<div style="font-family:sans-serif;white-space:pre-wrap">${body.replace(/\n/g, "<br>")}</div>`
      : "<p></p>";

    // En mode test Resend (sans domaine vérifié), on ne peut envoyer qu'à son propre email
    const testEmail = "david.soler.verlaine@gmail.com";
    const recipientEmail = to === testEmail ? to : testEmail;

    const emailPayload: Record<string, unknown> = {
      from: "Altas Art <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: to !== testEmail ? `[Pour: ${to}] ${subject}` : subject,
      html: htmlBody,
    };

    if (pdfBase64) {
      emailPayload.attachments = [
        {
          filename: fileName || "rapport.pdf",
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
      throw new Error(resendData.message || `Resend error: ${resendResponse.status}`);
    }

    return new Response(
      JSON.stringify({ success: true, id: resendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Email send error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur lors de l'envoi" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
