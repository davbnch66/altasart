import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { address, visiteId, dossierId, companyId, existingElements, hasBackgroundPlan, stageWidth, stageHeight, planRect, planImageBase64 } = await req.json();

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

ÉTAPE 1 — ANALYSE VISUELLE OBLIGATOIRE :
Tu VOIS l'image du plan de voirie. DÉCRIS MENTALEMENT ce que tu observes :
- Où sont les rues ? Dans quelle direction vont-elles ? (horizontales, verticales, diagonales)
- Où sont les bâtiments, trottoirs, intersections ?
- Où se trouve l'adresse du chantier sur le plan ?
- Quelle est la largeur apparente des rues en pixels ?
- Y a-t-il des noms de rues visibles ?

ÉTAPE 2 — POSITIONNEMENT :
Place chaque élément en te basant sur ce que tu VOIS dans l'image.
Les coordonnées (x, y) sont en PIXELS par rapport au coin supérieur gauche de l'image.

Contexte du chantier :
- Adresse : ${address || "Non précisée"}
${visiteData ? `- Visite technique : ${visiteData.code || ""}` : ""}
${dossierData ? `- Dossier : ${dossierData.title || dossierData.code || ""}` : ""}
${cranes.length > 0 ? `- Grues disponibles : ${cranes.map((c: any) => `${c.name} (${c.brand || ""} ${c.model || ""}, portée: ${c.reach_meters || "?"}m)`).join(", ")}` : ""}

Dimensions du canvas : ${stageWidth}x${stageHeight} pixels.
Zone utile du plan (image visible) : x=${planRect?.x ?? 0}, y=${planRect?.y ?? 0}, largeur=${planRect?.width ?? stageWidth}, hauteur=${planRect?.height ?? stageHeight}.
${existingElements?.length > 0 ? `Éléments déjà placés : ${JSON.stringify(existingElements)}` : "Aucun élément existant."}

RÈGLES DE PLACEMENT :
1. GRUE : SUR la chaussée, devant l'adresse. Rayon proportionnel à la portée réelle.
2. CÔNES : En ligne le long de la chaussée pour délimiter la zone de travaux. ESPACÉS régulièrement (tous les 30-50px).
3. BARRIÈRES : Aux accès de la zone de travaux, perpendiculaires à la route.
4. HOMMES TRAFIC : Aux DEUX extrémités de la zone, SUR la chaussée, à 100-150px de la grue.
5. PANNEAUX AK5 : EN AMONT du chantier (50-100px avant la zone dans le sens de circulation).
6. ZONE EMPRISE : Rectangle couvrant toute la zone de travail sur la chaussée.
7. FLÈCHES DÉVIATION : Indiquent le contournement.
8. TOTEMS 30 : En approche du chantier (100-200px avant).

CONTRAINTES ABSOLUES :
- RÉPARTIS les éléments sur TOUTE la longueur de la zone de travaux visible.
- Les cônes doivent former une LIGNE le long de la rue, PAS un amas.
- Chaque élément doit être à une position DISTINCTE et JUSTIFIÉE visuellement.
- INTERDIT d'empiler les éléments au même endroit.
- Les coordonnées DOIVENT être dans la zone utile : x entre ${planRect?.x ?? 0} et ${(planRect?.x ?? 0) + (planRect?.width ?? stageWidth)}, y entre ${planRect?.y ?? 0} et ${(planRect?.y ?? 0) + (planRect?.height ?? stageHeight)}.`;

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
        text: "Voici le plan de voirie. Analyse-le et place les éléments uniquement sur les zones roulables/abords visibles. Évite tout regroupement au centre. Les coordonnées doivent être en pixels absolus dans la zone utile du plan (planRect).",
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
        model: "google/gemini-2.5-pro",
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

    const bounds = (planRect && Number.isFinite(planRect.x) && Number.isFinite(planRect.y) && Number.isFinite(planRect.width) && Number.isFinite(planRect.height))
      ? planRect
      : { x: 0, y: 0, width: stageWidth || 800, height: stageHeight || 600 };

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    const elements = (parsed.elements || []).map((el: any) => {
      const x = typeof el.x === "number" ? el.x : bounds.x + bounds.width / 2;
      const y = typeof el.y === "number" ? el.y : bounds.y + bounds.height / 2;

      return {
        ...el,
        x: clamp(x, bounds.x, bounds.x + bounds.width),
        y: clamp(y, bounds.y, bounds.y + bounds.height),
      };
    });

    return new Response(JSON.stringify({ elements }), {
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
