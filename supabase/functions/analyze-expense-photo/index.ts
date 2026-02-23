import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate base64 size (max 10MB)
    const sizeBytes = (imageBase64.length * 3) / 4;
    if (sizeBytes > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Image trop volumineuse (max 10MB)" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate mime type
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (mimeType && !allowedTypes.includes(mimeType)) {
      return new Response(JSON.stringify({ error: "Format d'image non supporté" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Tu es un expert comptable spécialisé dans l'analyse de tickets de caisse, factures de carburant, péages, entretien automobile et engins de chantier.
Tu extrais les informations clés avec précision.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans explication.`;

    const userPrompt = `Analyse cette photo de ticket/facture et extrais les informations.

Retourne un JSON avec ces champs (laisse null si non trouvé, ne devine pas) :
{
  "expense_type": "gasoil | entretien | peage | lavage | amende | reparation | autre",
  "amount": 85.50,
  "expense_date": "YYYY-MM-DD",
  "vendor": "Nom du fournisseur/station/prestataire",
  "description": "Description courte de la dépense",
  "liters": 45.2,
  "mileage_km": 125430,
  "reference": "Numéro de facture ou ticket",
  "notes": "Détails supplémentaires pertinents"
}

Règles :
- expense_type doit être l'une des valeurs listées
- Pour le gasoil, extrais les litres si visible
- Pour l'entretien/réparation, détaille dans description
- Le kilométrage est souvent imprimé sur les tickets de carburant
- amount est toujours le montant TTC`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: `data:${mimeType ?? "image/jpeg"};base64,${imageBase64}` } },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez dans quelques instants." }), { status: 429, headers: corsHeaders });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants pour l'analyse IA." }), { status: 402, headers: corsHeaders });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur IA" }), { status: 500, headers: corsHeaders });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "{}";

    let extracted: Record<string, unknown> = {};
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      extracted = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      extracted = { notes: content };
    }

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-expense-photo error:", e);
    return new Response(JSON.stringify({ error: "Une erreur est survenue lors de l'analyse." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
