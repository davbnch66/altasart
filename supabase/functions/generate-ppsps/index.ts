import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { devis_id } = await req.json();
    if (!devis_id) throw new Error("devis_id requis");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch devis with all related data
    const { data: devis, error: devisErr } = await supabase
      .from("devis")
      .select(`
        *, 
        clients(id, name, email, phone, address, city, postal_code, contact_name, siret),
        companies(id, name, short_name, address, phone, email, siret),
        dossiers(id, code, title, address, loading_address, loading_city, loading_postal_code, loading_floor, loading_elevator, loading_access, loading_comments, delivery_address, delivery_city, delivery_postal_code, delivery_floor, delivery_elevator, delivery_access, delivery_comments, volume, weight, start_date, end_date, instructions, description, nature, execution_mode, distance)
      `)
      .eq("id", devis_id)
      .single();
    if (devisErr) throw devisErr;

    // Fetch devis lines
    const { data: lines } = await supabase
      .from("devis_lines")
      .select("description, quantity, unit_price")
      .eq("devis_id", devis_id)
      .order("sort_order");

    // Fetch visite contraintes if visite exists
    let contraintes = null;
    let visiteData = null;
    if (devis.visite_id) {
      const { data: visite } = await supabase
        .from("visites")
        .select("*, visite_contraintes(*)")
        .eq("id", devis.visite_id)
        .single();
      visiteData = visite;
      if (visite?.visite_contraintes && visite.visite_contraintes.length > 0) {
        contraintes = visite.visite_contraintes[0];
      }
    }

    // Fetch materiel from visite if available
    let materiel: any[] = [];
    if (devis.visite_id) {
      const { data: mat } = await supabase
        .from("visite_materiel" as any)
        .select("*")
        .eq("visite_id", devis.visite_id);
      materiel = mat || [];
    }

    const dossier = devis.dossiers;
    const client = devis.clients;
    const company = devis.companies;

    const contextData = JSON.stringify({
      company: { name: company?.name, address: company?.address, phone: company?.phone, email: company?.email, siret: company?.siret },
      client: { name: client?.name, contact_name: client?.contact_name, address: client?.address, city: client?.city, postal_code: client?.postal_code, phone: client?.phone, email: client?.email },
      devis: { code: devis.code, objet: devis.objet, amount: devis.amount, custom_content: devis.custom_content },
      dossier: dossier ? {
        code: dossier.code, title: dossier.title, address: dossier.address,
        loading: { address: dossier.loading_address, city: dossier.loading_city, postal_code: dossier.loading_postal_code, floor: dossier.loading_floor, elevator: dossier.loading_elevator, access: dossier.loading_access, comments: dossier.loading_comments },
        delivery: { address: dossier.delivery_address, city: dossier.delivery_city, postal_code: dossier.delivery_postal_code, floor: dossier.delivery_floor, elevator: dossier.delivery_elevator, access: dossier.delivery_access, comments: dossier.delivery_comments },
        volume: dossier.volume, weight: dossier.weight, start_date: dossier.start_date, end_date: dossier.end_date,
        instructions: dossier.instructions, description: dossier.description, nature: dossier.nature, execution_mode: dossier.execution_mode, distance: dossier.distance,
      } : null,
      lines: lines?.map(l => ({ description: l.description, quantity: l.quantity, unit_price: l.unit_price })),
      contraintes: contraintes ? { door_width: contraintes.door_width, stairs: contraintes.stairs, freight_elevator: contraintes.freight_elevator, ramp: contraintes.ramp, obstacles: contraintes.obstacles, authorizations: contraintes.authorizations, notes: contraintes.notes } : null,
      materiel: materiel.map((m: any) => ({ designation: m.designation, quantity: m.quantity, dimensions: m.dimensions, weight: m.weight, fragility: m.fragility, notes: m.notes })),
    }, null, 2);

    const systemPrompt = `Tu es un ingénieur sécurité expert en manutention lourde, levage et transport exceptionnel pour la société ART LEVAGE (SARL, 30 rue Marbeuf 75008 Paris, Entrepôt : 12-14 rue Jean Monnet 95190 Goussainville, Tél: 01 43 87 04 83, Fax: 01 39 88 80 16, SIRET 490 553 393 00037, APE 4941B, TVA FR 534 905 533 93).

Tu génères des PPSPS (Plan Particulier de Sécurité et de Protection de la Santé) conformes aux exigences des plus grandes entreprises (Bouygues, Engie, Axima, Vinci) et à la réglementation française.

Le PPSPS doit être TRÈS détaillé et exhaustif, avec les sections suivantes :

1. **RENSEIGNEMENTS GÉNÉRAUX** : Informations de l'entreprise ART LEVAGE, adresse du chantier, donneur d'ordre, responsable
2. **INTERVENANTS** : Liste des intervenants (MOA, MOE, architecte si connus)
3. **AUTORITÉS COMPÉTENTES** : Inspection du travail, CRAMIF, OPPBTP, Médecine du travail (PREVLINK 13 rue de l'Escouvrier 95200 Sarcelles)
4. **ORGANISATION DES SECOURS** : Premiers secours, consignes accidents, droit de retrait, numéros d'urgence (avec hôpital le plus proche du chantier)
5. **VISITE MÉDICALE** : Obligations réglementaires
6. **MESURES SPÉCIFIQUES** : EPI, consignes chantier, adaptation environnement
7. **HORAIRES** : Planning prévisionnel
8. **HABILITATIONS** : EPI obligatoires, CACES, autorisations de conduite
9. **DESCRIPTION DE L'OPÉRATION** : Détail des marchandises, dimensions, poids
10. **MODE OPÉRATOIRE** : Phases détaillées (réception dépôt, transport, mise en place)
11. **MÉTHODOLOGIE DE MANUTENTION** : Principe général, organisation logistique, étapes détaillées
12. **PLANNING PRÉVISIONNEL** : Durée, dates, horaires
13. **MOYENS HUMAINS** : Nombre de personnes, qualifications
14. **MOYENS MATÉRIELS** : Tableau avec matériels, vérifications, dates contrôle, risques
15. **PRÉREQUIS CLIENT** : Ce que le client doit préparer avant intervention
16. **ANALYSE DES RISQUES** : Tableau complet risques/situations dangereuses/mesures de prévention incluant :
    - Circulation/co-activité, chute de hauteur, chute de plain-pied, chute d'objets, manutention manuelle, levage mécanique, bruit, conditions météo, risque électrique, incendie, produits dangereux, risque routier
17. **ANNEXES** : Protocole en cas d'alerte, protocole incendie, protocole déversement dangereux

Adapte le contenu aux spécificités du chantier (type de matériel, accès, contraintes, étages, monte-charge, etc.).
Pour les champs "À DÉFINIR", laisse des placeholders que l'utilisateur pourra remplir.`;

    const userPrompt = `Génère un PPSPS complet et professionnel pour le chantier suivant. Voici toutes les données disponibles :

${contextData}

Retourne le contenu structuré en utilisant la fonction tool fournie.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_ppsps",
            description: "Génère un PPSPS structuré complet",
            parameters: {
              type: "object",
              properties: {
                renseignements_generaux: {
                  type: "object",
                  properties: {
                    adresse_chantier: { type: "string" },
                    donneur_ordre: { type: "string" },
                    responsable_siege: { type: "string" },
                    responsable_chantier: { type: "string" },
                    charge_execution: { type: "string" },
                  },
                  required: ["adresse_chantier", "donneur_ordre"],
                },
                intervenants: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      poste: { type: "string" },
                      nom_adresse: { type: "string" },
                      contact: { type: "string" },
                    },
                    required: ["poste"],
                  },
                },
                autorites_competentes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      poste: { type: "string" },
                      adresse: { type: "string" },
                      contact: { type: "string" },
                    },
                    required: ["poste"],
                  },
                },
                organisation_secours: {
                  type: "object",
                  properties: {
                    premiers_secours: { type: "string" },
                    consignes_accidents: { type: "string" },
                    droit_retrait: { type: "string" },
                    numeros_urgence: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          denomination: { type: "string" },
                          adresse: { type: "string" },
                          telephone: { type: "string" },
                        },
                        required: ["denomination", "telephone"],
                      },
                    },
                  },
                },
                visite_medicale: { type: "string" },
                mesures_specifiques: { type: "array", items: { type: "string" } },
                horaires: {
                  type: "object",
                  properties: {
                    jours: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { jour: { type: "string" }, horaire: { type: "string" } },
                        required: ["jour", "horaire"],
                      },
                    },
                  },
                },
                habilitations: { type: "array", items: { type: "string" } },
                description_operation: { type: "string" },
                mode_operatoire: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      phase: { type: "string" },
                      etapes: { type: "array", items: { type: "string" } },
                    },
                    required: ["phase", "etapes"],
                  },
                },
                methodologie: { type: "string" },
                planning: {
                  type: "object",
                  properties: {
                    horaire_travail: { type: "string" },
                    duree_estimee: { type: "string" },
                    date_debut: { type: "string" },
                    date_fin: { type: "string" },
                  },
                },
                moyens_humains: { type: "string" },
                moyens_materiels: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      materiel: { type: "string" },
                      soumis_verification: { type: "string" },
                      date_controle: { type: "string" },
                      date_fin: { type: "string" },
                      risques: { type: "string" },
                    },
                    required: ["materiel"],
                  },
                },
                prerequis_client: { type: "array", items: { type: "string" } },
                analyse_risques: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      situation_dangereuse: { type: "string" },
                      risques: { type: "string" },
                      mesures_prevention: { type: "string" },
                      moyens_protection: { type: "string" },
                    },
                    required: ["situation_dangereuse", "risques", "mesures_prevention"],
                  },
                },
              },
              required: [
                "renseignements_generaux", "autorites_competentes", "organisation_secours",
                "description_operation", "mode_operatoire", "moyens_materiels",
                "prerequis_client", "analyse_risques",
              ],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_ppsps" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erreur de génération IA");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Pas de réponse structurée de l'IA");

    let ppspsContent: any;
    try {
      ppspsContent = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Réponse IA invalide");
    }

    return new Response(JSON.stringify({ content: ppspsContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-ppsps error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
