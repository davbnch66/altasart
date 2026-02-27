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
    const { devis_id } = await req.json();
    if (!devis_id) throw new Error("devis_id requis");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY non configurée");

    const sb = createClient(supabaseUrl, serviceKey);

    const { data: devis, error: dErr } = await sb
      .from("devis")
      .select("*, clients(name, address, city, postal_code, contact_name), dossiers(title, code, description, address, volume, weight, nature, loading_address, loading_city, delivery_address, delivery_city)")
      .eq("id", devis_id)
      .single();
    if (dErr || !devis) throw new Error("Devis introuvable");

    const { data: lines } = await sb
      .from("devis_lines")
      .select("description, quantity, unit_price")
      .eq("devis_id", devis_id)
      .order("sort_order");

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

    const prompt = `Tu es un expert en rédaction de devis pour la manutention lourde, le levage et le transport exceptionnel.
Génère le contenu descriptif complet d'un devis professionnel. Ce texte remplacera le tableau de lignes de prix détaillées.
Il doit décrire clairement les prestations proposées, les moyens mis en œuvre et les conditions d'intervention, de manière rédigée et professionnelle.

CONTEXTE DU DEVIS:
- Objet: ${devis.objet}
- Montant HT: ${devis.amount}€
- Client: ${client?.name || "—"}
- Contact: ${client?.contact_name || "—"}

${dossier ? `DOSSIER ASSOCIÉ:
- Titre: ${dossier.title || "—"}
- Description: ${dossier.description || "—"}
- Nature: ${dossier.nature || "—"}
- Adresse chargement: ${dossier.loading_address || "—"} ${dossier.loading_city || ""}
- Adresse livraison: ${dossier.delivery_address || "—"} ${dossier.delivery_city || ""}
- Volume: ${dossier.volume || "—"} m³
- Poids: ${dossier.weight || "—"} kg` : ""}

${linesText ? `LIGNES DU DEVIS (pour référence):\n${linesText}` : "Pas de lignes de devis détaillées."}
${visiteContext}

Rédige en HTML simple (utilise <b>, <ul>, <li>, <p> uniquement). Structure le contenu ainsi:
1. Un paragraphe d'introduction décrivant la prestation globale
2. Une liste à puces détaillant les moyens et prestations incluses
3. Un paragraphe sur les conditions particulières si applicable

Le texte doit être professionnel, précis et adapté au secteur de la manutention lourde.
Réponds uniquement avec le HTML, sans balises <html>, <head> ou <body>.`;

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
    console.error("generate-devis-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
