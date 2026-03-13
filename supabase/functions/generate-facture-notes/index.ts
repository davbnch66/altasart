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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    const { dossier_id, operation_id, client_id, amount } = await req.json();
    if (!dossier_id && !operation_id) throw new Error("dossier_id ou operation_id requis");

    // Verify access
    if (dossier_id) {
      const { data: check } = await authClient.from("dossiers").select("id").eq("id", dossier_id).maybeSingle();
      if (!check) return new Response(JSON.stringify({ error: "Accès refusé" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // Gather all context
    let dossierCtx = "";
    let operationCtx = "";
    let clientCtx = "";
    let devisCtx = "";

    // Dossier
    const targetDossierId = dossier_id;
    if (targetDossierId) {
      const { data: dossier } = await sb.from("dossiers").select("title, code, description, nature, address, volume, weight, loading_address, loading_city, loading_postal_code, delivery_address, delivery_city, delivery_postal_code, distance, execution_mode, instructions").eq("id", targetDossierId).single();
      if (dossier) {
        dossierCtx = `
DOSSIER:
- Titre: ${dossier.title || "—"}
- Code: ${dossier.code || "—"}
- Description: ${dossier.description || "—"}
- Nature: ${dossier.nature || "—"}
- Mode d'exécution: ${dossier.execution_mode || "—"}
- Chargement: ${[dossier.loading_address, dossier.loading_postal_code, dossier.loading_city].filter(Boolean).join(", ") || "—"}
- Livraison: ${[dossier.delivery_address, dossier.delivery_postal_code, dossier.delivery_city].filter(Boolean).join(", ") || "—"}
- Volume: ${dossier.volume || "—"} m³, Poids: ${dossier.weight || "—"} kg
- Distance: ${dossier.distance || "—"} km
- Consignes: ${dossier.instructions || "—"}`;
      }

      // Accepted devis for this dossier
      const { data: devisList } = await sb.from("devis").select("objet, code, amount, notes, custom_content").eq("dossier_id", targetDossierId).eq("status", "accepte");
      if (devisList && devisList.length > 0) {
        const devisLines = [];
        for (const d of devisList) {
          const { data: lines } = await sb.from("devis_lines").select("description, quantity, unit_price, tva_rate").eq("devis_id", d.id).order("sort_order");
          devisLines.push({ ...d, lines: lines || [] });
        }
        devisCtx = `
DEVIS ACCEPTÉ(S):
${devisLines.map(d => `- ${d.code || d.objet}: ${d.amount}€ HT
  Lignes: ${d.lines.map((l: any) => `${l.description} (x${l.quantity} @ ${l.unit_price}€, TVA ${l.tva_rate}%)`).join("; ") || "aucune"}
  ${d.custom_content ? `Contenu personnalisé: ${d.custom_content.substring(0, 500)}` : ""}
  ${d.notes ? `Notes: ${d.notes}` : ""}`).join("\n")}`;
      }
    }

    // Operation
    if (operation_id) {
      const { data: op } = await sb.from("operations").select("*").eq("id", operation_id).single();
      if (op) {
        operationCtx = `
OPÉRATION RÉALISÉE:
- Type: ${op.type}, N° BT: ${op.lv_bt_number || "—"}, Op. ${op.operation_number}
- Chargement: ${[op.loading_address, op.loading_postal_code, op.loading_city].filter(Boolean).join(", ") || "—"} le ${op.loading_date || "—"} ${op.loading_time_start ? `de ${op.loading_time_start}` : ""} ${op.loading_time_end ? `à ${op.loading_time_end}` : ""}
  Étage: ${op.loading_floor || "—"}, Portage: ${op.loading_portage || 0}m, Ascenseur: ${op.loading_elevator ? "Oui" : "Non"}, Monte-meubles: ${op.loading_monte_meubles ? "Oui" : "Non"}, Passage fenêtre: ${op.loading_passage_fenetre ? "Oui" : "Non"}
- Livraison: ${[op.delivery_address, op.delivery_postal_code, op.delivery_city].filter(Boolean).join(", ") || "—"} le ${op.delivery_date || "—"} ${op.delivery_time_start ? `de ${op.delivery_time_start}` : ""} ${op.delivery_time_end ? `à ${op.delivery_time_end}` : ""}
  Étage: ${op.delivery_floor || "—"}, Portage: ${op.delivery_portage || 0}m, Ascenseur: ${op.delivery_elevator ? "Oui" : "Non"}, Monte-meubles: ${op.delivery_monte_meubles ? "Oui" : "Non"}, Passage fenêtre: ${op.delivery_passage_fenetre ? "Oui" : "Non"}
- Volume: ${op.volume || "—"} m³, Poids: ${op.weight || "—"} kg
- Consignes: ${op.instructions || "—"}
- Notes: ${op.notes || "—"}
- Terminée: ${op.completed ? "Oui" : "Non"}`;

        // Resources assigned
        const { data: resources } = await sb.from("operation_resources").select("resources(name, type)").eq("operation_id", operation_id);
        if (resources && resources.length > 0) {
          operationCtx += `\n- Moyens mobilisés: ${resources.map((r: any) => `${r.resources?.name} (${r.resources?.type})`).join(", ")}`;
        }
      }
    }

    // Client
    if (client_id) {
      const { data: client } = await sb.from("clients").select("name, address, city, postal_code, contact_name").eq("id", client_id).single();
      if (client) {
        clientCtx = `
CLIENT:
- Nom: ${client.name}
- Adresse: ${[client.address, client.postal_code, client.city].filter(Boolean).join(", ") || "—"}
- Contact: ${client.contact_name || "—"}`;
      }
    }

    const prompt = `Tu es un expert en facturation pour la manutention lourde, le levage et le transport exceptionnel.

Génère les notes descriptives d'une facture professionnelle basée sur les informations suivantes.
Le texte doit décrire les prestations réalisées de manière claire et facturable.

${clientCtx}
${dossierCtx}
${devisCtx}
${operationCtx}

MONTANT DE LA FACTURE: ${amount || "à déterminer"}€

Rédige un texte structuré en texte brut (pas de HTML) comprenant:
1. Un titre de prestation concis (1 ligne)
2. Un descriptif détaillé des prestations réalisées
3. Les moyens mis en œuvre (personnel, véhicules, engins)
4. Les lieux d'intervention (chargement → livraison)
5. Les conditions particulières si applicable

Le texte doit être professionnel, factuel et adapté au secteur de la manutention lourde / levage.
Ne mets PAS de montants dans le texte, ils sont gérés séparément.
Réponds uniquement avec le texte, sans titre "Notes" ni encadrement.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erreur du service IA");
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-facture-notes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
