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
    // Authenticate the caller
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

    // Verify JWT and get user
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { devis_id } = await req.json();
    if (!devis_id) throw new Error("devis_id requis");

    // Verify the user has access to this devis via RLS
    const { data: accessCheck, error: accessErr } = await authClient
      .from("devis")
      .select("id")
      .eq("id", devis_id)
      .maybeSingle();
    if (accessErr || !accessCheck) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for full data fetch (already verified access above)
    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch devis with relations
    const { data: devis, error: dErr } = await sb
      .from("devis")
      .select("*, clients(name, address, city, postal_code), dossiers(title, code, description, address, volume, weight, nature, loading_address, loading_city, delivery_address, delivery_city)")
      .eq("id", devis_id)
      .single();
    if (dErr || !devis) throw new Error("Devis introuvable");

    // Fetch devis lines
    const { data: lines } = await sb
      .from("devis_lines")
      .select("description, quantity, unit_price")
      .eq("devis_id", devis_id)
      .order("sort_order");

    // Fetch linked visite if any
    let visiteContext = "";
    if (devis.visite_id) {
      const { data: visite } = await sb
        .from("visites")
        .select("title, notes, contraintes_acces, contraintes_sol, contraintes_gabarit, methodologie")
        .eq("id", devis.visite_id)
        .single();
      if (visite) {
        visiteContext = `
VISITE TECHNIQUE ASSOCIÉE:
- Titre: ${visite.title || "—"}
- Notes: ${visite.notes || "—"}
- Contraintes accès: ${visite.contraintes_acces || "—"}
- Contraintes sol: ${visite.contraintes_sol || "—"}
- Contraintes gabarit: ${visite.contraintes_gabarit || "—"}
- Méthodologie: ${visite.methodologie || "—"}`;
      }
    }

    const client = devis.clients as any;
    const dossier = devis.dossiers as any;
    const linesText = (lines || [])
      .map((l: any) => `- ${l.description} (x${l.quantity} à ${l.unit_price}€)`)
      .join("\n");

    const prompt = `Tu es un assistant spécialisé dans la manutention lourde, le levage et le transport exceptionnel.
Génère un mémo / notes internes professionnelles pour ce devis. Le mémo doit résumer les points clés de la prestation, les points d'attention et les conditions particulières.

CONTEXTE DU DEVIS:
- Objet: ${devis.objet}
- Montant HT: ${devis.amount}€
- Client: ${client?.name || "—"}
- Adresse client: ${client?.address || "—"} ${client?.postal_code || ""} ${client?.city || ""}

${dossier ? `DOSSIER ASSOCIÉ:
- Titre: ${dossier.title || "—"}
- Description: ${dossier.description || "—"}
- Nature: ${dossier.nature || "—"}
- Adresse chargement: ${dossier.loading_address || "—"} ${dossier.loading_city || ""}
- Adresse livraison: ${dossier.delivery_address || "—"} ${dossier.delivery_city || ""}
- Volume: ${dossier.volume || "—"} m³
- Poids: ${dossier.weight || "—"} kg` : ""}

${linesText ? `LIGNES DU DEVIS:\n${linesText}` : "Pas de lignes de devis détaillées."}
${visiteContext}

Rédige un mémo concis (150-300 mots max) en français, structuré avec des tirets. Inclus:
1. Résumé de la prestation
2. Points d'attention / risques identifiés
3. Conditions ou réserves éventuelles

Réponds uniquement avec le texte du mémo, sans titre ni introduction.`;

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
    const memo = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ memo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-devis-memo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
