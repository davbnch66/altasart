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
    const { to, storagePath, fileName, subject, companyName, operationId } = body;

    if (!to || typeof to !== "string" || !to.includes("@") || to.length > 320) {
      return new Response(
        JSON.stringify({ error: "Adresse email destinataire invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!storagePath) {
      return new Response(
        JSON.stringify({ error: "Chemin du fichier manquant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await serviceSupabase.storage
      .from("bt-reports")
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error("Storage download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Impossible de récupérer le rapport depuis le stockage" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to base64 for Resend attachment
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const pdfBase64 = btoa(binary);

    // Fetch operation details for email body
    const { data: op } = await serviceSupabase
      .from("operations")
      .select("type, operation_number, loading_date, dossiers(title, code, clients(name, contact_name))")
      .eq("id", operationId)
      .maybeSingle();

    const dossier = (op as any)?.dossiers;
    const client = dossier?.clients;
    const clientName = client?.contact_name || client?.name || "Client";
    const senderCompany = companyName || "Votre prestataire";

    const finalSubject = subject || `Rapport de fin de chantier — ${(op as any)?.type || "BT"} #${(op as any)?.operation_number || ""}`;

    const htmlBody = `
<div style="font-family:sans-serif;color:#333;font-size:15px;line-height:1.7;">
  <p>Bonjour ${clientName},</p>
  <p>Veuillez trouver ci-joint le rapport de fin de chantier pour l'opération <strong>${(op as any)?.type || ""} #${(op as any)?.operation_number || ""}</strong>${dossier?.code ? ` (Dossier ${dossier.code})` : ""}.</p>
  <p>Ce rapport inclut les détails de l'intervention, les signatures de début et fin de chantier ainsi que les photos réalisées sur site.</p>
  <p>Cordialement,<br><strong>${senderCompany}</strong></p>
</div>`;

    const emailPayload: Record<string, unknown> = {
      from: `${senderCompany} <noreply@altasart.fr>`,
      to: [to],
      subject: finalSubject,
      html: htmlBody,
      attachments: [{
        filename: String(fileName || "rapport-bt.pdf").slice(0, 100),
        content: pdfBase64,
      }],
    };

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

    // Clean up storage file after successful send
    await serviceSupabase.storage.from("bt-reports").remove([storagePath]);

    return new Response(
      JSON.stringify({ success: true, id: resendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("BT report email error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur lors de l'envoi du rapport. Veuillez réessayer." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
