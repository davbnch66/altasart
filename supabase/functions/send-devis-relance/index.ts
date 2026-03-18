import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_URL = "https://api.resend.com/emails";

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

    // Service role client for data access
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await serviceSupabase.auth.getUser(token);
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
    const companyName = company?.name || company?.short_name || "Altasart";

    // Fetch sender name from logged-in user's profile
    const { data: senderProfile } = await serviceSupabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    const senderName = senderProfile?.full_name || companyName;

    // Fetch default contact for the client
    let contactName = recipientName || (devis.clients as any)?.name || "";
    if (devis.client_id) {
      const { data: defaultContact } = await serviceSupabase
        .from("client_contacts")
        .select("first_name, last_name")
        .eq("client_id", devis.client_id)
        .eq("is_default", true)
        .single();
      if (defaultContact) {
        const fullContactName = [defaultContact.first_name, defaultContact.last_name].filter(Boolean).join(" ");
        if (fullContactName) contactName = fullContactName;
      }
    }

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
    const formatDate = (d: string | null | undefined) =>
      d ? new Intl.DateTimeFormat("fr-FR").format(new Date(d)) : "";

    // Fetch dossier if linked
    let dossierCode = "";
    let dossierTitle = "";
    let dossierEndDate = "";
    if (devis.dossier_id) {
      const { data: dossier } = await serviceSupabase
        .from("dossiers")
        .select("code, title, end_date")
        .eq("id", devis.dossier_id)
        .maybeSingle();
      dossierCode = dossier?.code || "";
      dossierTitle = dossier?.title || "";
      dossierEndDate = formatDate(dossier?.end_date);
    }

    const templateVars: Record<string, string> = {
      client_name: (devis.clients as any)?.name || "",
      contact_name: contactName,
      devis_code: devis.code || "",
      devis_objet: devis.objet || "",
      devis_amount: formatAmount(devis.amount || 0),
      devis_valid_until: formatDate(devis.valid_until),
      devis_sent_at: formatDate(devis.sent_at),
      dossier_code: dossierCode,
      dossier_title: dossierTitle,
      dossier_end_date: dossierEndDate,
      visite_title: "",
      visite_date: "",
      visite_address: "",
      company_name: companyName,
      signature_url: signatureUrl || "",
      sender_name: senderName,
    };

    const templateType = `devis_relance_${relanceNum}`;
    let customBodyHtml: string | null = null;
    let finalSubject: string | null = null;

    const { data: tpl } = await serviceSupabase
      .from("email_templates")
      .select("subject, body")
      .eq("company_id", devis.company_id)
      .eq("type", templateType)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (tpl) {
      finalSubject = applyTemplate(tpl.subject, templateVars);
      const resolvedBody = applyTemplate(tpl.body, templateVars);
      customBodyHtml = `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;color:#333;font-size:15px;line-height:1.7;">${resolvedBody.replace(/\n/g, "<br>")}</div>`;
    }

    const relanceLabel = relanceNum === 1 ? "première" : relanceNum === 2 ? "deuxième" : "troisième";
    if (!finalSubject) {
      finalSubject = `Relance devis ${devis.code || ""} — ${companyName}`;
    }

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
      <div style="background: #1a1a2e; padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">${companyName}</h1>
        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 14px;">Relance devis</p>
      </div>
      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Bonjour ${escapeHtml(contactName)},
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Nous revenons vers vous concernant notre ${relanceLabel} relance pour le devis suivant :
        </p>
        ${customMessage ? `
        <div style="background: #f3f4f6; border-left: 4px solid #6366f1; border-radius: 4px; padding: 16px; margin: 0 0 24px;">
          <p style="color: #374151; margin: 0; font-size: 14px; line-height: 1.6;">${escapeHtml(customMessage || "")}</p>
        </div>
        ` : ""}
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
        <p style="color: #374151; font-size: 15px; margin: 0;">
          Cordialement,<br/>
          <strong>${senderName}</strong>${senderName !== companyName ? `<br/>${companyName}` : ""}
        </p>
        ${company?.phone ? `<p style="color: #6b7280; font-size: 13px; margin: 8px 0 0;">${company.phone}</p>` : ""}
      </div>
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

    const emailResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${companyName} <noreply@altasart.fr>`,
        to: [recipientEmail],
        subject: finalSubject,
        html: customBodyHtml
          ? `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#1a1a2e;padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">${companyName}</h1>
    </div>
    <div style="padding:32px;">${customBodyHtml}</div>
    <div style="background:#f5f5f5;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#aaa;font-size:12px;margin:0;">${companyName}</p>
    </div>
  </div>
</body></html>`
          : htmlBody,
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
      recipient_name: contactName || null,
      relance_num: relanceNum || 1,
      subject: finalSubject,
      status: "sent",
    });

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
