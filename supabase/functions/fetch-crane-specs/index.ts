import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Known crane manufacturers and popular models for autocomplete suggestions
const CRANE_DATABASE: Record<string, string[]> = {
  "Liebherr": ["LTM 1030-2.1", "LTM 1040-2.1", "LTM 1055-3.2", "LTM 1060-3.1", "LTM 1070-4.2", "LTM 1090-4.2", "LTM 1100-5.2", "LTM 1110-5.1", "LTM 1120-5.1", "LTM 1130-5.1", "LTM 1150-5.3", "LTM 1200-5.1", "LTM 1230-5.1", "LTM 1300-6.2", "LTM 1450-8.1", "LTM 1500-8.1", "LTM 1750-9.1", "LTM 11200-9.1", "LTF 1035-3.1", "LTF 1045-4.1", "MK 73-3.1", "MK 88-4.1", "MK 110", "MK 140", "81 K.1", "85 EC-B", "112 EC-H", "125 EC-B", "150 EC-B", "172 EC-B", "200 EC-B", "280 EC-H", "340 EC-B", "357 HC-L", "542 HC-L", "710 HC-L"],
  "Manitowoc": ["GMK 3050-2", "GMK 3060L", "GMK 4080-2", "GMK 4100L-1", "GMK 5120L", "GMK 5150L", "GMK 5180-1", "GMK 5200-1", "GMK 5250L", "GMK 6300L", "GMK 6400", "MLC165", "MLC300", "MLC650"],
  "Tadano": ["ATF 40G-2", "ATF 60G-3", "ATF 70G-4", "ATF 100G-4", "ATF 110G-5", "ATF 130G-5", "ATF 160G-5", "ATF 220G-5", "ATF 400G-6", "ATF 600G-8", "GR-150XL", "GR-250N", "GR-350XL", "GR-500EX", "GR-800EX", "GR-1000XL", "GR-1200XL", "GR-1600XL"],
  "Terex": ["AC 40/2L", "AC 55-1", "AC 60-3", "AC 100/4L", "AC 200-1", "AC 250-1", "AC 350/6", "AC 500-2", "AC 700", "CTT 91", "CTT 161", "CTT 202", "CTT 332", "CTT 472", "Superlift 3800"],
  "Grove": ["GMK3050-2", "GMK3060L-1", "GMK4080-2", "GMK4100L-1", "GMK5120L", "GMK5150L", "GMK5180-1", "GMK5200-1", "GMK5250L", "GMK6300L-1", "GHC 55", "GHC 75", "GHC 130", "RT550E", "RT770E", "RT9130E-2", "GRT8100-1"],
  "Potain": ["Igo 13", "Igo 36", "Igo 50", "Igo T 99", "Igo T 130", "IGO T 85 A", "Hup 32-27", "Hup 40-30", "MCR 160", "MCR 295", "MCT 88", "MCT 135", "MCT 185", "MCT 205", "MCT 275", "MCT 325", "MCT 390", "MC 175 B", "MC 235 B", "MC 310 K", "MD 365 B", "MD 485 B", "MD 560 B", "MDT 178", "MDT 219", "MDT 249", "MDT 319", "MDT 389", "MR 295", "MR 418"],
  "Sany": ["STC250", "STC500", "STC750", "STC1000", "SCC500E", "SCC750E", "SCC1000E", "SCC2000E", "SCC4000E", "SCM T7018-10", "SCM T7020-12", "SCM T7525-12"],
  "XCMG": ["QY25K5-I", "QY50KA", "QY70KH", "QY100K-I", "QY130K-I", "QAY220", "QAY300", "QAY500", "QAY800", "QAY1200", "XCA60E", "XCA100E", "XCA130L8", "XCA220", "XCA300", "XCA450", "XCA550", "XCA1200"],
  "Zoomlion": ["QY25V", "QY50V", "QY70V", "QY100V", "QY130H", "QAY220", "QAY300", "QAY500", "QAY800", "ZTT126", "ZTT186", "ZTT226", "ZTT276", "ZTT466", "ZTT546"],
  "Kobelco": ["CK800G-2", "CK1000G-2", "CK1100G-2", "CK1600G-2", "CK2500G-2", "CK2750G-2", "SL4500G-2", "SL6000G"],
  "Link-Belt": ["75 RT", "100 RT", "120 RT", "175 AT", "250 AT", "TCC-750", "TCC-1100", "TCC-1400", "HTC-8675", "HTC-86100", "HTC-86110"],
  "Wolffkran": ["133 B", "166 B", "224 B", "275 B", "355 B", "500 B", "700 B", "1250 B"],
  "Comansa": ["11LC150", "16LC185", "21LC290", "21LC450", "21LC550", "21LC660", "21LC750", "21LC1050", "LCL310", "LCL340"],
  "Raimondi": ["MRT111", "MRT144", "MRT159", "MRT189", "MRT204", "MRT234", "MRT294", "MRT354"],
  "Jaso": ["J168", "J198", "J228", "J268", "J308", "J368", "J5010", "J5510", "J6018", "J6520", "J7027"],
  "Klaas": ["K900 RSX", "K1003 RSX", "K1100 RSX", "K1300 RSX", "K17/24 TSR", "K20/30 TSR", "K21/28 TSR", "K25/34 TSR", "K28/36 TSR", "K31/36 TSR", "K750 RS", "K850 RS"],
  "Maeda": ["MC104C", "MC174C", "MC285C", "MC305C", "MC405C", "LC383", "LC785", "LC1385", "LC1385M-8", "CC423S", "CC985S", "CC1485"],
  "Unic": ["URW-094", "URW-095", "URW-295", "URW-376", "URW-506", "URW-547", "URW-706", "URW-1006"],
  "BG Lift": ["M060", "M080", "M120", "M150", "M210", "M250", "CWE315", "CWE525", "CWE635", "CWE945"],
  "Jekko": ["SPX312", "SPX424", "SPX532", "SPX650", "SPX1040", "SPX1275", "SPX1280", "JF235", "JF365", "JF545"],
  "Reedyk": ["C3210", "C3410", "C3412", "C4210", "C4412"],
  "Palazzani": ["TSJ 18.1", "TSJ 23.1", "TSJ 30.1", "TSJ 35.1", "XTJ 32+", "XTJ 42+", "XTJ 52+"],
  "PPM": ["ATT 400", "ATT 600", "ATT 900"],
  "Demag": ["AC 40-2", "AC 45", "AC 55-3", "AC 60-3", "AC 80-2", "AC 100-4", "AC 130-5", "AC 160-5", "AC 220-5", "AC 250-5", "AC 300-6", "AC 350-6", "AC 500-2", "AC 700", "CC 2800-1", "CC 3800-1", "CC 8800-1"],
  "Faun": ["ATF 45-3", "ATF 60-4", "ATF 70G-4", "ATF 100G-4", "ATF 110G-5", "RTF 40-3"],
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
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { action, brand, model, query } = await req.json();

    // === ACTION: SUGGEST — return brand/model suggestions ===
    if (action === "suggest") {
      const q = (query ?? "").toLowerCase().trim();
      if (!q || q.length < 1) {
        // Return all brands
        const brands = Object.keys(CRANE_DATABASE).sort();
        return new Response(JSON.stringify({ brands, models: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Filter brands
      const matchingBrands = Object.keys(CRANE_DATABASE).filter(b => b.toLowerCase().includes(q)).sort();

      // If exact brand match, also suggest models
      const exactBrand = Object.keys(CRANE_DATABASE).find(b => b.toLowerCase() === q);
      const models = exactBrand ? CRANE_DATABASE[exactBrand] : [];

      // If query contains a space, try brand + model matching
      const parts = q.split(/\s+/);
      if (parts.length >= 2) {
        const brandPart = parts[0];
        const modelPart = parts.slice(1).join(" ");
        const matchedBrand = Object.keys(CRANE_DATABASE).find(b => b.toLowerCase().startsWith(brandPart));
        if (matchedBrand) {
          const filteredModels = CRANE_DATABASE[matchedBrand].filter(m => m.toLowerCase().includes(modelPart));
          return new Response(JSON.stringify({
            brands: [matchedBrand],
            models: filteredModels.map(m => ({ brand: matchedBrand, model: m })),
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // Also search in models across all brands
      const modelResults: { brand: string; model: string }[] = [];
      for (const [b, ms] of Object.entries(CRANE_DATABASE)) {
        for (const m of ms) {
          if (m.toLowerCase().includes(q) || `${b} ${m}`.toLowerCase().includes(q)) {
            modelResults.push({ brand: b, model: m });
          }
        }
      }

      return new Response(JSON.stringify({
        brands: matchingBrands,
        models: modelResults.slice(0, 15),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === ACTION: FETCH_SPECS — AI-powered spec lookup ===
    if (action === "fetch_specs") {
      if (!brand || !model) {
        return new Response(JSON.stringify({ error: "brand et model requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const systemPrompt = `Tu es un expert en grues et engins de levage pour le secteur BTP en France.
Tu connais les spécifications techniques de toutes les marques majeures de grues (Liebherr, Potain, Manitowoc, Tadano, Terex, Grove, Sany, XCMG, etc.).
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans explication.
Sois précis sur les données techniques. Si tu n'es pas sûr d'une valeur, mets null.`;

      const userPrompt = `Donne-moi la fiche technique complète de la grue ${brand} ${model}.

Retourne un JSON avec ces champs (null si inconnu) :
{
  "brand": "${brand}",
  "model": "${model}",
  "category": "grue mobile | grue à tour | grue sur chenilles | grue auxiliaire | mini-grue | autre",
  "capacity_tons": 100,
  "max_capacity_tons": 120,
  "reach_meters": 52,
  "max_reach_meters": 60,
  "height_meters": 70,
  "max_height_meters": 82,
  "weight_tons": 48,
  "counterweight_tons": 38,
  "boom_length_min_m": 11.5,
  "boom_length_max_m": 52,
  "jib_length_max_m": 19,
  "number_of_axles": 5,
  "engine_power_kw": 270,
  "engine_brand": "Liebherr",
  "max_speed_kmh": 80,
  "year_first_production": 2015,
  "year_last_production": null,
  "transport_width_m": 2.75,
  "transport_height_m": 3.95,
  "transport_length_m": 14.6,
  "min_operating_radius_m": 3,
  "slewing_speed_rpm": 1.2,
  "hoisting_speed_m_min": 120,
  "wind_limit_km_h": 72,
  "working_temperature_min_c": -20,
  "working_temperature_max_c": 45,
  "certifications": ["CE", "EN 13000"],
  "typical_applications": ["Levage industriel", "Construction", "Éolien"],
  "load_chart_summary": "Description textuelle de la courbe de charge principale (par ex: 100T à 3m, 60T à 12m, 20T à 40m)",
  "notes": "Toute information complémentaire utile (versions, variantes, points d'attention)",
  "fiche_technique_text": "Résumé complet de la fiche technique en format texte structuré (2-3 paragraphes) pour archivage en document PDF"
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
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez." }), { status: 429, headers: corsHeaders });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), { status: 402, headers: corsHeaders });
        }
        const t = await response.text();
        console.error("AI error:", response.status, t);
        return new Response(JSON.stringify({ error: "Erreur IA" }), { status: 500, headers: corsHeaders });
      }

      const aiResult = await response.json();
      const content = aiResult.choices?.[0]?.message?.content ?? "{}";

      let specs: Record<string, unknown> = {};
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        specs = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse AI response:", content);
        specs = { notes: content, brand, model };
      }

      return new Response(JSON.stringify({ success: true, data: specs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ACTION: EXTRACT_FROM_CONTENT — Extract specs from scraped markdown ===
    if (action === "extract_from_content") {
      const { content: rawContent } = await req.json().catch(() => ({}));
      const contentText = rawContent ?? (await req.text());
      
      if (!brand || !model) {
        return new Response(JSON.stringify({ error: "brand et model requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const extractPrompt = `Analyse ce contenu de fiche technique pour la grue ${brand} ${model} et extrais les données techniques.

CONTENU :
${(contentText || "").substring(0, 8000)}

Retourne UNIQUEMENT un JSON valide avec ces champs (null si non trouvé dans le texte) :
{
  "brand": "${brand}",
  "model": "${model}",
  "category": "grue mobile | grue à tour | grue sur chenilles | grue auxiliaire | mini-grue | grue araignée | autre",
  "capacity_tons": null,
  "max_capacity_tons": null,
  "reach_meters": null,
  "max_reach_meters": null,
  "height_meters": null,
  "max_height_meters": null,
  "weight_tons": null,
  "counterweight_tons": null,
  "boom_length_max_m": null,
  "jib_length_max_m": null,
  "number_of_axles": null,
  "engine_power_kw": null,
  "transport_width_m": null,
  "transport_height_m": null,
  "transport_length_m": null,
  "load_chart_summary": null,
  "notes": null
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
            { role: "system", content: "Tu es un expert en grues BTP. Extrais les données techniques du contenu fourni. Réponds UNIQUEMENT en JSON valide." },
            { role: "user", content: extractPrompt },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("AI extract error:", response.status, t);
        return new Response(JSON.stringify({ error: "Erreur IA extraction" }), { status: 500, headers: corsHeaders });
      }

      const aiResult = await response.json();
      const aiContent = aiResult.choices?.[0]?.message?.content ?? "{}";
      let specs: Record<string, unknown> = {};
      try {
        const cleaned = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        specs = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse AI extraction:", aiContent);
        specs = { notes: aiContent, brand, model };
      }

      return new Response(JSON.stringify({ success: true, data: specs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action invalide. Utilisez 'suggest', 'fetch_specs' ou 'extract_from_content'." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("fetch-crane-specs error:", e);
    return new Response(JSON.stringify({ error: "Une erreur est survenue." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
