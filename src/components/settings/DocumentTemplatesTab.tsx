import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { DOCUMENT_TYPES, TEMPLATE_VARIABLES, type DocumentType } from "@/lib/docxTemplateEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, FileText, Trash2, Star, Copy, Info, Loader2, Download, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { downloadSampleTemplate } from "@/lib/generateSampleDocxTemplates";

export function DocumentTemplatesTab() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { current, dbCompanies } = useCompany();
  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];

  const [uploadOpen, setUploadOpen] = useState(false);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentType>("devis");
  const [uploadName, setUploadName] = useState("");
  const [uploadDocType, setUploadDocType] = useState<DocumentType>("devis");
  const [uploadCompany, setUploadCompany] = useState(companyIds[0] || "");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["document-templates", companyIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_templates")
        .select("*, companies(name, short_name)")
        .in("company_id", companyIds)
        .order("document_type")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: async (template: any) => {
      // Delete from storage
      await supabase.storage.from("document-templates").remove([template.storage_path]);
      // Delete from table
      const { error } = await supabase.from("document_templates").delete().eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Modèle supprimé");
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const toggleDefault = useMutation({
    mutationFn: async ({ id, isDefault }: { id: string; isDefault: boolean }) => {
      const { error } = await supabase.from("document_templates").update({ is_default: isDefault }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast.success("Modèle par défaut mis à jour");
    },
  });

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim() || !uploadCompany) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    const ext = uploadFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "docx") {
      toast.error("Seuls les fichiers .docx sont acceptés");
      return;
    }

    if (uploadFile.size > 10 * 1024 * 1024) {
      toast.error("Le fichier ne doit pas dépasser 10 Mo");
      return;
    }

    setUploading(true);
    try {
      const storagePath = `${uploadCompany}/${uploadDocType}/${Date.now()}_${uploadFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("document-templates")
        .upload(storagePath, uploadFile, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("document_templates").insert({
        company_id: uploadCompany,
        name: uploadName.trim(),
        document_type: uploadDocType,
        storage_path: storagePath,
        file_name: uploadFile.name,
        is_default: templates.filter((t: any) => t.company_id === uploadCompany && t.document_type === uploadDocType).length === 0,
      });
      if (insertError) throw insertError;

      toast.success("Modèle ajouté avec succès");
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      setUploadOpen(false);
      setUploadName("");
      setUploadFile(null);
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async (template: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("document-templates")
        .download(template.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = template.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erreur lors du téléchargement");
    }
  };

  const filteredTemplates = templates.filter((t: any) => t.document_type === selectedType);
  const typeLabel = DOCUMENT_TYPES.find((d) => d.value === selectedType)?.label || selectedType;

  const copyVariable = (key: string) => {
    try {
      await navigator.clipboard.writeText(`{{${key}}}`);
      toast.success(`{{${key}}} copié`);
    } catch {
      toast.info("Copie automatique indisponible dans ce navigateur.");
    }
  };

  const handleGenerateSample = async () => {
    setGeneratingTemplate(true);
    try {
      // Use current company short_name for logo embedding
      const companyShortName = current !== "global"
        ? dbCompanies.find((c) => c.id === current)?.shortName
        : dbCompanies[0]?.shortName;
      await downloadSampleTemplate(selectedType, companyShortName);
      toast.success(`Modèle Word "${typeLabel}" téléchargé avec logo`);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la génération");
    } finally {
      setGeneratingTemplate(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold">Modèles de documents Word</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Importez des fichiers .docx avec des variables dynamiques pour générer vos documents.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setVariablesOpen(true)}>
              <Info className="h-3.5 w-3.5" /> Variables
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleGenerateSample} disabled={generatingTemplate}>
              {generatingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Générer modèle
            </Button>
            <Button size="sm" className="text-xs gap-1.5" onClick={() => setUploadOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> Importer
            </Button>
          </div>
        </div>

        {/* Type filter */}
        <div className="flex gap-1.5 flex-wrap">
          {DOCUMENT_TYPES.map((dt) => (
            <button
              key={dt.value}
              onClick={() => setSelectedType(dt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedType === dt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {dt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Templates list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center space-y-2">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucun modèle pour "{typeLabel}"</p>
          <p className="text-xs text-muted-foreground">Importez un fichier .docx contenant des variables comme {"{{client_name}}"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTemplates.map((template: any) => (
            <div key={template.id} className="rounded-xl border bg-card p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{template.name}</p>
                  {template.is_default && (
                    <Badge variant="secondary" className="text-[10px] gap-0.5">
                      <Star className="h-2.5 w-2.5" /> Par défaut
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {template.file_name} • {(template.companies as any)?.short_name || ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDownloadTemplate(template)} title="Télécharger">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Switch
                  checked={template.is_default}
                  onCheckedChange={(checked) => toggleDefault.mutate({ id: template.id, isDefault: checked })}
                  className="scale-75"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                  onClick={() => deleteMutation.mutate(template)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Importer un modèle Word</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom du modèle</Label>
              <Input
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="Ex: Devis standard"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type de document</Label>
              <Select value={uploadDocType} onValueChange={(v) => setUploadDocType(v as DocumentType)}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((dt) => (
                    <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dbCompanies.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Société</Label>
                <Select value={uploadCompany} onValueChange={setUploadCompany}>
                  <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {dbCompanies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Fichier .docx</Label>
              <div className="relative">
                <input
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                />
              </div>
              {uploadFile && (
                <p className="text-[10px] text-muted-foreground">{uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)} Ko)</p>
              )}
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                💡 Utilisez des variables comme <code className="bg-muted px-1 rounded text-[10px]">{"{{client_name}}"}</code> dans votre fichier Word.
                Elles seront remplacées automatiquement lors de la génération.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={handleUpload} disabled={uploading || !uploadFile || !uploadName.trim()}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Importer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variables Reference Dialog */}
      <Dialog open={variablesOpen} onOpenChange={setVariablesOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">Variables disponibles</DialogTitle>
          </DialogHeader>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {DOCUMENT_TYPES.map((dt) => (
              <button
                key={dt.value}
                onClick={() => setSelectedType(dt.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedType === dt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {dt.label}
              </button>
            ))}
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-1.5 pr-2">
              {TEMPLATE_VARIABLES[selectedType].map((v) => (
                <div key={v.key} className="flex items-center gap-2 rounded-lg border p-2.5 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{`{{${v.key}}}`}</code>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{v.label} — ex: {v.example}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => copyVariable(v.key)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
