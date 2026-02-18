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
      return new Response(JSON.stringify({ error: "imageBase64 required" }), { status: 400, headers: corsHeaders });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const docTypeLabel = {
      identite: "pièce d'identité (CNI ou passeport)",
      contrat: "contrat de travail",
      diplome: "diplôme ou certificat",
      caces: "certificat CACES",
      medical: "certificat médical d'aptitude",
      autre: "document RH",
    }[documentType ?? "autre"] ?? "document RH";

    const systemPrompt = `Tu es un expert RH français spécialisé dans l'analyse de documents d'identité et documents d'entreprise du secteur BTP/levage. 
Tu extrais les informations clés de documents scannés ou photographiés avec précision.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans explication.`;

    const userPrompt = `Analyse ce ${docTypeLabel} et extrais toutes les informations pertinentes pour une fiche RH employé.

Retourne un JSON avec ces champs (laisse null si non trouvé) :
{
  "full_name": "Prénom NOM de la personne",
  "birth_date": "YYYY-MM-DD",
  "nationality": "Nationalité",
  "id_number": "Numéro de la pièce d'identité ou du document",
  "id_expiry": "YYYY-MM-DD (date d'expiration du document)",
  "address": "Adresse complète si présente",
  "job_title": "Poste/fonction si présent",
  "hire_date": "YYYY-MM-DD (date d'embauche si présente)",
  "contract_type": "CDI, CDD, interim, apprentissage ou null",
  "employee_id": "Matricule employé si présent",
  "caces": ["liste des CACES si présents, ex: ['R489 cat.3', 'R386 cat.3B']"],
  "medical_aptitude": "apte, apte_restrictions ou inapte si présent",
  "last_medical_visit": "YYYY-MM-DD si présente",
  "next_medical_visit": "YYYY-MM-DD si présente",
  "document_name": "Nom descriptif du document (ex: CNI - DUPONT Jean)",
  "document_expires_at": "YYYY-MM-DD (si le document lui-même a une expiration)",
  "extracted_fields_confidence": "high, medium ou low",
  "notes": "Toute autre information pertinente non couverte par les champs ci-dessus"
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

    // Parse JSON from AI response
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
    console.error("analyze-hr-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
