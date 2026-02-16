import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY non configuré");

    const { context, tone, intent } = await req.json();

    // context: { clientName, visiteCode, visiteTitle, subject, existingBody }
    // tone: "formel" | "cordial" | "relance"
    // intent: "envoi_rapport" | "relance" | "confirmation" | "custom"

    const systemPrompt = `Tu es un assistant spécialisé dans la rédaction d'emails professionnels pour une entreprise de transport, levage et manutention lourde (ART Levage / Alti Grues / ASDGM).

Règles strictes :
- Rédige UNIQUEMENT le corps de l'email (pas d'objet, pas de "De:", pas de "À:")
- Commence par la formule de politesse d'ouverture (ex: "Bonjour,")
- Termine par une formule de politesse de fermeture (ex: "Cordialement,") SANS signer (la signature sera ajoutée automatiquement)
- Sois concis, professionnel et adapté au ton demandé
- Si un rapport PDF est joint, mentionne-le naturellement
- Ne mets jamais de placeholder entre crochets, utilise les informations fournies
- Écris en français`;

    const userPrompt = `Rédige un email avec les paramètres suivants :
- Ton : ${tone || "cordial"}
- Intention : ${intent || "envoi_rapport"}
- Client : ${context.clientName || "le client"}
- Visite : ${context.visiteCode ? `N° ${context.visiteCode}` : ""} ${context.visiteTitle || ""}
- Objet de l'email : ${context.subject || "Rapport de visite technique"}
${context.existingBody ? `- Brouillon existant à améliorer : """${context.existingBody}"""` : ""}
- Un rapport PDF est joint à l'email

${intent === "relance" ? "C'est une relance suite à un premier envoi resté sans réponse." : ""}
${intent === "confirmation" ? "C'est une confirmation de rendez-vous ou d'intervention." : ""}`;

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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques secondes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erreur du service IA");
    }

    const data = await response.json();
    const draft = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ draft }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("draft-email error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Erreur lors de la génération" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
