import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { brand, model, type, supplier_name } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    let webContext = "";

    // Try Firecrawl search for specs
    if (FIRECRAWL_API_KEY) {
      try {
        const searchQuery = `${brand} ${model} ${type === "grue" ? "crane" : type} fiche technique specifications`;
        const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: 3,
            scrapeOptions: { formats: ["markdown"] },
          }),
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.data?.length) {
            webContext = searchData.data
              .slice(0, 3)
              .map((r: any) => `Source: ${r.url}\n${(r.markdown || r.description || "").substring(0, 2000)}`)
              .join("\n\n---\n\n");
          }
        }
      } catch (e) {
        console.error("Firecrawl search error:", e);
      }
    }

    const systemPrompt = `Tu es un expert en équipements de levage et manutention. Tu dois extraire les caractéristiques techniques d'un équipement à partir de son nom et des informations web fournies.

Réponds UNIQUEMENT avec un objet JSON valide contenant ces champs (null si inconnu):
{
  "capacity_tons": number|null,
  "reach_meters": number|null,
  "height_meters": number|null,
  "daily_rate": number|null,
  "weekly_rate": number|null,
  "monthly_rate": number|null,
  "description": string|null
}

Pour les tarifs, utilise des tarifs indicatifs du marché français de la location si disponibles.
Pour la description, rédige un résumé technique en 2-3 phrases.`;

    const userPrompt = `Équipement: ${brand || "?"} ${model || "?"}
Type: ${type}
Fournisseur: ${supplier_name}

${webContext ? `Informations trouvées sur le web:\n${webContext}` : "Pas d'informations web disponibles, utilise tes connaissances."}

Extrais les caractéristiques techniques.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_equipment_specs",
            description: "Extract equipment specifications",
            parameters: {
              type: "object",
              properties: {
                capacity_tons: { type: "number", description: "Capacity in tons" },
                reach_meters: { type: "number", description: "Reach in meters" },
                height_meters: { type: "number", description: "Height in meters" },
                daily_rate: { type: "number", description: "Daily rental rate in EUR" },
                weekly_rate: { type: "number", description: "Weekly rental rate in EUR" },
                monthly_rate: { type: "number", description: "Monthly rental rate in EUR" },
                description: { type: "string", description: "Technical summary" },
              },
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_equipment_specs" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans un moment" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    let specs = null;

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        specs = JSON.parse(toolCall.function.arguments);
      } catch {
        // Try extracting from content
        const content = aiData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) specs = JSON.parse(jsonMatch[0]);
      }
    }

    if (!specs) {
      // Fallback: try content parsing
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { specs = JSON.parse(jsonMatch[0]); } catch {}
      }
    }

    return new Response(JSON.stringify({ specs, sources: webContext ? "web+ai" : "ai" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-supplier-equipment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
