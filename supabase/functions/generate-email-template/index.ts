import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  suivi_client: "suivi post-déménagement et demande d'avis client",
};

const TONE_LABELS: Record<string, string> = {
  cordial: "cordial et chaleureux",
  formel: "formel et professionnel",
  direct: "direct et concis",
};

const VARIABLES_BY_TYPE: Record<string, string[]> = {
  devis_envoi: ["{{contact_name}}", "{{client_name}}", "{{devis_code}}", "{{devis_objet}}", "{{devis_amount}}", "{{devis_valid_until}}", "{{signature_url}}", "{{sender_name}}", "{{company_name}}"],
  devis_relance_1: ["{{contact_name}}", "{{client_name}}", "{{devis_code}}", "{{devis_objet}}", "{{devis_amount}}", "{{devis_valid_until}}", "{{devis_sent_at}}", "{{signature_url}}", "{{sender_name}}", "{{company_name}}"],
  devis_relance_2: ["{{contact_name}}", "{{client_name}}", "{{devis_code}}", "{{devis_objet}}", "{{devis_amount}}", "{{devis_valid_until}}", "{{devis_sent_at}}", "{{signature_url}}", "{{sender_name}}", "{{company_name}}"],
  devis_relance_3: ["{{contact_name}}", "{{client_name}}", "{{devis_code}}", "{{devis_objet}}", "{{devis_amount}}", "{{devis_valid_until}}", "{{devis_sent_at}}", "{{signature_url}}", "{{sender_name}}", "{{company_name}}"],
  rapport_visite: ["{{contact_name}}", "{{client_name}}", "{{visite_title}}", "{{visite_date}}", "{{visite_address}}", "{{dossier_code}}", "{{dossier_title}}", "{{sender_name}}", "{{company_name}}"],
  suivi_client: ["{{contact_name}}", "{{client_name}}", "{{dossier_title}}", "{{dossier_code}}", "{{dossier_end_date}}", "{{sender_name}}", "{{company_name}}"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    // Support both "type" (frontend) and "emailType" (legacy)
    const emailType = body.type || body.emailType;
    const tone = body.tone || "cordial";
    const companyName = body.companyName;
    const context = body.context;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const typeLabel = TYPE_LABELS[emailType] || emailType;
    const toneLabel = TONE_LABELS[tone] || tone;
    const availableVars = VARIABLES_BY_TYPE[emailType] || [];

    const systemPrompt = `Tu es un expert en communication commerciale pour une entreprise de déménagement et manutention spécialisée.
Tu rédiges des emails professionnels en français, adaptés au secteur du déménagement d'entreprise et particulier.

Règles impératives :
- Utilise UNIQUEMENT les variables listées pour ce type d'email entre doubles accolades
- Utilise TOUTES les variables pertinentes disponibles pour enrichir le message
- Ne jamais inventer de variables non listées
- Les variables seront remplacées automatiquement par les vraies valeurs (nom du client, montant réel, date réelle, etc.)`;

    const userPrompt = `Génère un modèle d'email pour le contexte suivant :
- Type : ${typeLabel}
- Ton : ${toneLabel}
- Société : ${companyName || "notre société"}
${context ? `- Contexte supplémentaire : ${context}` : ""}

Variables disponibles pour ce type : ${availableVars.join(", ")}

Retourne uniquement un objet JSON avec les champs "subject" et "body" (corps en texte brut, pas HTML).
Le body doit utiliser des sauts de ligne naturels et inclure toutes les variables disponibles de manière naturelle.
Commence le body par "Bonjour {{contact_name}},".
Termine par "Cordialement,\\n{{sender_name}}\\n{{company_name}}".`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!response.ok) {
      const status = response.status;
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
      const text = await response.text();
      throw new Error(`AI gateway error ${status}: ${text}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error("Réponse IA vide");

    const parsed = JSON.parse(content);
    return new Response(JSON.stringify({ subject: parsed.subject, body: parsed.body }), {
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
