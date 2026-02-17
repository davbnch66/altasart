import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const text = body.text;
    const visite_id = body.visite_id;
    const company_id = body.company_id;

    // Input validation
    if (!text || typeof text !== "string" || !visite_id || !company_id) {
      return new Response(JSON.stringify({ error: "Champs requis manquants" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(visite_id) || !uuidRegex.test(company_id)) {
      return new Response(JSON.stringify({ error: "Identifiants invalides" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > 50000) {
      return new Response(JSON.stringify({ error: "Texte trop long (max 50 000 caractères)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has access to this visite via RLS
    const { data: visiteAccess, error: accessErr } = await supabaseAuth
      .from("visites")
      .select("id")
      .eq("id", visite_id)
      .maybeSingle();
    if (accessErr || !visiteAccess) {
      return new Response(JSON.stringify({ error: "Visite introuvable ou accès refusé" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
            content: `Extrais la liste de matériel du texte suivant :\n\n${text.slice(0, 50000)}`,
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

    // Insert using service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const rows = materials.map((m: any, idx: number) => ({
      visite_id,
      company_id,
      designation: String(m.designation || "Sans nom").slice(0, 500),
      quantity: m.quantity || 1,
      dimensions: m.dimensions ? String(m.dimensions).slice(0, 200) : null,
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
    return new Response(JSON.stringify({ error: "Erreur lors de l'import du matériel." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
