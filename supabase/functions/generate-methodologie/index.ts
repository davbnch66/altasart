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
    const visite_id = body.visite_id;

    if (!visite_id || typeof visite_id !== "string") {
      return new Response(JSON.stringify({ error: "visite_id requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(visite_id)) {
      return new Response(JSON.stringify({ error: "visite_id invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user access
    const { data: visiteAccess, error: accessErr } = await supabaseAuth
      .from("visites").select("id").eq("id", visite_id).maybeSingle();
    if (accessErr || !visiteAccess) {
      return new Response(JSON.stringify({ error: "Visite introuvable ou accès refusé" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch ALL visit data in parallel
    const [visiteRes, materielRes, contraintesRes, rhRes, vehiculesRes, piecesRes, photosRes] = await Promise.all([
      supabase.from("visites").select("*, clients(name, address, city, phone, email)").eq("id", visite_id).single(),
      supabase.from("visite_materiel").select("*").eq("visite_id", visite_id).order("sort_order"),
      supabase.from("visite_contraintes").select("*").eq("visite_id", visite_id).maybeSingle(),
      supabase.from("visite_ressources_humaines").select("*").eq("visite_id", visite_id),
      supabase.from("visite_vehicules").select("*").eq("visite_id", visite_id),
      supabase.from("visite_pieces").select("*").eq("visite_id", visite_id).order("sort_order"),
      supabase.from("visite_photos").select("*").eq("visite_id", visite_id).order("created_at"),
    ]);

    const visite = visiteRes.data;
    const materiel = materielRes.data || [];
    const contraintes = contraintesRes.data;
    const rh = rhRes.data || [];
    const vehicules = vehiculesRes.data || [];
    const pieces = piecesRes.data || [];
    const photos = photosRes.data || [];

    if (!visite) throw new Error("Visite introuvable");

    // Generate signed URLs for photos (max 15 to stay within token limits)
    const photoUrls: { url: string; caption: string; pieceName: string }[] = [];
    const photosToAnalyze = photos.slice(0, 15);
    
    if (photosToAnalyze.length > 0) {
      const signedUrlPromises = photosToAnalyze.map(async (photo: any) => {
        const { data: signedData } = await supabase.storage
          .from("visite-photos")
          .createSignedUrl(photo.storage_path, 600); // 10 min expiry
        
        const pieceName = photo.piece_id
          ? pieces.find((p: any) => p.id === photo.piece_id)?.name || "Inconnu"
          : "Général";
        
        if (signedData?.signedUrl) {
          photoUrls.push({
            url: signedData.signedUrl,
            caption: photo.caption || photo.file_name || "",
            pieceName,
          });
        }
      });
      await Promise.all(signedUrlPromises);
    }

    // Build comprehensive context with ALL visit fields
    const totalWeight = materiel.reduce((s: number, m: any) => s + (m.weight || 0) * m.quantity, 0);
    const totalVolume = materiel.reduce((s: number, m: any) => s + (m.volume || 0) * m.quantity, 0);
    const heavyItems = materiel.filter((m: any) => m.weight && m.weight > 100);
    const fragileItems = materiel.filter((m: any) => m.fragility && m.fragility !== "normal");

    const context = `
## DONNÉES COMPLÈTES DE LA VISITE

### Informations générales
- **Client** : ${(visite.clients as any)?.name || "N/A"}
- **Adresse client** : ${(visite.clients as any)?.address || ""}, ${(visite.clients as any)?.city || ""}
- **Titre** : ${visite.title || "N/A"}
- **Nature / Type d'opération** : ${visite.nature || visite.operation_type || "Non précisée"}
- **Type de visite** : ${visite.visit_type || "N/A"}
- **Type de devis** : ${visite.devis_type || "N/A"}
- **Conseiller** : ${visite.advisor || "N/A"}
- **Coordinateur** : ${visite.coordinator || "N/A"}
- **Sous-traitant** : ${visite.contractor || "N/A"}
- **Zone** : ${visite.zone || "N/A"}
- **Période prévue** : ${visite.period || "N/A"}
- **Durée estimée** : ${visite.duration || "N/A"}
- **Date de chargement** : ${visite.loading_date || "N/A"}
- **Distance** : ${visite.distance || "N/A"} km
- **Volume total estimé** : ${visite.volume || 0} m³

### Adresse d'origine
- **Nom** : ${visite.origin_name || "N/A"}
- **Adresse** : ${visite.origin_address_line1 || visite.address || "N/A"} ${visite.origin_address_line2 || ""}
- **Ville** : ${visite.origin_city || ""} ${visite.origin_postal_code || ""}
- **Étage** : ${visite.origin_floor || "RDC"}
- **Référence** : ${visite.origin_reference || "N/A"}
- **Ascenseur** : ${visite.origin_elevator ? "Oui" : "Non"}
- **Monte-meubles** : ${visite.origin_furniture_lift ? "Oui" : "Non"}
- **Passage par fenêtre** : ${visite.origin_window ? "Oui" : "Non"}
- **Transbordement** : ${visite.origin_transshipment ? "Oui" : "Non"}
- **Accès poids lourds** : ${visite.origin_heavy_vehicle ? "Oui" : "Non"}
- **Distance de portage** : ${visite.origin_portage || 0} m
- **Accès** : ${visite.origin_access || "N/A"}

### Adresse de destination
- **Nom** : ${visite.dest_name || "N/A"}
- **Adresse** : ${visite.dest_address_line1 || "N/A"} ${visite.dest_address_line2 || ""}
- **Ville** : ${visite.dest_city || ""} ${visite.dest_postal_code || ""}
- **Étage** : ${visite.dest_floor || "RDC"}
- **Référence** : ${visite.dest_reference || "N/A"}
- **Ascenseur** : ${visite.dest_elevator ? "Oui" : "Non"}
- **Monte-meubles** : ${visite.dest_furniture_lift ? "Oui" : "Non"}
- **Passage par fenêtre** : ${visite.dest_window ? "Oui" : "Non"}
- **Transbordement** : ${visite.dest_transshipment ? "Oui" : "Non"}
- **Accès poids lourds** : ${visite.dest_heavy_vehicle ? "Oui" : "Non"}
- **Distance de portage** : ${visite.dest_portage || 0} m
- **Accès** : ${visite.dest_access || "N/A"}

### Voirie
- **Démarches voirie nécessaires** : ${visite.needs_voirie ? "OUI" : "Non"}
- **Adresse voirie** : ${visite.voirie_address || "N/A"}

### Instructions et notes du visiteur
${visite.instructions ? `**Instructions** : ${visite.instructions}` : "Aucune instruction"}
${visite.notes ? `**Notes** : ${visite.notes}` : ""}
${visite.comment ? `**Commentaire** : ${visite.comment}` : ""}
${visite.report ? `**Rapport de visite** : ${visite.report}` : ""}

### Pièces / Zones (${pieces.length}) :
${pieces.map((p: any) => `- **${p.name}** (étage: ${p.floor_level || "?"}, dimensions: ${p.dimensions || "N/A"}, accès: ${p.access_comments || "normal"})`).join("\n")}

### Matériel (${materiel.length} éléments, poids total: ${totalWeight} kg, volume total matériel: ${totalVolume.toFixed(2)} m³) :
${materiel.map((m: any) => `- ${m.designation} x${m.quantity} ${m.dimensions ? `(${m.dimensions})` : ""} ${m.weight ? `— ${m.weight}kg/u` : ""} ${m.volume ? `— ${m.volume}m³/u` : ""} ${m.fragility ? `[Fragilité: ${m.fragility}]` : ""} ${m.handling_notes ? `[Notes: ${m.handling_notes}]` : ""}`).join("\n")}
${heavyItems.length > 0 ? `\n⚠️ **Charges lourdes (>100kg)** : ${heavyItems.map((m: any) => `${m.designation} (${m.weight}kg x${m.quantity})`).join(", ")}` : ""}
${fragileItems.length > 0 ? `\n⚠️ **Objets fragiles** : ${fragileItems.map((m: any) => `${m.designation} [${m.fragility}]`).join(", ")}` : ""}

### Contraintes d'accès :
${contraintes ? `- Largeur portes: ${contraintes.door_width || "N/A"}
- Escaliers: ${contraintes.stairs || "Non"}
- Monte-charge: ${contraintes.freight_elevator ? "Oui" : "Non"}
- Rampe: ${contraintes.ramp ? "Oui" : "Non"}
- Obstacles: ${contraintes.obstacles || "Aucun"}
- Autorisations nécessaires: ${contraintes.authorizations || "Aucune"}
- Notes contraintes: ${contraintes.notes || ""}` : "Aucune contrainte renseignée"}

### Ressources humaines prévues :
${rh.length > 0 ? rh.map((r: any) => `- ${r.role} x${r.quantity} ${r.duration_estimate ? `(durée: ${r.duration_estimate})` : ""} ${r.notes ? `— ${r.notes}` : ""}`).join("\n") : "Non renseignées"}

### Véhicules et engins prévus :
${vehicules.length > 0 ? vehicules.map((v: any) => `- ${v.type}${v.label ? ` (${v.label})` : ""} ${v.capacity ? `— capacité ${v.capacity}t` : ""} ${v.reach ? `— portée ${v.reach}m` : ""} ${v.notes ? `— ${v.notes}` : ""}`).join("\n") : "Non renseignés"}

### Photos du chantier (${photos.length} photos) :
${photoUrls.length > 0 ? photoUrls.map((p, i) => `- Photo ${i + 1} [${p.pieceName}]${p.caption ? `: ${p.caption}` : ""}`).join("\n") : "Aucune photo disponible"}
`;

    const prompt = `Tu es un expert en logistique de déménagement, manutention lourde et levage. Génère une méthodologie détaillée et professionnelle pour cette opération.

IMPORTANT : Base-toi sur TOUTES les données fournies ci-dessous, en particulier les instructions, notes, commentaires et le rapport du visiteur. Ces éléments reflètent les observations terrain et doivent être au cœur de ta méthodologie.

${context}

## INSTRUCTIONS
Rédige une méthodologie structurée qui inclut :

1. **Résumé de l'opération** : nature, volumes, distances, contexte terrain basé sur les notes et instructions du visiteur
2. **Analyse des risques** : identifier les risques liés aux charges lourdes, accès difficiles, hauteurs, fragilité des objets, passage par fenêtre, transbordement, portage long
3. **Méthode opératoire détaillée** : étapes chronologiques précises (protection, démontage, manutention, chargement, transport, déchargement, remontage). Tiens compte des observations du visiteur et des contraintes spécifiques notées.
4. **Moyens de levage et manutention** : recommander les engins adaptés. Si les moyens actuels sont insuffisants, SUGGÉRER du matériel à louer chez des confrères (grue, nacelle, monte-meubles, etc.)
5. **Schémas descriptifs** : pour les opérations complexes, décris textuellement les plans de manutention (parcours, positionnement des engins)
6. **Conformité réglementaire** : références au Code du travail (R4541-1 à R4541-9 manutention manuelle, R4323-29 levage), normes NF EN 14015 et recommandations CNAM R367/R383
7. **Mesures de sécurité** : EPI, balisage, communication, plan d'urgence
${visite.needs_voirie ? "8. **Démarches voirie** : détailler les autorisations de voirie nécessaires et le processus" : ""}
${photoUrls.length > 0 ? "\nIMPORTANT : Analyse attentivement les photos du chantier fournies. Décris ce que tu observes de pertinent (accès, obstacles, configuration des lieux, risques visuels) et intègre ces observations dans ta méthodologie." : ""}

Génère également une checklist de sécurité adaptée (10-15 points maximum).

## FORMAT DE RÉPONSE
Réponds en JSON strict :
{
  "content": "texte complet de la méthodologie en markdown",
  "checklist": ["point 1", "point 2", ...]
}`;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Build messages with image content if photos available
    const userContent: any[] = [];
    
    // Add text prompt
    userContent.push({ type: "text", text: prompt });
    
    // Add photo images for multimodal analysis
    for (const photo of photoUrls) {
      userContent.push({
        type: "image_url",
        image_url: { url: photo.url },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Tu es un expert en logistique de déménagement et manutention lourde. Utilise la fonction fournie pour structurer ta réponse. Analyse attentivement toutes les données de la visite, y compris les photos si présentes." },
          { role: "user", content: photoUrls.length > 0 ? userContent : prompt },
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
                    description: "Texte complet de la méthodologie en markdown"
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
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez dans quelques instants" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errText);
      throw new Error("Erreur du service IA");
    }

    const aiText = await aiResponse.text();
    if (!aiText || aiText.trim().length === 0) {
      throw new Error("Réponse vide du service IA");
    }
    let aiData;
    try {
      aiData = JSON.parse(aiText);
    } catch (parseErr) {
      console.error("AI response parse error, raw:", aiText.substring(0, 500));
      throw new Error("Réponse IA invalide");
    }
    
    let parsed;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch {
        parsed = { content: toolCall.function.arguments, checklist: [] };
      }
    } else {
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
    console.error("generate-methodologie error:", error);
    return new Response(JSON.stringify({ error: "Erreur lors de la génération de la méthodologie." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
