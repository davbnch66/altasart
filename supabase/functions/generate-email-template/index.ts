import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TYPE_LABELS: Record<string, string> = {
  devis_envoi: "envoi d'un devis pour signature électronique",
  devis_relance_1: "première relance commerciale (3 jours après envoi du devis)",
  devis_relance_2: "deuxième relance commerciale (7 jours après envoi du devis)",
  devis_relance_3: "troisième et dernière relance commerciale (14 jours après envoi du devis)",
  rapport_visite: "envoi du rapport de visite technique PDF",
  ppsps: "envoi du Plan Particulier de Sécurité et de Protection de la Santé (PPSPS) en pièce jointe, document obligatoire avant intervention sur chantier",
  suivi_client: "suivi post-déménagement et demande d'avis client",
};

const TONE_LABELS: Record<string, string> = {
  cordial: "cordial et chaleureux",
  formel: "formel et professionnel",
  direct: "direct et concis",
  professionnel: "professionnel et soigné",
  chaleureux: "chaleureux et bienveillant",
};

const VARIABLES_BY_TYPE: Record<string, string[]> = {
  devis_envoi: ["{{contact_name}}", "{{client_name}}", "{{devis_code}}", "{{devis_objet}}", "{{devis_amount}}", "{{devis_valid_until}}", "{{signature_url}}", "{{sender_name}}", "{{company_name}}"],
  devis_relance_1: ["{{contact_name}}", "{{client_name}}", "{{devis_code}}", "{{devis_objet}}", "{{devis_amount}}", "{{devis_valid_until}}", "{{devis_sent_at}}", "{{signature_url}}", "{{sender_name}}", "{{company_name}}"],
  devis_relance_2: ["{{contact_name}}", "{{client_name}}", "{{devis_code}}", "{{devis_objet}}", "{{devis_amount}}", "{{devis_valid_until}}", "{{devis_sent_at}}", "{{signature_url}}", "{{sender_name}}", "{{company_name}}"],
  devis_relance_3: ["{{contact_name}}", "{{client_name}}", "{{devis_code}}", "{{devis_objet}}", "{{devis_amount}}", "{{devis_valid_until}}", "{{devis_sent_at}}", "{{signature_url}}", "{{sender_name}}", "{{company_name}}"],
  rapport_visite: ["{{contact_name}}", "{{client_name}}", "{{visite_title}}", "{{visite_date}}", "{{visite_address}}", "{{dossier_code}}", "{{dossier_title}}", "{{sender_name}}", "{{company_name}}"],
  suivi_client: ["{{contact_name}}", "{{client_name}}", "{{dossier_title}}", "{{dossier_code}}", "{{dossier_end_date}}", "{{sender_name}}", "{{company_name}}"],
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const emailType = body.type || body.emailType;
    const tone = body.tone || "cordial";
    const companyId = body.companyId;
    const devisId = body.devisId;
    const visiteId = body.visiteId;
    const resolveSafeAppBaseUrl = (candidate: unknown): string => {
      const fallback = "https://altasart.lovable.app";
      if (typeof candidate !== "string" || !candidate.trim()) return fallback;

      try {
        const parsed = new URL(candidate.trim());
        const isAllowedHost = parsed.hostname === "altasart.lovable.app";
        const isHttps = parsed.protocol === "https:";

        if (!isAllowedHost || !isHttps) return fallback;
        return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
      } catch {
        return fallback;
      }
    };

    const appBaseUrl = resolveSafeAppBaseUrl(body.appBaseUrl);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Auth: get current user to fetch sender name
    let senderName = "";
    let companyName = body.companyName || "";
    const authHeader = req.headers.get("Authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch sender name from auth token
    if (authHeader?.startsWith("Bearer ")) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        senderName = profile?.full_name || "";
      }
    }

    // Fetch company name if companyId provided
    if (companyId && !companyName) {
      const { data: company } = await supabase
        .from("companies")
        .select("name, short_name")
        .eq("id", companyId)
        .maybeSingle();
      companyName = (company as any)?.name || (company as any)?.short_name || "";
    }

    if (!senderName) senderName = companyName;

    // Build vars object with real data
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
      sender_name: senderName,
      signature_url: "",
    };

    // === Fetch devis context ===
    if (devisId) {
      const { data: devis } = await supabase
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

        // Get signature URL for all devis email types
        if (emailType?.startsWith("devis_") && companyId) {
          // Try to find existing valid signature token
          const { data: existingSig } = await supabase
            .from("devis_signatures")
            .select("token")
            .eq("devis_id", devisId)
            .eq("status", "pending")
            .gte("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingSig?.token) {
            vars.signature_url = `${appBaseUrl}/sign/${existingSig.token}`;
            console.log("Using existing signature token:", existingSig.token);
          } else {
            // Create a new signature token
            const { data: newSig, error: sigError } = await supabase
              .from("devis_signatures")
              .insert({ devis_id: devisId, company_id: companyId })
              .select("token")
              .single();
            if (sigError) {
              console.error("Failed to create signature:", sigError);
            } else if (newSig?.token) {
              vars.signature_url = `${appBaseUrl}/sign/${newSig.token}`;
              console.log("Created new signature token:", newSig.token);
            }
          }
        }

        // Get default contact
        if ((devis as any).client_id) {
          const { data: contact } = await supabase
            .from("client_contacts")
            .select("first_name, last_name")
            .eq("client_id", (devis as any).client_id)
            .eq("is_default", true)
            .maybeSingle();
          if (contact) {
            const full = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
            if (full) vars.contact_name = full;
          }
          if (!vars.contact_name) vars.contact_name = vars.client_name;
        }
      }
    }

    // === Fetch visite context ===
    if (visiteId) {
      const { data: visite } = await supabase
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
          const { data: dossier } = await supabase
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
          const { data: contact } = await supabase
            .from("client_contacts")
            .select("first_name, last_name")
            .eq("client_id", (visite as any).client_id)
            .eq("is_default", true)
            .maybeSingle();
          if (contact) {
            const full = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
            if (full) vars.contact_name = full;
          }
          if (!vars.contact_name) vars.contact_name = vars.client_name;
        }
      }
    }

    // Build the prompt with actual values as examples so AI writes naturally
    const typeLabel = TYPE_LABELS[emailType] || emailType;
    const toneLabel = TONE_LABELS[tone] || tone;
    const availableVars = VARIABLES_BY_TYPE[emailType] || [];

    // Show the AI the real values so it can use them as examples
    const varExamples = availableVars
      .map((v) => {
        const key = v.replace(/\{\{|\}\}/g, "");
        return `${v} = "${vars[key] || "(valeur à compléter)"}"`;
      })
      .join("\n");

    const isDevisType = emailType?.startsWith("devis_");
    const signatureInstruction = isDevisType && vars.signature_url
      ? `- OBLIGATOIRE : inclure le lien de signature {{signature_url}} dans le corps du message avec une phrase du type "Vous pouvez consulter et signer votre devis en cliquant ici : {{signature_url}}"`
      : "";

    const systemPrompt = `Tu es un expert en communication commerciale pour une entreprise de déménagement et manutention spécialisée.
Tu rédiges des emails professionnels en français, adaptés au secteur du déménagement d'entreprise et particulier.

Règles IMPÉRATIVES :
- Utilise les variables entre doubles accolades EXACTEMENT comme indiquées (ex: {{contact_name}})
- N'invente JAMAIS de nouvelles variables
- Utilise TOUTES les variables pertinentes disponibles
- Les vraies valeurs sont indiquées ci-dessous pour référence, mais utilise TOUJOURS les variables dans le texte généré
${signatureInstruction}`;

    const userPrompt = `Génère un email professionnel pour : ${typeLabel}
Ton : ${toneLabel}
Société expéditrice : ${companyName || "notre société"}

Variables disponibles et leurs valeurs actuelles :
${varExamples}

Retourne UNIQUEMENT un JSON avec "subject" et "body" (texte brut, pas HTML).
Le body doit :
- Commencer par "Bonjour {{contact_name}},"
- Utiliser les variables {{...}} partout où c'est naturel
${isDevisType ? "- Inclure OBLIGATOIREMENT {{signature_url}} pour que le client puisse signer le devis" : ""}
- Terminer par "Cordialement,\\n{{sender_name}}\\n{{company_name}}"`;


    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await aiResponse.text();
      throw new Error(`AI gateway error ${status}: ${text}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error("Réponse IA vide");

    const parsed = JSON.parse(content);

    // Apply real variable substitution to the AI-generated content
    const resolvedSubject = applyTemplate(parsed.subject || "", vars);
    const resolvedBody = applyTemplate(parsed.body || "", vars);

    return new Response(JSON.stringify({
      subject: resolvedSubject,
      body: resolvedBody,
      // Also return the raw template with vars in case the caller wants it
      subjectTemplate: parsed.subject,
      bodyTemplate: parsed.body,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-email-template error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
