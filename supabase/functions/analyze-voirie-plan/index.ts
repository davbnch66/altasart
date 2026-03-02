import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { address, visiteId, dossierId, companyId, existingElements, hasBackgroundPlan, stageWidth, stageHeight } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    // Fetch context: visite data, dossier data, resources (cranes)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };

    let visiteData: any = null;
    let dossierData: any = null;
    let cranes: any[] = [];

    if (visiteId) {
      const resp = await fetch(`${supabaseUrl}/rest/v1/visites?id=eq.${visiteId}&select=*,clients(name),dossiers(title,code,loading_address,delivery_address)`, { headers });
      const data = await resp.json();
      visiteData = data?.[0];
    }

    if (dossierId) {
      const resp = await fetch(`${supabaseUrl}/rest/v1/dossiers?id=eq.${dossierId}&select=*,clients(name)`, { headers });
      const data = await resp.json();
      dossierData = data?.[0];
    }

    // Get available cranes/resources for the company
    if (companyId) {
      const resp = await fetch(`${supabaseUrl}/rest/v1/resources?select=id,name,type,brand,model,capacity_tons,reach_meters&type=eq.equipement&company_id=eq.${companyId}`, { headers });
      const craneFetch = await fetch(`${supabaseUrl}/rest/v1/resources?select=id,name,type,brand,model&resource_type=eq.equipement`, { headers }).catch(() => null);
      
      // Also check fleet vehicles (grues)
      const fleetResp = await fetch(`${supabaseUrl}/rest/v1/fleet_vehicles?select=id,name,type,brand,model,capacity_tons,reach_meters&company_id=eq.${companyId}&type=eq.grue`, { headers });
      const fleetData = await fleetResp.json().catch(() => []);
      cranes = Array.isArray(fleetData) ? fleetData : [];
    }

    const systemPrompt = `Tu es un expert en plans d'implantation de grues et signalisation de chantier en France.
Tu dois générer les éléments à placer sur un plan de voirie pour un chantier de manutention/levage.

Contexte du chantier :
- Adresse : ${address || "Non précisée"}
${visiteData ? `- Visite technique : ${visiteData.code || ""}` : ""}
${dossierData ? `- Dossier : ${dossierData.title || dossierData.code || ""}` : ""}
${cranes.length > 0 ? `- Grues disponibles : ${cranes.map(c => `${c.name} (${c.brand || ""} ${c.model || ""}, portée: ${c.reach_meters || "?"}m)`).join(", ")}` : ""}

Dimensions du canvas : ${stageWidth}x${stageHeight} pixels.
${existingElements?.length > 0 ? `Éléments déjà placés : ${JSON.stringify(existingElements)}` : "Aucun élément existant."}

Règles de placement :
1. La grue doit être positionnée avec un rayon de giration adapté à sa portée
2. Le balisage K8 (panneau de chantier AK5) doit être placé en amont du chantier (50-200m selon vitesse)
3. Les cônes doivent délimiter la zone de travaux
4. Les barrières ferment les accès interdits
5. Les hommes trafic sont placés aux intersections impactées
6. La zone d'emprise couvre la surface occupée sur la chaussée
7. Les panneaux de déviation guident le trafic alternatif
8. Les flèches de déviation indiquent le sens alternatif
9. La signalisation piéton protège les passants
10. Les totems de ralentissement sont placés en approche

Positionne les éléments de manière réaliste en tenant compte de l'espace disponible.`;

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
          { role: "user", content: "Génère les éléments du plan d'implantation pour ce chantier." },
        ],
        tools: [{
          type: "function",
          function: {
            name: "place_elements",
            description: "Place les éléments sur le plan d'implantation de grue",
            parameters: {
              type: "object",
              properties: {
                elements: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: ["grue", "balisage_cone", "balisage_barriere", "panneau_k8", "panneau_travaux", "panneau_deviation", "panneau_rue_barree", "totem", "homme_traffic", "zone_emprise", "fleche_deviation", "pieton_deviation", "custom_text"],
                      },
                      x: { type: "number", description: "Position X en pixels" },
                      y: { type: "number", description: "Position Y en pixels" },
                      rotation: { type: "number", description: "Rotation en degrés" },
                      radius: { type: "number", description: "Rayon de giration pour les grues en pixels" },
                      label: { type: "string", description: "Label pour les grues ou texte personnalisé" },
                      width: { type: "number", description: "Largeur pour zone emprise" },
                      height: { type: "number", description: "Hauteur pour zone emprise" },
                      text: { type: "string", description: "Texte pour custom_text" },
                      color: { type: "string", description: "Couleur hex" },
                    },
                    required: ["type", "x", "y"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["elements"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "place_elements" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("Erreur IA");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Pas de réponse structurée de l'IA");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ elements: parsed.elements || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-voirie-plan error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erreur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
