import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, visite_id, company_id } = await req.json();
    if (!text || !visite_id || !company_id) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Use AI to parse materials
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Tu es un assistant spécialisé dans l'extraction de listes de matériel à partir de texte brut (emails, documents, listes).
Extrais chaque élément avec : designation (nom), quantity (nombre, défaut 1), dimensions (texte libre si présent), weight (nombre en kg si présent).
Retourne UNIQUEMENT un JSON valide.`,
          },
          {
            role: "user",
            content: `Extrais la liste de matériel du texte suivant :\n\n${text}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_materials",
              description: "Extract a list of materials from text",
              parameters: {
                type: "object",
                properties: {
                  materials: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        designation: { type: "string" },
                        quantity: { type: "number" },
                        dimensions: { type: "string" },
                        weight: { type: "number" },
                      },
                      required: ["designation"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["materials"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_materials" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes IA atteinte, réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const { materials } = JSON.parse(toolCall.function.arguments);
    if (!Array.isArray(materials) || materials.length === 0) {
      return new Response(JSON.stringify({ count: 0, message: "Aucun matériel détecté" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into database
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const rows = materials.map((m: any, idx: number) => ({
      visite_id,
      company_id,
      designation: m.designation || "Sans nom",
      quantity: m.quantity || 1,
      dimensions: m.dimensions || null,
      weight: m.weight || null,
      sort_order: idx,
    }));

    const { error: insertError } = await supabase.from("visite_materiel").insert(rows);
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ count: rows.length, materials: rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-materiel error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
