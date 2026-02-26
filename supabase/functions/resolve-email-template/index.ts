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

const formatDate = (d: string | null | undefined) =>
  d ? new Intl.DateTimeFormat("fr-FR").format(new Date(d)) : "";

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const body = await req.json();
    const { templateType, companyId, devisId, visiteId, dossierRelance, appBaseUrl } = body;

    if (!templateType || !companyId) {
      return new Response(JSON.stringify({ error: "templateType et companyId requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const resolvedAppBaseUrl = typeof appBaseUrl === "string" && appBaseUrl.trim().length > 0
      ? appBaseUrl.replace(/\/+$/, "")
      : "https://altasart.lovable.app";

    const { data: tpl } = await serviceSupabase
      .from("email_templates")
      .select("subject, body")
      .eq("company_id", companyId)
      .eq("type", templateType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tpl) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch sender profile
    const { data: senderProfile } = await serviceSupabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    // Fetch company info
    const { data: company } = await serviceSupabase
      .from("companies")
      .select("name, short_name")
      .eq("id", companyId)
      .maybeSingle();
    const companyName = (company as any)?.name || (company as any)?.short_name || "";

    const senderName = senderProfile?.full_name || companyName;

    // Initialize vars
    const vars: Record<string, string> = {
      client_name: "",
      contact_name: "",
      devis_code: "",
      devis_objet: "",
      devis_amount: "",
      devis_valid_until: "",
      devis_sent_at: "",
      dossier_code: "",
      dossier_title: "",
      dossier_end_date: "",
      visite_title: "",
      visite_date: "",
      visite_address: "",
      company_name: companyName,
      signature_url: "",
      sender_name: senderName,
    };

    // === Context: devis ===
    if (devisId) {
      const { data: devis } = await serviceSupabase
        .from("devis")
        .select("client_id, code, objet, amount, valid_until, sent_at, dossier_id, clients(name), dossiers(code, title, end_date)")
        .eq("id", devisId)
        .maybeSingle();

      if (devis) {
        vars.client_name = (devis.clients as any)?.name || "";
        vars.devis_code = devis.code || "";
        vars.devis_objet = (devis as any).objet || "";
        vars.devis_amount = formatAmount((devis as any).amount || 0);
        vars.devis_valid_until = formatDate((devis as any).valid_until);
        vars.devis_sent_at = formatDate((devis as any).sent_at);

        const dossier = (devis as any).dossiers as any;
        if (dossier) {
          vars.dossier_code = dossier.code || "";
          vars.dossier_title = dossier.title || "";
          vars.dossier_end_date = formatDate(dossier.end_date);
        }

        // Signature URL (for devis_envoi)
        if (templateType === "devis_envoi") {
          let signatureToken: string | null = null;
          const { data: existingSig } = await serviceSupabase
            .from("devis_signatures")
            .select("token")
            .eq("devis_id", devisId)
            .eq("status", "pending")
            .gte("expires_at", new Date().toISOString())
            .maybeSingle();

          if (existingSig) {
            signatureToken = existingSig.token;
          } else {
            const { data: newSig } = await serviceSupabase
              .from("devis_signatures")
              .insert({ devis_id: devisId, company_id: companyId })
              .select("token")
              .maybeSingle();
            signatureToken = newSig?.token || null;
          }
          if (signatureToken) {
            vars.signature_url = `${resolvedAppBaseUrl}/sign/${signatureToken}`;
          }
        }

        // Default contact
        if ((devis as any).client_id) {
          const { data: defaultContact } = await serviceSupabase
            .from("client_contacts")
            .select("first_name, last_name")
            .eq("client_id", (devis as any).client_id)
            .eq("is_default", true)
            .maybeSingle();
          if (defaultContact) {
            const full = [defaultContact.first_name, defaultContact.last_name].filter(Boolean).join(" ");
            if (full) vars.contact_name = full;
          }
          if (!vars.contact_name) vars.contact_name = vars.client_name;
        }
      }
    }

    // === Context: visite ===
    if (visiteId) {
      const { data: visite } = await serviceSupabase
        .from("visites")
        .select("client_id, title, scheduled_date, address, dossier_id, clients(name)")
        .eq("id", visiteId)
        .maybeSingle();

      if (visite) {
        vars.client_name = (visite.clients as any)?.name || vars.client_name;
        vars.visite_title = (visite as any).title || "";
        vars.visite_date = formatDate((visite as any).scheduled_date);
        vars.visite_address = (visite as any).address || "";

        if ((visite as any).dossier_id) {
          const { data: dossier } = await serviceSupabase
            .from("dossiers")
            .select("code, title, end_date")
            .eq("id", (visite as any).dossier_id)
            .maybeSingle();
          if (dossier) {
            vars.dossier_code = dossier.code || "";
            vars.dossier_title = dossier.title || "";
            vars.dossier_end_date = formatDate(dossier.end_date);
          }
        }

        if ((visite as any).client_id) {
          const { data: defaultContact } = await serviceSupabase
            .from("client_contacts")
            .select("first_name, last_name")
            .eq("client_id", (visite as any).client_id)
            .eq("is_default", true)
            .maybeSingle();
          if (defaultContact) {
            const full = [defaultContact.first_name, defaultContact.last_name].filter(Boolean).join(" ");
            if (full) vars.contact_name = full;
          }
          if (!vars.contact_name) vars.contact_name = vars.client_name;
        }
      }
    }

    // === Context: dossier (for suivi_client) ===
    if (dossierRelance) {
      const { data: dossier } = await serviceSupabase
        .from("dossiers")
        .select("code, title, end_date, client_id, clients(name)")
        .eq("id", dossierRelance)
        .maybeSingle();

      if (dossier) {
        vars.client_name = (dossier.clients as any)?.name || vars.client_name;
        vars.dossier_code = dossier.code || "";
        vars.dossier_title = dossier.title || "";
        vars.dossier_end_date = formatDate(dossier.end_date);

        if ((dossier as any).client_id) {
          const { data: defaultContact } = await serviceSupabase
            .from("client_contacts")
            .select("first_name, last_name")
            .eq("client_id", (dossier as any).client_id)
            .eq("is_default", true)
            .maybeSingle();
          if (defaultContact) {
            const full = [defaultContact.first_name, defaultContact.last_name].filter(Boolean).join(" ");
            if (full) vars.contact_name = full;
          }
          if (!vars.contact_name) vars.contact_name = vars.client_name;
        }
      }
    }

    const resolvedSubject = applyTemplate(tpl.subject, vars);
    const resolvedBody = applyTemplate(tpl.body, vars);

    return new Response(JSON.stringify({
      found: true,
      subject: resolvedSubject,
      body: resolvedBody,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("resolve-email-template error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
