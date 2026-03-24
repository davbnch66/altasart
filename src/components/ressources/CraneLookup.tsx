import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Search, Sparkles, Download, Check, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CraneLookupProps {
  currentBrand?: string;
  currentModel?: string;
  resourceId: string;
  companyId: string;
  onSpecsFetched: (data: Record<string, any>) => void;
  onDocumentSaved?: () => void;
}

interface Suggestion {
  brand: string;
  model: string;
}

export function CraneLookup({
  currentBrand,
  currentModel,
  resourceId,
  companyId,
  onSpecsFetched,
  onDocumentSaved,
}: CraneLookupProps) {
  const [query, setQuery] = useState(currentBrand && currentModel ? `${currentBrand} ${currentModel}` : currentBrand ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState(currentBrand ?? "");
  const [selectedModel, setSelectedModel] = useState(currentModel ?? "");
  const [specsData, setSpecsData] = useState<Record<string, any> | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 1) {
      setSuggestions([]);
      setBrands([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-crane-specs", {
        body: { action: "suggest", query: q },
      });
      if (error) throw error;
      setBrands(data?.brands ?? []);
      setSuggestions(data?.models ?? []);
      setShowDropdown(true);
    } catch (e) {
      console.error("Suggest error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const selectSuggestion = (brand: string, model: string) => {
    setSelectedBrand(brand);
    setSelectedModel(model);
    setQuery(`${brand} ${model}`);
    setShowDropdown(false);
  };

  const selectBrand = (brand: string) => {
    setSelectedBrand(brand);
    setSelectedModel("");
    setQuery(brand + " ");
    // Trigger model suggestions
    setTimeout(() => fetchSuggestions(brand), 100);
  };

  const fetchSpecs = async () => {
    if (!selectedBrand || !selectedModel) {
      toast.error("Sélectionnez une marque et un modèle");
      return;
    }
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-crane-specs", {
        body: { action: "fetch_specs", brand: selectedBrand, model: selectedModel },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erreur");

      const specs = data.data;
      setSpecsData(specs);

      // Map AI response to equipment form fields
      const equipmentData: Record<string, any> = {
        brand: specs.brand ?? selectedBrand,
        model: specs.model ?? selectedModel,
        capacity_tons: specs.capacity_tons ?? specs.max_capacity_tons ?? null,
        reach_meters: specs.max_reach_meters ?? specs.reach_meters ?? null,
        height_meters: specs.max_height_meters ?? specs.height_meters ?? null,
        weight_tons: specs.weight_tons ?? null,
      };

      // Add notes with extra details
      const notesParts: string[] = [];
      if (specs.category) notesParts.push(`Catégorie: ${specs.category}`);
      if (specs.number_of_axles) notesParts.push(`Essieux: ${specs.number_of_axles}`);
      if (specs.engine_power_kw) notesParts.push(`Moteur: ${specs.engine_power_kw} kW${specs.engine_brand ? ` (${specs.engine_brand})` : ""}`);
      if (specs.boom_length_max_m) notesParts.push(`Flèche max: ${specs.boom_length_max_m} m`);
      if (specs.jib_length_max_m) notesParts.push(`Fléchette max: ${specs.jib_length_max_m} m`);
      if (specs.counterweight_tons) notesParts.push(`Contrepoids: ${specs.counterweight_tons} T`);
      if (specs.transport_width_m) notesParts.push(`Transport: ${specs.transport_length_m ?? "?"}×${specs.transport_width_m}×${specs.transport_height_m ?? "?"} m`);
      if (specs.wind_limit_km_h) notesParts.push(`Vent max: ${specs.wind_limit_km_h} km/h`);
      if (specs.load_chart_summary) notesParts.push(`\nCourbe de charge: ${specs.load_chart_summary}`);
      if (specs.notes) notesParts.push(`\n${specs.notes}`);
      if (notesParts.length > 0) equipmentData.notes = notesParts.join("\n");

      onSpecsFetched(equipmentData);
      toast.success(`Fiche technique ${selectedBrand} ${selectedModel} récupérée ! ✨`, { duration: 5000 });
    } catch (e: any) {
      console.error("Fetch specs error:", e);
      toast.error(e.message || "Impossible de récupérer les spécifications");
    } finally {
      setFetching(false);
    }
  };

  const saveAsDocument = async () => {
    if (!specsData) return;
    setSavingDoc(true);
    try {
      // Generate a text-based technical spec document
      const lines: string[] = [
        `FICHE TECHNIQUE — ${specsData.brand ?? selectedBrand} ${specsData.model ?? selectedModel}`,
        `${"=".repeat(60)}`,
        "",
      ];

      if (specsData.category) lines.push(`Catégorie : ${specsData.category}`);
      lines.push("");
      lines.push("CARACTÉRISTIQUES PRINCIPALES");
      lines.push("-".repeat(30));
      if (specsData.capacity_tons) lines.push(`Capacité maximale : ${specsData.capacity_tons} T`);
      if (specsData.max_capacity_tons && specsData.max_capacity_tons !== specsData.capacity_tons) lines.push(`Capacité max absolue : ${specsData.max_capacity_tons} T`);
      if (specsData.reach_meters) lines.push(`Portée : ${specsData.reach_meters} m`);
      if (specsData.max_reach_meters) lines.push(`Portée maximale : ${specsData.max_reach_meters} m`);
      if (specsData.height_meters) lines.push(`Hauteur de levage : ${specsData.height_meters} m`);
      if (specsData.max_height_meters) lines.push(`Hauteur max : ${specsData.max_height_meters} m`);
      if (specsData.weight_tons) lines.push(`Poids total : ${specsData.weight_tons} T`);
      if (specsData.counterweight_tons) lines.push(`Contrepoids : ${specsData.counterweight_tons} T`);
      lines.push("");

      if (specsData.boom_length_min_m || specsData.boom_length_max_m) {
        lines.push("FLÈCHE");
        lines.push("-".repeat(30));
        if (specsData.boom_length_min_m) lines.push(`Longueur min : ${specsData.boom_length_min_m} m`);
        if (specsData.boom_length_max_m) lines.push(`Longueur max : ${specsData.boom_length_max_m} m`);
        if (specsData.jib_length_max_m) lines.push(`Fléchette max : ${specsData.jib_length_max_m} m`);
        lines.push("");
      }

      if (specsData.engine_power_kw || specsData.number_of_axles) {
        lines.push("MOTORISATION & TRANSPORT");
        lines.push("-".repeat(30));
        if (specsData.engine_power_kw) lines.push(`Puissance moteur : ${specsData.engine_power_kw} kW${specsData.engine_brand ? ` (${specsData.engine_brand})` : ""}`);
        if (specsData.max_speed_kmh) lines.push(`Vitesse max : ${specsData.max_speed_kmh} km/h`);
        if (specsData.number_of_axles) lines.push(`Nombre d'essieux : ${specsData.number_of_axles}`);
        if (specsData.transport_length_m) lines.push(`Dimensions transport : ${specsData.transport_length_m} × ${specsData.transport_width_m ?? "?"} × ${specsData.transport_height_m ?? "?"} m`);
        lines.push("");
      }

      if (specsData.wind_limit_km_h || specsData.hoisting_speed_m_min) {
        lines.push("PERFORMANCES");
        lines.push("-".repeat(30));
        if (specsData.hoisting_speed_m_min) lines.push(`Vitesse de levage : ${specsData.hoisting_speed_m_min} m/min`);
        if (specsData.slewing_speed_rpm) lines.push(`Vitesse d'orientation : ${specsData.slewing_speed_rpm} tr/min`);
        if (specsData.min_operating_radius_m) lines.push(`Rayon d'opération min : ${specsData.min_operating_radius_m} m`);
        if (specsData.wind_limit_km_h) lines.push(`Vent max autorisé : ${specsData.wind_limit_km_h} km/h`);
        if (specsData.working_temperature_min_c != null) lines.push(`Plage température : ${specsData.working_temperature_min_c}°C à ${specsData.working_temperature_max_c}°C`);
        lines.push("");
      }

      if (specsData.load_chart_summary) {
        lines.push("COURBE DE CHARGE");
        lines.push("-".repeat(30));
        lines.push(specsData.load_chart_summary);
        lines.push("");
      }

      if (specsData.certifications?.length) {
        lines.push(`Certifications : ${specsData.certifications.join(", ")}`);
      }
      if (specsData.typical_applications?.length) {
        lines.push(`Applications : ${specsData.typical_applications.join(", ")}`);
      }
      if (specsData.notes) {
        lines.push("");
        lines.push("NOTES");
        lines.push("-".repeat(30));
        lines.push(specsData.notes);
      }

      if (specsData.fiche_technique_text) {
        lines.push("");
        lines.push("RÉSUMÉ");
        lines.push("-".repeat(30));
        lines.push(specsData.fiche_technique_text);
      }

      lines.push("");
      lines.push(`Document généré automatiquement par IA — ${new Date().toLocaleDateString("fr-FR")}`);

      const textContent = lines.join("\n");
      const blob = new Blob([textContent], { type: "text/plain" });
      const fileName = `Fiche_technique_${selectedBrand}_${selectedModel.replace(/[/\\]/g, "-")}.txt`;
      const storagePath = `${companyId}/${resourceId}/${Date.now()}_${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("resource-documents")
        .upload(storagePath, blob, { contentType: "text/plain" });
      if (uploadError) throw uploadError;

      // Save document record
      const { error: dbError } = await supabase.from("resource_documents").insert({
        resource_id: resourceId,
        company_id: companyId,
        name: `Fiche technique ${selectedBrand} ${selectedModel}`,
        document_type: "fiche_technique",
        file_name: fileName,
        storage_path: storagePath,
        mime_type: "text/plain",
        ai_extracted: true,
      } as any);
      if (dbError) throw dbError;

      toast.success("Fiche technique sauvegardée dans les documents ! 📄");
      onDocumentSaved?.();
    } catch (e: any) {
      console.error("Save doc error:", e);
      toast.error("Erreur lors de la sauvegarde du document");
    } finally {
      setSavingDoc(false);
    }
  };

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-primary/5 border-primary/20">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <Label className="text-sm font-semibold text-primary">Recherche IA de fiche technique</Label>
      </div>

      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-9 pl-8 pr-8 text-sm"
            placeholder="Tapez une marque ou un modèle (ex: Liebherr LTM 1100)..."
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (query.length >= 1) setShowDropdown(true); }}
          />
          {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {!loading && query.length > 0 && <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />}
        </div>

        {showDropdown && (brands.length > 0 || suggestions.length > 0) && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden">
            <ScrollArea className="max-h-60">
              {/* Brand suggestions */}
              {brands.length > 0 && suggestions.length === 0 && (
                <div className="p-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">Marques</p>
                  {brands.map((b) => (
                    <button
                      key={b}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md flex items-center gap-2"
                      onClick={() => selectBrand(b)}
                    >
                      <span className="font-medium">{b}</span>
                      <span className="text-xs text-muted-foreground">({CRANE_DATABASE_COUNT[b] ?? "?"} modèles)</span>
                    </button>
                  ))}
                </div>
              )}
              {/* Model suggestions */}
              {suggestions.length > 0 && (
                <div className="p-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">Modèles</p>
                  {suggestions.map((s, i) => (
                    <button
                      key={`${s.brand}-${s.model}-${i}`}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md flex items-center gap-2"
                      onClick={() => selectSuggestion(s.brand, s.model)}
                    >
                      <span className="text-muted-foreground text-xs">{s.brand}</span>
                      <span className="font-medium">{s.model}</span>
                      {selectedBrand === s.brand && selectedModel === s.model && (
                        <Check className="h-3.5 w-3.5 text-primary ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Selected model display */}
      {selectedBrand && selectedModel && (
        <div className="flex items-center gap-2 text-sm">
          <Check className="h-3.5 w-3.5 text-success" />
          <span className="text-muted-foreground">Sélection :</span>
          <span className="font-semibold">{selectedBrand} {selectedModel}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={fetchSpecs}
          disabled={fetching || !selectedBrand || !selectedModel}
          className="flex-1"
        >
          {fetching ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Recherche IA en cours...</>
          ) : (
            <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Récupérer la fiche technique</>
          )}
        </Button>
        {specsData && (
          <Button
            size="sm"
            variant="outline"
            onClick={saveAsDocument}
            disabled={savingDoc}
          >
            {savingDoc ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <><Download className="h-3.5 w-3.5 mr-1.5" />Sauvegarder en document</>
            )}
          </Button>
        )}
      </div>

      {/* Specs preview */}
      {specsData && (
        <div className="rounded-md bg-background border p-3 space-y-2 text-xs">
          <p className="font-semibold text-sm">{specsData.brand} {specsData.model}</p>
          {specsData.category && <p className="text-muted-foreground">{specsData.category}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
            {specsData.capacity_tons && <div><span className="text-muted-foreground">Capacité:</span> <strong>{specsData.capacity_tons} T</strong></div>}
            {specsData.max_reach_meters && <div><span className="text-muted-foreground">Portée max:</span> <strong>{specsData.max_reach_meters} m</strong></div>}
            {specsData.max_height_meters && <div><span className="text-muted-foreground">Hauteur max:</span> <strong>{specsData.max_height_meters} m</strong></div>}
            {specsData.weight_tons && <div><span className="text-muted-foreground">Poids:</span> <strong>{specsData.weight_tons} T</strong></div>}
            {specsData.boom_length_max_m && <div><span className="text-muted-foreground">Flèche max:</span> <strong>{specsData.boom_length_max_m} m</strong></div>}
            {specsData.engine_power_kw && <div><span className="text-muted-foreground">Moteur:</span> <strong>{specsData.engine_power_kw} kW</strong></div>}
            {specsData.number_of_axles && <div><span className="text-muted-foreground">Essieux:</span> <strong>{specsData.number_of_axles}</strong></div>}
            {specsData.wind_limit_km_h && <div><span className="text-muted-foreground">Vent max:</span> <strong>{specsData.wind_limit_km_h} km/h</strong></div>}
          </div>
          {specsData.load_chart_summary && (
            <div className="mt-1 pt-1 border-t">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wide mb-0.5">Courbe de charge</p>
              <p className="text-xs">{specsData.load_chart_summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Counts for display
const CRANE_DATABASE_COUNT: Record<string, number> = {
  Liebherr: 35, Manitowoc: 14, Tadano: 18, Terex: 15, Grove: 17,
  Potain: 30, Sany: 12, XCMG: 18, Zoomlion: 15, Kobelco: 8,
  "Link-Belt": 11, Wolffkran: 8, Comansa: 10, Raimondi: 8, Jaso: 11,
  PPM: 3, Demag: 17, Faun: 6,
};
