import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const visite_id = body.visite_id;

    // Input validation
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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all visit data in parallel
    const [visiteRes, materielRes, rhRes, vehiculesRes, methodoRes, contraintesRes, piecesRes] = await Promise.all([
      supabase.from("visites").select("*, clients(name, code)").eq("id", visite_id).single(),
      supabase.from("visite_materiel").select("*").eq("visite_id", visite_id).order("sort_order"),
      supabase.from("visite_ressources_humaines").select("*").eq("visite_id", visite_id).order("sort_order"),
      supabase.from("visite_vehicules").select("*").eq("visite_id", visite_id).order("sort_order"),
      supabase.from("visite_methodologie").select("*").eq("visite_id", visite_id).limit(1).maybeSingle(),
      supabase.from("visite_contraintes").select("*").eq("visite_id", visite_id).maybeSingle(),
      supabase.from("visite_pieces").select("*").eq("visite_id", visite_id).order("sort_order"),
    ]);

    if (visiteRes.error) throw visiteRes.error;
    const visite = visiteRes.data;
    const materiel = materielRes.data || [];
    const rh = rhRes.data || [];
    const vehicules = vehiculesRes.data || [];
    const methodo = methodoRes.data;
    const contraintes = contraintesRes.data;
    const pieces = piecesRes.data || [];

    // Build context for AI
    const context = `
## Visite technique : ${visite.title}
Client: ${(visite.clients as any)?.name || "N/A"}
Type d'opération: ${visite.operation_type || visite.visit_type || "Non spécifié"}
Nature: ${visite.nature || "Non spécifiée"}
Volume: ${visite.volume || 0} m³
Distance: ${visite.distance || "N/A"} km
Adresse: ${visite.address || "N/A"}

### Pièces/Zones (${pieces.length})
${pieces.map((p: any) => `- ${p.name} (étage: ${p.floor_level || "RDC"}, dimensions: ${p.dimensions || "N/A"})`).join("\n") || "Aucune pièce"}

### Matériel inventorié (${materiel.length} lignes)
${materiel.map((m: any) => `- ${m.quantity}x ${m.designation} (poids: ${m.weight || "N/A"} kg, dimensions: ${m.dimensions || "N/A"})`).join("\n") || "Aucun matériel"}

### Ressources humaines prévues
${rh.map((r: any) => `- ${r.quantity}x ${r.role} (durée: ${r.duration_estimate || "N/A"})`).join("\n") || "Aucune RH"}

### Véhicules et engins
${vehicules.map((v: any) => `- ${v.type}: ${v.label || "N/A"} (capacité: ${v.capacity || "N/A"} T)`).join("\n") || "Aucun véhicule"}

### Contraintes d'accès
${contraintes ? `Escaliers: ${contraintes.stairs || "N/A"}, Monte-charge: ${contraintes.freight_elevator ? "Oui" : "Non"}, Rampe: ${contraintes.ramp ? "Oui" : "Non"}, Largeur porte: ${contraintes.door_width || "N/A"}, Obstacles: ${contraintes.obstacles || "Aucun"}` : "Non renseignées"}

### Méthodologie
${methodo?.content || "Non renseignée"}

### Notes visite
${visite.notes || "Aucune note"}
${visite.comment || ""}
${visite.instructions || ""}
`;

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
            content: `Tu es un expert en chiffrage de déménagement, manutention lourde et levage. 
Tu génères des lignes de devis à partir de données de visite technique.

Règles :
- Génère des lignes de devis réalistes avec description, quantité et prix unitaire HT
- Inclus la main d'œuvre, les véhicules/engins, le matériel de protection, les frais annexes
- Base les tarifs sur les standards du marché français (ex: manutentionnaire ~35€/h, chef d'équipe ~45€/h, grue mobile ~800-1500€/jour)
- Adapte les prix selon le volume, la distance, et les contraintes d'accès
- Si des poids lourds ou des grues sont nécessaires, inclus des lignes spécifiques
- Ajoute des lignes pour les fournitures (couvertures, cartons, film bulle) si pertinent
- Groupe les lignes par catégorie logique

Tu DOIS répondre UNIQUEMENT via l'outil generate_devis_lines.`,
          },
          {
            role: "user",
            content: `Génère les lignes de devis pour cette visite technique:\n${context}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_devis_lines",
              description: "Génère les lignes d'un devis à partir des données de visite",
              parameters: {
                type: "object",
                properties: {
                  objet: { type: "string", description: "Objet du devis" },
                  lines: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        quantity: { type: "number" },
                        unit_price: { type: "number" },
                      },
                      required: ["description", "quantity", "unit_price"],
                      additionalProperties: false,
                    },
                  },
                  notes: { type: "string", description: "Notes complémentaires" },
                },
                required: ["objet", "lines"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_devis_lines" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      throw new Error("Erreur du service IA");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("L'IA n'a pas retourné de données structurées");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      objet: result.objet,
      lines: result.lines,
      notes: result.notes || "",
      visite_title: visite.title,
      client_name: (visite.clients as any)?.name,
      company_id: visite.company_id,
      client_id: visite.client_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-devis error:", e);
    return new Response(JSON.stringify({ error: "Erreur lors de la génération du devis." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
