import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, Download, Users, Package, Wrench } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type ImportType = "clients" | "materiel" | "resources";

const IMPORT_CONFIGS: Record<ImportType, {
  label: string;
  icon: React.ElementType;
  columns: string[];
  required: string[];
  example: string[][];
  table: string;
}> = {
  clients: {
    label: "Clients",
    icon: Users,
    columns: ["name", "email", "phone", "address", "city", "postal_code", "siret", "contact_name", "client_type", "notes"],
    required: ["name"],
    example: [
      ["name", "email", "phone", "address", "city", "postal_code", "siret", "contact_name", "client_type", "notes"],
      ["Dupont SA", "contact@dupont.fr", "01 23 45 67 89", "12 rue de la Paix", "Paris", "75001", "12345678900000", "Jean Dupont", "professionnel", "Client fidèle"],
      ["Martin SAS", "info@martin.fr", "04 56 78 90 12", "5 av des Champs", "Lyon", "69001", "", "Marie Martin", "professionnel", ""],
    ],
    table: "clients",
  },
  materiel: {
    label: "Catalogue matériel",
    icon: Package,
    columns: ["designation", "category", "default_weight", "default_volume", "default_dimensions", "unit_price", "fragility", "handling_notes"],
    required: ["designation"],
    example: [
      ["designation", "category", "default_weight", "default_volume", "default_dimensions", "unit_price", "fragility", "handling_notes"],
      ["Armoire 2 portes", "mobilier", "80", "1.2", "200x60x100", "150", "moyen", "Protéger les portes"],
      ["Carton standard", "carton", "5", "0.06", "60x40x40", "3", "faible", ""],
    ],
    table: "materiel_catalog",
  },
  resources: {
    label: "Ressources (personnel/engins)",
    icon: Wrench,
    columns: ["name", "type", "skills", "notes"],
    required: ["name", "type"],
    example: [
      ["name", "type", "skills", "notes"],
      ["Ahmed Benali", "demenageur", "port charges lourdes;emballage", "CACES 3"],
      ["Grue MK88", "grue_mobile", "levage;manutention lourde", "Capacité 8T"],
    ],
    table: "resources",
  },
};

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((ch === "," || ch === ";") && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

function generateCSV(rows: string[][]): string {
  return rows.map((r) => r.map((c) => (c.includes(",") || c.includes(";") || c.includes('"') ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\n");
}

export function ImportDataTab() {
  const { current, dbCompanies } = useCompany();
  const currentCompanyId = current === "global" ? dbCompanies[0]?.id : current;
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [importType, setImportType] = useState<ImportType>("clients");
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [fileName, setFileName] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const config = IMPORT_CONFIGS[importType];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrors([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        setErrors(["Le fichier doit contenir au moins un en-tête et une ligne de données."]);
        setPreview(null);
        return;
      }
      const headers = parsed[0].map((h) => h.toLowerCase().trim());
      const rows = parsed.slice(1);

      // Validate required columns
      const missing = config.required.filter((r) => !headers.includes(r));
      if (missing.length > 0) {
        setErrors([`Colonnes obligatoires manquantes : ${missing.join(", ")}`]);
        setPreview(null);
        return;
      }
      setPreview({ headers, rows });
    };
    reader.readAsText(file, "UTF-8");
    // Reset input
    if (fileRef.current) fileRef.current.value = "";
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!preview || !currentCompanyId) throw new Error("Données manquantes");

      const { headers, rows } = preview;
      const validRows = rows.filter((r) => r.some((c) => c.trim()));
      
      if (importType === "resources") {
        // Resources need special handling: insert resource + resource_companies link
        let successCount = 0;
        for (const row of validRows) {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => {
            if (row[i]?.trim()) {
              if (h === "skills") {
                obj[h] = row[i].split(";").map((s) => s.trim()).filter(Boolean);
              } else {
                obj[h] = row[i].trim();
              }
            }
          });
          if (!obj.name || !obj.type) continue;
          
          const { data: res, error: resErr } = await supabase
            .from("resources")
            .insert({ name: obj.name, type: obj.type, skills: obj.skills || null, notes: obj.notes || null })
            .select("id")
            .single();
          if (resErr) throw resErr;

          const { error: linkErr } = await supabase
            .from("resource_companies")
            .insert({ resource_id: res.id, company_id: currentCompanyId });
          if (linkErr) throw linkErr;
          successCount++;
        }
        return successCount;
      }

      // Clients or materiel_catalog: batch insert
      const records = validRows.map((row) => {
        const obj: Record<string, any> = { company_id: currentCompanyId };
        headers.forEach((h, i) => {
          if (row[i]?.trim() && config.columns.includes(h)) {
            const val = row[i].trim();
            // Convert numeric fields
            if (["default_weight", "default_volume", "unit_price", "credit_limit"].includes(h)) {
              const num = parseFloat(val.replace(",", "."));
              obj[h] = isNaN(num) ? null : num;
            } else {
              obj[h] = val;
            }
          }
        });
        return obj;
      }).filter((r) => config.required.every((req) => r[req]));

      if (records.length === 0) throw new Error("Aucune ligne valide à importer");

      const { error } = await supabase.from(config.table as any).insert(records as any);
      if (error) throw error;
      return records.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} enregistrement(s) importé(s) avec succès`);
      setPreview(null);
      setFileName("");
      queryClient.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de l'import"),
  });

  const downloadTemplate = () => {
    const csv = generateCSV(config.example);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modele_import_${importType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Importer des données</h2>
          <p className="text-xs text-muted-foreground">
            Importez vos données existantes via un fichier CSV (séparateur virgule ou point-virgule).
          </p>
        </div>

        {/* Type selector */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Select value={importType} onValueChange={(v) => { setImportType(v as ImportType); setPreview(null); setErrors([]); }}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(IMPORT_CONFIGS) as ImportType[]).map((k) => {
                  const c = IMPORT_CONFIGS[k];
                  const Icon = c.icon;
                  return (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {c.label}</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={downloadTemplate}>
            <Download className="h-3.5 w-3.5" /> Télécharger le modèle CSV
          </Button>
        </div>

        {/* Expected columns */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-medium">Colonnes attendues :</p>
          <div className="flex flex-wrap gap-1.5">
            {config.columns.map((col) => (
              <Badge key={col} variant={config.required.includes(col) ? "default" : "outline"} className="text-[10px]">
                {col}{config.required.includes(col) ? " *" : ""}
              </Badge>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">* = obligatoire</p>
        </div>

        {/* File upload */}
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
          <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">{fileName || "Cliquez pour sélectionner un fichier CSV"}</p>
          <p className="text-xs text-muted-foreground mt-1">Format CSV, encodage UTF-8</p>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
            {errors.map((err, i) => (
              <p key={i} className="text-xs text-destructive flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {err}
              </p>
            ))}
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">
                Aperçu : <span className="text-primary">{preview.rows.length} ligne(s)</span>
              </p>
              <Button
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Importer
              </Button>
            </div>
            <div className="overflow-auto max-h-64 rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {preview.headers.map((h, i) => (
                      <th key={i} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 10).map((row, ri) => (
                    <tr key={ri} className="border-t">
                      {preview.headers.map((_, ci) => (
                        <td key={ci} className="px-2 py-1 whitespace-nowrap max-w-[200px] truncate">{row[ci] || ""}</td>
                      ))}
                    </tr>
                  ))}
                  {preview.rows.length > 10 && (
                    <tr className="border-t">
                      <td colSpan={preview.headers.length} className="px-2 py-1.5 text-center text-muted-foreground">
                        … et {preview.rows.length - 10} ligne(s) supplémentaire(s)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
