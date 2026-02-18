import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_URL = "https://api.resend.com/emails";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { devisId, recipientEmail, recipientName, relanceNum, customMessage } = await req.json();

    if (!devisId || !recipientEmail) {
      return new Response(JSON.stringify({ error: "devisId et recipientEmail sont requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for full data access
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch devis with relations
    const { data: devis, error: devisError } = await serviceSupabase
      .from("devis")
      .select("*, clients(name, email), companies(name, short_name, email, phone, address)")
      .eq("id", devisId)
      .single();

    if (devisError || !devis) {
      return new Response(JSON.stringify({ error: "Devis introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const company = devis.companies as any;
    const companyName = company?.name || company?.short_name || "Votre prestataire";

    // Check/create signature token
    let signatureToken: string | null = null;
    const { data: existingSig } = await serviceSupabase
      .from("devis_signatures")
      .select("token")
      .eq("devis_id", devisId)
      .eq("status", "pending")
      .gte("expires_at", new Date().toISOString())
      .single();

    if (existingSig) {
      signatureToken = existingSig.token;
    } else {
      const { data: newSig } = await serviceSupabase
        .from("devis_signatures")
        .insert({ devis_id: devisId, company_id: devis.company_id })
        .select("token")
        .single();
      signatureToken = newSig?.token || null;
    }

    const baseUrl = "https://altasart.lovable.app";
    const signatureUrl = signatureToken ? `${baseUrl}/sign/${signatureToken}` : null;

    const formatAmount = (amount: number) =>
      new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);

    const relanceLabel = relanceNum === 1 ? "première" : relanceNum === 2 ? "deuxième" : "troisième";
    const subject = `Relance devis ${devis.code || ""} — ${companyName}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fa; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="background: #1a1a2e; padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">${companyName}</h1>
        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 14px;">Relance devis</p>
      </div>

      <!-- Content -->
      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Bonjour${recipientName ? ` ${recipientName}` : ""},
        </p>
        
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Nous revenons vers vous concernant notre ${relanceLabel} relance pour le devis suivant :
        </p>

        ${customMessage ? `
        <div style="background: #f3f4f6; border-left: 4px solid #6366f1; border-radius: 4px; padding: 16px; margin: 0 0 24px;">
          <p style="color: #374151; margin: 0; font-size: 14px; line-height: 1.6;">${customMessage}</p>
        </div>
        ` : ""}

        <!-- Devis card -->
        <div style="border: 1px solid #e5e7eb; border-radius: 10px; padding: 24px; margin: 0 0 24px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div>
              <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.05em;">Référence</p>
              <p style="font-size: 18px; font-weight: 700; color: #111827; margin: 0;">${devis.code || "—"}</p>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px;">Montant total</p>
              <p style="font-size: 22px; font-weight: 700; color: #6366f1; margin: 0;">${formatAmount(devis.amount || 0)}</p>
            </div>
          </div>
          ${devis.objet ? `
          <div style="border-top: 1px solid #f3f4f6; padding-top: 16px;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px;">Objet</p>
            <p style="font-size: 14px; color: #374151; margin: 0;">${devis.objet}</p>
          </div>
          ` : ""}
        </div>

        ${signatureUrl ? `
        <!-- CTA Signature -->
        <div style="text-align: center; margin: 0 0 32px;">
          <a href="${signatureUrl}" 
             style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.01em;">
            ✓ Accepter ce devis en ligne
          </a>
          <p style="color: #9ca3af; font-size: 12px; margin: 12px 0 0;">
            Lien sécurisé — valide 30 jours
          </p>
        </div>
        ` : ""}

        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          N'hésitez pas à nous contacter si vous avez des questions ou souhaitez apporter des modifications.
        </p>

        <p style="color: #374151; font-size: 15px; margin: 0;">
          Cordialement,<br/>
          <strong>${companyName}</strong>
        </p>

        ${company?.phone ? `<p style="color: #6b7280; font-size: 13px; margin: 8px 0 0;">${company.phone}</p>` : ""}
      </div>

      <!-- Footer -->
      <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px 32px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          Cet email vous est envoyé par ${companyName}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY non configuré");
    }

    const fromEmail = "noreply@altasart.fr";
    const emailResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${companyName} <${fromEmail}>`,
        to: [recipientEmail],
        subject,
        html: htmlBody,
      }),
    });

    if (!emailResponse.ok) {
      const errBody = await emailResponse.text();
      throw new Error(`Resend error: ${errBody}`);
    }

    // Log the relance in DB
    await serviceSupabase.from("devis_relances").insert({
      devis_id: devisId,
      company_id: devis.company_id,
      recipient_email: recipientEmail,
      recipient_name: recipientName || null,
      relance_num: relanceNum || 1,
      subject,
      status: "sent",
    });

    // Update devis sent_at if first send
    if (!devis.sent_at) {
      await serviceSupabase.from("devis").update({ sent_at: new Date().toISOString() }).eq("id", devisId);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-devis-relance error:", err);
    return new Response(JSON.stringify({ error: err.message || "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
