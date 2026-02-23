import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { imageBase64, mimeType, documentType } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate base64 size (max 10MB)
    const sizeBytes = (imageBase64.length * 3) / 4;
    if (sizeBytes > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Image trop volumineuse (max 10MB)" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate mime type
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (mimeType && !allowedTypes.includes(mimeType)) {
      return new Response(JSON.stringify({ error: "Format d'image non supporté" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const docTypeLabel: Record<string, string> = {
      carte_grise: "carte grise (certificat d'immatriculation) française",
      vgp: "rapport de Vérification Générale Périodique (VGP) de grue ou engin de levage",
      assurance: "attestation ou contrat d'assurance véhicule/engin",
      controle_technique: "procès-verbal de contrôle technique",
      abaque: "abaque ou tableau de charges d'une grue ou engin de levage",
      fiche_technique: "fiche technique constructeur d'un engin ou véhicule",
      autre: "document technique de véhicule ou d'engin",
    };

    const label = docTypeLabel[documentType ?? "autre"] ?? docTypeLabel.autre;

    const systemPrompt = `Tu es un expert en flotte d'entreprise et en engins de levage (grues, chariots, nacelles) spécialisé dans l'analyse de documents techniques français du secteur BTP/levage.
Tu extrais les informations clés de documents scannés ou photographiés avec précision.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans explication.`;

    const userPrompt = `Analyse ce ${label} et extrais toutes les informations pertinentes pour une fiche technique engin/véhicule.

Retourne un JSON avec ces champs (laisse null si non trouvé, ne devine pas) :
{
  "registration": "Immatriculation du véhicule (format AA-123-AA ou ancien)",
  "brand": "Marque du véhicule ou de l'engin (ex: Liebherr, Renault, Grove)",
  "model": "Modèle précis (ex: LTM 1100-5.2, Trafic 2.0 dCi)",
  "serial_number": "Numéro de série ou VIN",
  "year_manufacture": 2018,
  "capacity_tons": 25.5,
  "reach_meters": 52.0,
  "height_meters": 18.5,
  "weight_tons": 48.0,
  "insurance_expiry": "YYYY-MM-DD",
  "insurance_policy": "Numéro de police d'assurance",
  "technical_control_expiry": "YYYY-MM-DD",
  "vgp_expiry": "YYYY-MM-DD (date de la prochaine VGP obligatoire)",
  "vgp_frequency_months": 12,
  "next_maintenance_date": "YYYY-MM-DD",
  "daily_rate": null,
  "document_name": "Nom descriptif du document (ex: Carte grise - Renault Trafic AA-123-AA)",
  "document_expires_at": "YYYY-MM-DD (si le document lui-même a une date d'expiration)",
  "extracted_fields_confidence": "high, medium ou low",
  "notes": "Toute autre information pertinente (limitations de charges, conditions d'utilisation, observations)"
}`;

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
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType ?? "image/jpeg"};base64,${imageBase64}` },
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez dans quelques instants." }), { status: 429, headers: corsHeaders });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants pour l'analyse IA." }), { status: 402, headers: corsHeaders });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur IA" }), { status: 500, headers: corsHeaders });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "{}";

    let extracted: Record<string, unknown> = {};
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      extracted = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      extracted = { notes: content };
    }

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-equipment-document error:", e);
    return new Response(JSON.stringify({ error: "Une erreur est survenue lors de l'analyse." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
