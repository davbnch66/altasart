import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { visite_id } = await req.json();
    if (!visite_id) throw new Error("visite_id requis");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all visit data in parallel
    const [visiteRes, materielRes, contraintesRes, rhRes, vehiculesRes, piecesRes] = await Promise.all([
      supabase.from("visites").select("*, clients(name)").eq("id", visite_id).single(),
      supabase.from("visite_materiel").select("*").eq("visite_id", visite_id).order("sort_order"),
      supabase.from("visite_contraintes").select("*").eq("visite_id", visite_id).maybeSingle(),
      supabase.from("visite_ressources_humaines").select("*").eq("visite_id", visite_id),
      supabase.from("visite_vehicules").select("*").eq("visite_id", visite_id),
      supabase.from("visite_pieces").select("*").eq("visite_id", visite_id),
    ]);

    const visite = visiteRes.data;
    const materiel = materielRes.data || [];
    const contraintes = contraintesRes.data;
    const rh = rhRes.data || [];
    const vehicules = vehiculesRes.data || [];
    const pieces = piecesRes.data || [];

    if (!visite) throw new Error("Visite introuvable");

    // Build context
    const totalWeight = materiel.reduce((s: number, m: any) => s + (m.weight || 0) * m.quantity, 0);
    const heavyItems = materiel.filter((m: any) => m.weight && m.weight > 100);

    const context = `
## DONNÉES DE LA VISITE

### Client : ${(visite.clients as any)?.name || "N/A"}
### Opération : ${visite.nature || visite.operation_type || "Non précisée"}
### Adresses :
- Origine : ${visite.origin_address_line1 || visite.address || "N/A"}, ${visite.origin_city || ""} (étage: ${visite.origin_floor || "RDC"})
  - Ascenseur: ${visite.origin_elevator ? "Oui" : "Non"}, Monte-meubles: ${visite.origin_furniture_lift ? "Oui" : "Non"}, Portage: ${visite.origin_portage || 0}m
- Destination : ${visite.dest_address_line1 || "N/A"}, ${visite.dest_city || ""} (étage: ${visite.dest_floor || "RDC"})
  - Ascenseur: ${visite.dest_elevator ? "Oui" : "Non"}, Monte-meubles: ${visite.dest_furniture_lift ? "Oui" : "Non"}, Portage: ${visite.dest_portage || 0}m
### Distance : ${visite.distance || "N/A"} km
### Volume : ${visite.volume || 0} m³

### Pièces / Zones (${pieces.length}) :
${pieces.map((p: any) => `- ${p.name} (étage: ${p.floor_level || "?"}, accès: ${p.access_comments || "normal"})`).join("\n")}

### Matériel (${materiel.length} éléments, poids total: ${totalWeight} kg) :
${materiel.map((m: any) => `- ${m.designation} x${m.quantity} ${m.dimensions ? `(${m.dimensions})` : ""} ${m.weight ? `— ${m.weight}kg/u` : ""}`).join("\n")}
${heavyItems.length > 0 ? `\n⚠️ Charges lourdes (>100kg) : ${heavyItems.map((m: any) => `${m.designation} (${m.weight}kg)`).join(", ")}` : ""}

### Contraintes d'accès :
${contraintes ? `- Largeur portes: ${contraintes.door_width || "N/A"}, Escaliers: ${contraintes.stairs || "Non"}, Monte-charge: ${contraintes.freight_elevator ? "Oui" : "Non"}, Rampe: ${contraintes.ramp ? "Oui" : "Non"}
- Obstacles: ${contraintes.obstacles || "Aucun"}, Autorisations: ${contraintes.authorizations || "Aucune"}
- Notes: ${contraintes.notes || ""}` : "Aucune contrainte renseignée"}

### Ressources humaines prévues :
${rh.length > 0 ? rh.map((r: any) => `- ${r.role} x${r.quantity} ${r.duration_estimate ? `(${r.duration_estimate})` : ""}`).join("\n") : "Non renseignées"}

### Véhicules et engins prévus :
${vehicules.length > 0 ? vehicules.map((v: any) => `- ${v.type}${v.label ? ` (${v.label})` : ""} ${v.capacity ? `— ${v.capacity}t` : ""} ${v.reach ? `— portée ${v.reach}m` : ""}`).join("\n") : "Non renseignés"}
`;

    const prompt = `Tu es un expert en logistique de déménagement, manutention lourde et levage. Génère une méthodologie détaillée et professionnelle pour cette opération.

${context}

## INSTRUCTIONS
Rédige une méthodologie structurée qui inclut :

1. **Résumé de l'opération** : nature, volumes, distances
2. **Analyse des risques** : identifier les risques liés aux charges lourdes, accès difficiles, hauteurs
3. **Méthode opératoire détaillée** : étapes chronologiques précises (protection, démontage, manutention, chargement, transport, déchargement, remontage)
4. **Moyens de levage et manutention** : recommander les engins adaptés. Si les moyens actuels sont insuffisants, SUGGÉRER du matériel à louer chez des confrères (grue, nacelle, monte-meubles, etc.)
5. **Schémas descriptifs** : pour les opérations complexes, décris textuellement les plans de manutention (parcours, positionnement des engins)
6. **Conformité réglementaire** : références au Code du travail (R4541-1 à R4541-9 manutention manuelle, R4323-29 levage), normes NF EN 14015 et recommandations CNAM R367/R383
7. **Mesures de sécurité** : EPI, balisage, communication, plan d'urgence

Génère également une checklist de sécurité adaptée (10-15 points maximum).

## FORMAT DE RÉPONSE
Réponds en JSON strict :
{
  "content": "texte complet de la méthodologie en markdown",
  "checklist": ["point 1", "point 2", ...]
}`;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Tu es un expert en logistique de déménagement et manutention lourde. Utilise la fonction fournie pour structurer ta réponse." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        tools: [
          {
            type: "function",
            function: {
              name: "submit_methodologie",
              description: "Soumet la méthodologie structurée avec le contenu markdown et la checklist de sécurité",
              parameters: {
                type: "object",
                properties: {
                  content: {
                    type: "string",
                    description: "Texte complet de la méthodologie en markdown (résumé, analyse risques, méthode opératoire, moyens de levage, schémas, conformité, sécurité)"
                  },
                  checklist: {
                    type: "array",
                    items: { type: "string" },
                    description: "Liste de 10-15 points de la checklist sécurité"
                  }
                },
                required: ["content", "checklist"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "submit_methodologie" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error("Limite de requêtes atteinte, réessayez dans quelques instants");
      }
      if (aiResponse.status === 402) {
        throw new Error("Crédits IA insuffisants");
      }
      const errText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} - ${errText}`);
    }

    const aiData = await aiResponse.json();
    
    // Extract from tool call
    let parsed;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch {
        parsed = { content: toolCall.function.arguments, checklist: [] };
      }
    } else {
      // Fallback to raw content
      const rawContent = aiData.choices?.[0]?.message?.content || "";
      try {
        const jsonStr = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = { content: rawContent, checklist: [] };
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
