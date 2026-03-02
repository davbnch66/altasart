import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { address, visiteId, dossierId, companyId, existingElements, hasBackgroundPlan, stageWidth, stageHeight, planImageBase64 } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

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

    if (companyId) {
      const fleetResp = await fetch(`${supabaseUrl}/rest/v1/fleet_vehicles?select=id,name,type,brand,model,capacity_tons,reach_meters&company_id=eq.${companyId}&type=eq.grue`, { headers });
      const fleetData = await fleetResp.json().catch(() => []);
      cranes = Array.isArray(fleetData) ? fleetData : [];
    }

    const systemPrompt = `Tu es un expert en plans d'implantation de grues et signalisation de chantier en France.
Tu dois générer les éléments à placer sur un plan de voirie pour un chantier de manutention/levage.

IMPORTANT: Tu VOIS l'image du plan de voirie. Analyse-la attentivement pour :
1. Identifier les rues, trottoirs, bâtiments, intersections
2. Repérer les numéros de rue et le nom des voies
3. Comprendre la configuration de la chaussée (sens de circulation, largeur)
4. Positionner les éléments de manière RÉALISTE par rapport à ce que tu vois

Contexte du chantier :
- Adresse : ${address || "Non précisée"}
${visiteData ? `- Visite technique : ${visiteData.code || ""}` : ""}
${dossierData ? `- Dossier : ${dossierData.title || dossierData.code || ""}` : ""}
${cranes.length > 0 ? `- Grues disponibles : ${cranes.map((c: any) => `${c.name} (${c.brand || ""} ${c.model || ""}, portée: ${c.reach_meters || "?"}m)`).join(", ")}` : ""}

Dimensions du canvas : ${stageWidth}x${stageHeight} pixels.
${existingElements?.length > 0 ? `Éléments déjà placés : ${JSON.stringify(existingElements)}` : "Aucun élément existant."}

Règles de placement CRITIQUES :
1. La GRUE doit être positionnée SUR LA CHAUSSÉE, devant l'adresse du chantier. Son rayon correspond à sa portée réelle en pixels proportionnellement au plan.
2. Les CÔNES de balisage doivent délimiter la zone de travaux le long de la chaussée, en ligne.
3. Les BARRIÈRES ferment les accès à la zone de travaux.
4. Les HOMMES TRAFIC sont placés aux extrémités de la zone de travaux, sur la chaussée, pour réguler la circulation.
5. Les PANNEAUX K8 (danger) sont placés en amont du chantier (avant la zone de travaux dans le sens de circulation).
6. La ZONE D'EMPRISE couvre la surface occupée sur la chaussée (rectangle vert englobant grue + zone de travail).
7. Les FLÈCHES DE DÉVIATION indiquent le contournement de la zone de travaux.
8. Le panneau ROUTE BARRÉE est placé à l'entrée de la zone si la rue est fermée.
9. Les TOTEMS (limitation 30) sont placés en approche du chantier.

POSITIONNE les éléments en coordonnées PIXEL (x, y) en analysant l'image du plan. Place-les aux bons endroits visibles sur le plan (sur les rues, trottoirs, intersections que tu vois).`;

    // Build messages with vision if image is available
    const userContent: any[] = [];
    
    if (planImageBase64) {
      // Extract base64 data (remove data:image/...;base64, prefix if present)
      let imageData = planImageBase64;
      let mediaType = "image/jpeg";
      const match = planImageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        mediaType = match[1];
        imageData = match[2];
      }
      
      userContent.push({
        type: "image_url",
        image_url: {
          url: planImageBase64.startsWith("data:") ? planImageBase64 : `data:image/jpeg;base64,${planImageBase64}`,
        },
      });
      userContent.push({
        type: "text",
        text: "Voici le plan de voirie. Analyse-le et positionne les éléments de chantier (grue, cônes, barrières, homme trafic, panneaux, zone d'emprise) aux bons endroits sur la chaussée visible dans l'image. Les coordonnées doivent correspondre aux positions réelles sur cette image.",
      });
    } else {
      userContent.push({
        type: "text",
        text: "Génère les éléments du plan d'implantation pour ce chantier. Positionne-les de manière réaliste sur le canvas.",
      });
    }

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
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "place_elements",
            description: "Place les éléments sur le plan d'implantation de grue aux coordonnées pixel correspondant aux positions visibles sur le plan",
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
                      x: { type: "number", description: "Position X en pixels sur le plan" },
                      y: { type: "number", description: "Position Y en pixels sur le plan" },
                      rotation: { type: "number", description: "Rotation en degrés" },
                      radius: { type: "number", description: "Rayon de giration pour les grues en pixels (proportionnel à la portée réelle)" },
                      label: { type: "string", description: "Label pour les grues (ex: 'Grue 15m') ou texte personnalisé" },
                      width: { type: "number", description: "Largeur pour zone emprise en pixels" },
                      height: { type: "number", description: "Hauteur pour zone emprise en pixels" },
                      text: { type: "string", description: "Texte pour custom_text" },
                      color: { type: "string", description: "Couleur hex optionnelle" },
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
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
