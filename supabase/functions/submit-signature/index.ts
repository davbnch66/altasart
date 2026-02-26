import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, signerName, signerEmail, signatureDataUrl } = await req.json();

    if (!token || !signerName?.trim()) {
      return new Response(JSON.stringify({ error: "Token et nom requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!signatureDataUrl) {
      return new Response(JSON.stringify({ error: "La signature manuscrite est requise" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch signature record
    const { data: sig, error: sigFetchErr } = await supabase
      .from("devis_signatures")
      .select("id, status, expires_at, devis_id, company_id")
      .eq("token", token)
      .single();

    if (sigFetchErr || !sig) {
      return new Response(JSON.stringify({ error: "Lien invalide" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (sig.status === "signed") {
      return new Response(JSON.stringify({ error: "Devis déjà signé" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(sig.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Lien expiré" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update signature record with signature image
    const { error: updateSigErr } = await supabase
      .from("devis_signatures")
      .update({
        status: "signed",
        signer_name: signerName.trim(),
        signer_email: signerEmail?.trim() || null,
        signed_at: new Date().toISOString(),
        signature_data_url: signatureDataUrl,
      })
      .eq("token", token);

    if (updateSigErr) throw updateSigErr;

    // Fetch devis details for notification + email
    const { data: devisData } = await supabase
      .from("devis")
      .select("id, code, objet, company_id, created_by, client_id, clients(name, email), companies(name, short_name, email)")
      .eq("id", sig.devis_id)
      .single();

    // Update devis status
    const { error: updateDevisErr } = await supabase
      .from("devis")
      .update({
        status: "accepte",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", sig.devis_id);

    if (updateDevisErr) throw updateDevisErr;

    // Send notifications to all company members
    if (devisData) {
      const clientName = (devisData as any).clients?.name || signerName.trim();
      const devisCode = devisData.code || "";
      const companyId = devisData.company_id;

      const { data: members } = await supabase
        .from("company_memberships")
        .select("profile_id")
        .eq("company_id", companyId);

      if (members && members.length > 0) {
        const notifications = members.map((m: any) => ({
          user_id: m.profile_id,
          company_id: companyId,
          type: "devis_accepted" as const,
          title: `Devis ${devisCode} accepté !`,
          body: `${clientName} a accepté et signé le devis "${devisData.objet || devisCode}".`,
          link: `/devis/${sig.devis_id}`,
        }));

        await supabase.from("notifications").insert(notifications);
      }

      // Send signed PDF email via Resend
      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        const SMTP_USER = Deno.env.get("SMTP_USER");
        
        if (RESEND_API_KEY || SMTP_USER) {
          const companyData = devisData as any;
          const companyEmail = companyData.companies?.email;
          const companyName = companyData.companies?.name || companyData.companies?.short_name || "L'entreprise";
          const recipientEmail = signerEmail?.trim() || (companyData.clients?.email);
          
          // Build list of email recipients
          const toEmails: string[] = [];
          if (recipientEmail) toEmails.push(recipientEmail);
          
          // CC company
          const ccEmails: string[] = [];
          if (companyEmail) ccEmails.push(companyEmail);
          
          if (toEmails.length > 0 && RESEND_API_KEY) {
            const sanitizedSignerName = signerName.trim().replace(/[<>&"']/g, '');
            const sanitizedDevisCode = (devisCode || '').replace(/[<>&"']/g, '');
            const sanitizedObjet = (devisData.objet || '').replace(/[<>&"']/g, '');
            const sanitizedCompanyName = companyName.replace(/[<>&"']/g, '');

            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #C85020;">Devis ${sanitizedDevisCode} — Signé ✓</h2>
                <p>Bonjour,</p>
                <p>Le devis <strong>${sanitizedDevisCode}</strong> concernant « ${sanitizedObjet} » a été accepté et signé électroniquement par <strong>${sanitizedSignerName}</strong>.</p>
                <p>La signature manuscrite est intégrée au devis. Vous pouvez retrouver ce devis dans votre espace.</p>
                <br/>
                <p style="color: #666; font-size: 12px;">— ${sanitizedCompanyName}</p>
              </div>
            `;

            const fromEmail = SMTP_USER || "noreply@altasart.com";

            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: `${companyName} <${fromEmail}>`,
                to: toEmails,
                cc: ccEmails.length > 0 ? ccEmails : undefined,
                subject: `Devis ${devisCode} signé — ${devisData.objet || ''}`,
                html: emailHtml,
              }),
            });
          }
        }
      } catch (emailErr) {
        // Email is best-effort, don't fail the signature
        console.error("Email send error:", emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});