import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (str, [key, val]) => str.replaceAll(`{{${key}}}`, val ?? ""),
    template
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { devisId, recipientEmail, recipientName, signatureUrl, devisCode, devisObjet, devisAmount, companyName, companyId, senderName } = await req.json();

    if (!devisId || !recipientEmail || !signatureUrl) {
      return new Response(JSON.stringify({ error: "Paramètres manquants" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formatAmount = (amount: number) =>
      new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);

    const vars: Record<string, string> = {
      client_name: recipientName || "",
      contact_name: recipientName || "",
      devis_code: devisCode || "",
      devis_objet: devisObjet || "",
      devis_amount: devisAmount ? formatAmount(devisAmount) : "",
      company_name: companyName || "Votre prestataire",
      signature_url: signatureUrl,
      sender_name: senderName || companyName || "",
    };

    // Try to load custom template
    let emailSubject = `Devis ${devisCode || ""} à accepter — ${companyName}`;
    let emailBodyText = "";
    let useCustomTemplate = false;

    if (companyId) {
      const { data: tpl } = await supabase
        .from("email_templates")
        .select("subject, body")
        .eq("company_id", companyId)
        .eq("type", "devis_envoi")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (tpl) {
        emailSubject = applyTemplate(tpl.subject, vars);
        emailBodyText = applyTemplate(tpl.body, vars);
        useCustomTemplate = true;
      }
    }

    const emailHtml = useCustomTemplate
      ? `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#1a1a2e;padding:32px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;">${companyName || "Votre prestataire"}</h1>
    </div>
    <div style="padding:32px;">
      <div style="white-space:pre-wrap;color:#333;font-size:15px;line-height:1.7;">${emailBodyText.replace(/\n/g, "<br>")}</div>
    </div>
    <div style="background:#f5f5f5;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#aaa;font-size:12px;margin:0;">${companyName} — altasart.fr</p>
    </div>
  </div>
</body></html>`
      : `<!DOCTYPE html><html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#1a1a2e;padding:32px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;">${companyName || "Votre prestataire"}</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#333;font-size:16px;margin-top:0;">Bonjour ${recipientName || ""},</p>
      <p style="color:#555;font-size:15px;line-height:1.6;">
        Vous avez reçu un devis de la part de <strong>${companyName}</strong>${senderName ? ` (${senderName})` : ""} en attente de votre acceptation.
      </p>
      <div style="background:#f8f8f8;border-radius:8px;padding:20px;margin:24px 0;border-left:4px solid #6366f1;">
        <p style="margin:0 0 8px;color:#888;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Détails du devis</p>
        ${devisCode ? `<p style="margin:4px 0;color:#333;font-size:14px;"><strong>N° :</strong> ${devisCode}</p>` : ""}
        ${devisObjet ? `<p style="margin:4px 0;color:#333;font-size:14px;"><strong>Objet :</strong> ${devisObjet}</p>` : ""}
        ${devisAmount ? `<p style="margin:4px 0;color:#333;font-size:16px;font-weight:700;"><strong>Montant :</strong> ${formatAmount(devisAmount)}</p>` : ""}
      </div>
      <div style="text-align:center;margin:32px 0;">
        <a href="${signatureUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:700;">
          ✓ Voir et accepter le devis
        </a>
      </div>
      <p style="color:#888;font-size:13px;text-align:center;">Ce lien est valable 30 jours.</p>
    </div>
    <div style="background:#f5f5f5;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#aaa;font-size:12px;margin:0;">${companyName} — altasart.fr</p>
    </div>
  </div>
</body></html>`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: `${companyName || "Altasart"} <noreply@altasart.fr>`,
        to: recipientEmail,
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      throw new Error(`Resend error: ${errText}`);
    }

    // Mark devis as sent
    await supabase.from("devis").update({ status: "envoye", sent_at: new Date().toISOString() }).eq("id", devisId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-signature-email error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
