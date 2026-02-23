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
    const { token, signerName, signerEmail } = await req.json();

    if (!token || !signerName?.trim()) {
      return new Response(JSON.stringify({ error: "Token et nom requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch signature record with devis info
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

    // Update signature record
    const { error: updateSigErr } = await supabase
      .from("devis_signatures")
      .update({
        status: "signed",
        signer_name: signerName.trim(),
        signer_email: signerEmail?.trim() || null,
        signed_at: new Date().toISOString(),
      })
      .eq("token", token);

    if (updateSigErr) throw updateSigErr;

    // Fetch devis details for notification
    const { data: devisData } = await supabase
      .from("devis")
      .select("code, objet, company_id, created_by, client_id, clients(name)")
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

      // Get all members of this company
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
          body: `${clientName} a accepté le devis "${devisData.objet || devisCode}".`,
          link: `/devis/${sig.devis_id}`,
        }));

        await supabase.from("notifications").insert(notifications);
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
