import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY non configurée");

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { field, context, current_text } = await req.json();
    if (!field || !context) throw new Error("field et context requis");

    const systemPrompts: Record<string, string> = {
      instructions: `Tu es un expert en manutention lourde et levage. Rédige des consignes de sécurité et un mode opératoire clair et structuré pour une opération de manutention/levage/déménagement. 
Utilise des puces ou des numéros. Sois concis mais complet. Inclus les EPI nécessaires, les précautions de levage, les accès, et les points de vigilance.
Réponds uniquement avec le texte des consignes, sans préambule.`,
      description: `Tu es un assistant pour une entreprise de manutention lourde. Rédige une description claire et professionnelle d'une intervention/opération basée sur le contexte fourni.
Sois factuel et concis. Réponds uniquement avec le texte de la description, sans préambule.`,
      notes: `Tu es un assistant pour une entreprise de manutention lourde. Rédige des notes internes utiles pour l'équipe terrain basées sur le contexte fourni.
Inclus les points d'attention, les particularités du chantier, et tout ce qui peut aider les équipes. Sois concis. Réponds uniquement avec les notes, sans préambule.`,
    };

    const systemPrompt = systemPrompts[field] || systemPrompts.description;

    const userPrompt = `Contexte de l'intervention :
${context}

${current_text ? `Texte actuel à améliorer/compléter :\n${current_text}\n` : ""}
Rédige le contenu approprié.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
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

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      throw new Error("Erreur du service IA");
    }

    const result = await aiResp.json();
    const text = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-event-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur interne" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
