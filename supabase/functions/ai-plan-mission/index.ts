import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY non configuré");

    const { prompt, resources, today } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Tu es un assistant de planification pour une entreprise de levage et manutention industrielle (grues, camions, opérateurs).
Aujourd'hui : ${today || new Date().toISOString().split("T")[0]}

Ressources disponibles avec leurs jours d'occupation :
${JSON.stringify(resources || [], null, 2)}

Analyse la demande et propose la meilleure planification en tenant compte des ressources disponibles et de leurs dates d'occupation.

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans backticks) dans ce format exact :
{
  "loading_date": "yyyy-MM-dd",
  "delivery_date": "yyyy-MM-dd ou null",
  "loading_city": "ville de chargement extraite ou null",
  "delivery_city": "ville de livraison extraite ou null",
  "resource_ids": ["id1", "id2"],
  "client_name": "nom du client extrait ou null",
  "reason": "Explication courte en français de pourquoi ces ressources et cette date (2-3 phrases max)"
}`;

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
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes IA, réessayez dans quelques secondes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés. Ajoutez des crédits dans les paramètres." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erreur du service IA");
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    
    // Safe parse: strip markdown fences if present
    const cleaned = raw.replace(/```json|```/g, "").trim();
    let suggestion;
    try {
      suggestion = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", cleaned);
      return new Response(JSON.stringify({ error: "Réponse IA invalide, réessayez." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ suggestion }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("ai-plan-mission error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Erreur lors de l'analyse IA." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
