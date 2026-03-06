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

    const { visite_id } = await req.json();
    if (!visite_id) throw new Error("visite_id requis");

    // Verify the user has access to this visite via RLS
    const { data: accessCheck, error: accessErr } = await authClient
      .from("visites")
      .select("id")
      .eq("id", visite_id)
      .maybeSingle();
    if (accessErr || !accessCheck) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for full data fetch (already verified access above)
    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch visite with relations
    const { data: visite, error: vErr } = await sb
      .from("visites")
      .select("*, clients(name, address, city, postal_code, email, phone), dossiers:dossier_id(title, code, description, address, volume, weight, nature, loading_address, loading_city, delivery_address, delivery_city)")
      .eq("id", visite_id)
      .single();
    if (vErr || !visite) throw new Error("Visite introuvable");

    // Fetch materiel items
    const { data: materiel } = await sb
      .from("visite_materiel")
      .select("designation, quantity, weight, volume, dimensions, category, fragility, handling_notes")
      .eq("visite_id", visite_id);

    // Fetch visite vehicles
    const { data: vehicules } = await sb
      .from("visite_vehicules")
      .select("type, name, quantity, notes")
      .eq("visite_id", visite_id);

    // Fetch visite RH
    const { data: rh } = await sb
      .from("visite_rh")
      .select("role, quantity, duration_hours, notes")
      .eq("visite_id", visite_id);

    const client = visite.clients as any;
    const dossier = visite.dossiers as any;

    const materielText = (materiel || [])
      .map((m: any) => `- ${m.designation} x${m.quantity}${m.weight ? ` (${m.weight}kg)` : ""}${m.fragility ? ` [${m.fragility}]` : ""}${m.handling_notes ? ` — ${m.handling_notes}` : ""}`)
      .join("\n");

    const vehiculesText = (vehicules || [])
      .map((v: any) => `- ${v.type}: ${v.name || "—"} x${v.quantity}${v.notes ? ` — ${v.notes}` : ""}`)
      .join("\n");

    const rhText = (rh || [])
      .map((r: any) => `- ${r.role} x${r.quantity}${r.duration_hours ? ` (${r.duration_hours}h)` : ""}${r.notes ? ` — ${r.notes}` : ""}`)
      .join("\n");

    const prompt = `Tu es un assistant spécialisé dans la manutention lourde, le levage et le transport exceptionnel.
Génère un mémo / description détaillée pour préparer un devis à partir de cette visite technique. Le mémo doit résumer la prestation à chiffrer, les points d'attention et les conditions particulières.

VISITE TECHNIQUE:
- Titre: ${visite.title || "—"}
- Adresse: ${visite.address || "—"}
- Client: ${client?.name || "—"} (${client?.address || ""} ${client?.postal_code || ""} ${client?.city || ""})
- Notes visite: ${visite.notes || "—"}
- Commentaire: ${visite.comment || "—"}
- Instructions: ${visite.instructions || "—"}

CONTRAINTES:
- Accès: ${visite.contraintes_acces || "—"}
- Sol: ${visite.contraintes_sol || "—"}
- Gabarit: ${visite.contraintes_gabarit || "—"}

MÉTHODOLOGIE:
${visite.methodologie || "Non définie"}

${dossier ? `DOSSIER ASSOCIÉ:
- Titre: ${dossier.title || "—"}
- Description: ${dossier.description || "—"}
- Nature: ${dossier.nature || "—"}
- Chargement: ${dossier.loading_address || "—"} ${dossier.loading_city || ""}
- Livraison: ${dossier.delivery_address || "—"} ${dossier.delivery_city || ""}
- Volume: ${dossier.volume || "—"} m³ / Poids: ${dossier.weight || "—"} kg` : ""}

${materielText ? `MATÉRIEL INVENTORIÉ:\n${materielText}` : "Pas de matériel inventorié."}

${vehiculesText ? `VÉHICULES / ENGINS:\n${vehiculesText}` : "Pas de véhicules définis."}

${rhText ? `RESSOURCES HUMAINES:\n${rhText}` : "Pas de RH définie."}

Rédige un mémo concis (200-400 mots max) en français, structuré avec des tirets. Inclus:
1. Résumé de la prestation à chiffrer
2. Détail du matériel et moyens nécessaires
3. Points d'attention / risques identifiés
4. Conditions ou réserves éventuelles

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
    console.error("generate-visite-memo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
