import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find overdue invoices without recent relance
    const { data: overdue } = await supabase
      .from("factures")
      .select("id, code, amount, paid_amount, due_date, company_id, client_id, clients(name, email), companies(name, short_name, email)")
      .in("status", ["envoyee", "en_retard", "partielle"])
      .eq("archived", false)
      .not("due_date", "is", null)
      .lt("due_date", new Date().toISOString().slice(0, 10));

    if (!overdue || overdue.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No overdue invoices" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get existing relances to determine relance_num
    const factureIds = overdue.map((f: any) => f.id);
    const { data: existingRelances } = await supabase
      .from("facture_relances")
      .select("facture_id, relance_num, sent_at")
      .in("facture_id", factureIds)
      .order("relance_num", { ascending: false });

    const relanceMap = new Map<string, { num: number; lastSent: string }>();
    for (const r of existingRelances || []) {
      if (!relanceMap.has(r.facture_id)) {
        relanceMap.set(r.facture_id, { num: r.relance_num, lastSent: r.sent_at });
      }
    }

    let sent = 0;
    const now = new Date();

    for (const facture of overdue) {
      const client = facture.clients as any;
      const company = facture.companies as any;
      if (!client?.email) continue;

      const existing = relanceMap.get(facture.id);
      const nextNum = existing ? existing.num + 1 : 1;

      // Determine if enough time has passed since last relance
      // 1st relance: 30 days overdue (immediate since we already filter overdue)
      // 2nd relance: 30 days after 1st
      // 3rd relance: 30 days after 2nd
      if (existing) {
        const daysSinceLastRelance = Math.floor((now.getTime() - new Date(existing.lastSent).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLastRelance < 30) continue;
      }

      if (nextNum > 3) continue; // Max 3 relances

      const resteDu = Number(facture.amount) - Number(facture.paid_amount);
      const subject = nextNum === 1
        ? `Rappel - Facture ${facture.code || facture.id.slice(0, 8)} en attente de règlement`
        : nextNum === 2
        ? `2ème rappel - Facture ${facture.code || facture.id.slice(0, 8)} impayée`
        : `DERNIER RAPPEL - Facture ${facture.code || facture.id.slice(0, 8)}`;

      const body = `Bonjour,

Sauf erreur de notre part, nous n'avons pas reçu le règlement de la facture ${facture.code || ""} d'un montant de ${resteDu.toFixed(2)} € TTC, dont l'échéance était fixée au ${facture.due_date}.

${nextNum === 1 ? "Nous vous prions de bien vouloir procéder au règlement dans les meilleurs délais." : ""}
${nextNum === 2 ? "Nous attirons votre attention sur le fait que cette facture reste impayée malgré notre précédent rappel." : ""}
${nextNum === 3 ? "Sans règlement sous 8 jours, nous serons contraints d'engager des procédures de recouvrement." : ""}

Cordialement,
${company?.name || ""}`;

      // Try to send via email bridge if company has email account
      const { data: accounts } = await supabase
        .from("email_accounts")
        .select("id")
        .eq("company_id", facture.company_id)
        .eq("is_default", true)
        .eq("status", "active")
        .limit(1);

      if (accounts && accounts.length > 0) {
        // Send via email bridge
        const bridgeUrl = `${supabaseUrl}/functions/v1/email-bridge-send`;
        await fetch(bridgeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            account_id: accounts[0].id,
            to: [{ email: client.email, name: client.name }],
            subject,
            body_text: body,
            body_html: `<div style="font-family:sans-serif;white-space:pre-line">${body.replace(/\n/g, "<br>")}</div>`,
          }),
        });
      }

      // Record the relance
      await supabase.from("facture_relances").insert({
        facture_id: facture.id,
        company_id: facture.company_id,
        relance_num: nextNum,
        recipient_email: client.email,
        recipient_name: client.name,
        subject,
      });

      // Update facture status to en_retard if not already
      if (facture.status !== "en_retard") {
        await supabase.from("factures").update({ status: "en_retard" }).eq("id", facture.id);
      }

      sent++;
      console.log(`Relance ${nextNum} sent for facture ${facture.code || facture.id} to ${client.email}`);
    }

    return new Response(JSON.stringify({ sent, total: overdue.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Relance error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
