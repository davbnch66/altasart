import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Mail, RefreshCw, Loader2, FileText, X, Minimize2, Pencil, Eye, Save } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { generatePpspsPdf } from "@/lib/generatePpspsPdf";
import { PdfCanvasViewer } from "@/components/visite/PdfCanvasViewer";
import { SendEmailDialog } from "@/components/visite/SendEmailDialog";
import { PpspsEditor, CustomSection, PpspsImage, PpspsAttachment } from "./PpspsEditor";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  content: any;
  onContentChange: (updated: any) => void;
  devis: any;
  onRegenerate: () => void;
  regenerating: boolean;
  version: number;
  ppspsId?: string;
  customSections?: CustomSection[];
  onCustomSectionsChange?: (sections: CustomSection[]) => void;
  images?: PpspsImage[];
  onImagesChange?: (images: PpspsImage[]) => void;
  attachments?: PpspsAttachment[];
  onAttachmentsChange?: (attachments: PpspsAttachment[]) => void;
}

export const PpspsPreviewDialog = ({
  open, onOpenChange, content, onContentChange, devis,
  onRegenerate, regenerating, version, ppspsId,
  customSections: externalCustomSections,
  onCustomSectionsChange: externalOnCustomSectionsChange,
  images: externalImages,
  onImagesChange: externalOnImagesChange,
  attachments: externalAttachments,
  onAttachmentsChange: externalOnAttachmentsChange,
}: Props) => {
  const isMobile = useIsMobile();
  const [pdfData, setPdfData] = useState<{ blobUrl: string; dataUri: string; fileName: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [compress, setCompress] = useState(true);
  const [fileSizeKb, setFileSizeKb] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("preview");
  const [editedContent, setEditedContent] = useState<any>(null);
  const [dirty, setDirty] = useState(false);

  // Local state for sections/images/attachments if not externally managed
  const [localCustomSections, setLocalCustomSections] = useState<CustomSection[]>([]);
  const [localImages, setLocalImages] = useState<PpspsImage[]>([]);
  const [localAttachments, setLocalAttachments] = useState<PpspsAttachment[]>([]);

  const customSections = externalCustomSections ?? localCustomSections;
  const onCustomSectionsChange = externalOnCustomSectionsChange ?? setLocalCustomSections;
  const images = externalImages ?? localImages;
  const onImagesChange = externalOnImagesChange ?? setLocalImages;
  const attachments = externalAttachments ?? localAttachments;
  const onAttachmentsChange = externalOnAttachmentsChange ?? setLocalAttachments;

  const generatePreview = useCallback(async (shouldCompress: boolean, contentToUse?: any) => {
    const c = contentToUse || editedContent || content;
    if (!c) return;
    setGenerating(true);
    try {
      if (pdfData?.blobUrl) URL.revokeObjectURL(pdfData.blobUrl);
      const result = await generatePpspsPdf(c, devis, {
        compress: shouldCompress,
        customSections,
        images,
      });
      setPdfData(result);
      const resp = await fetch(result.blobUrl);
      const blob = await resp.blob();
      setFileSizeKb(Math.round(blob.size / 1024));
    } catch (e: any) {
      toast.error("Erreur génération PDF : " + (e.message || ""));
    } finally {
      setGenerating(false);
    }
  }, [content, editedContent, devis, customSections, images, compress]);

  useEffect(() => {
    if (open && content) {
      setEditedContent(JSON.parse(JSON.stringify(content)));
      generatePreview(compress, content);
      setDirty(false);
    }
    if (!open) {
      if (pdfData?.blobUrl) URL.revokeObjectURL(pdfData.blobUrl);
      setPdfData(null);
      setFileSizeKb(null);
      setActiveTab("preview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Regenerate preview when switching to preview tab after edits
  useEffect(() => {
    if (activeTab === "preview" && dirty && open) {
      generatePreview(compress, editedContent);
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (open && activeTab === "preview") {
      generatePreview(compress, editedContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compress]);

  if (!content) return null;

  const handleContentEdit = (updated: any) => {
    setEditedContent(updated);
    setDirty(true);
  };

  const handleSave = () => {
    if (editedContent) {
      onContentChange(editedContent);
      toast.success("Modifications enregistrées");
      setDirty(false);
    }
  };

  const handleSaveAndPreview = () => {
    handleSave();
    setActiveTab("preview");
  };

  const handleDownload = () => {
    if (!pdfData?.blobUrl) return;
    const a = document.createElement("a");
    a.href = pdfData.blobUrl;
    a.download = pdfData.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("PDF téléchargé");
  };

  const handleClose = () => {
    if (pdfData?.blobUrl) URL.revokeObjectURL(pdfData.blobUrl);
    setPdfData(null);
    onOpenChange(false);
  };

  const clientEmail = devis?.clients?.email;
  const clientName = devis?.clients?.name;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-sm font-semibold truncate flex-1 mr-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              PPSPS — {devis.code || "Devis"}
              <span className="text-xs text-muted-foreground">v{version}</span>
              {fileSizeKb !== null && activeTab === "preview" && (
                <span className="text-xs text-muted-foreground font-normal ml-1">({fileSizeKb} Ko)</span>
              )}
              {dirty && <span className="text-xs text-amber-500 font-normal">• non enregistré</span>}
            </DialogTitle>
            <div className="flex items-center gap-1.5 shrink-0">
              {activeTab === "edit" && (
                <Button size="sm" variant="default" onClick={handleSaveAndPreview} disabled={!dirty}>
                  <Save className="h-3.5 w-3.5 mr-1" /> {isMobile ? "" : "Enregistrer"}
                </Button>
              )}
              {activeTab === "preview" && (
                <>
                  <div className="flex items-center gap-1 mr-1">
                    <Switch id="compress" checked={compress} onCheckedChange={setCompress} className="scale-75" />
                    <Label htmlFor="compress" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                      <Minimize2 className="h-3 w-3 inline mr-0.5" />
                      {isMobile ? "" : "Compresser"}
                    </Label>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)} disabled={!pdfData}>
                    <Mail className="h-4 w-4 mr-1" /> {isMobile ? "" : "Envoyer"}
                  </Button>
                  <Button size="sm" onClick={handleDownload} disabled={!pdfData}>
                    <Download className="h-4 w-4 mr-1" /> {isMobile ? "" : "Télécharger"}
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={onRegenerate} disabled={regenerating} title="Regénérer avec l'IA">
                {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
            <div className="px-4 pt-2 shrink-0">
              <TabsList className="h-8">
                <TabsTrigger value="preview" className="text-xs gap-1">
                  <Eye className="h-3.5 w-3.5" /> Aperçu PDF
                </TabsTrigger>
                <TabsTrigger value="edit" className="text-xs gap-1">
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="preview" className="flex-1 min-h-0 overflow-auto mt-0 data-[state=inactive]:hidden">
              {generating ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Génération de l'aperçu PDF…</p>
                </div>
              ) : pdfData ? (
                isMobile ? (
                  <div className="p-4 flex flex-col items-center gap-4">
                    <p className="text-sm text-muted-foreground text-center">
                      L'aperçu intégré n'est pas disponible sur mobile.
                    </p>
                    <Button onClick={() => setEmailOpen(true)} variant="outline" className="w-full">
                      <Mail className="h-4 w-4 mr-2" /> Envoyer par email
                    </Button>
                    <Button onClick={handleDownload} className="w-full">
                      <Download className="h-4 w-4 mr-2" /> Télécharger le PDF
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => window.open(pdfData.blobUrl, "_blank")}>
                      Ouvrir dans un nouvel onglet
                    </Button>
                  </div>
                ) : (
                  <PdfCanvasViewer data={pdfData.dataUri} />
                )
              ) : null}
            </TabsContent>

            <TabsContent value="edit" className="flex-1 min-h-0 overflow-auto mt-0 data-[state=inactive]:hidden">
              {editedContent && (
                <PpspsEditor
                  content={editedContent}
                  onContentChange={handleContentEdit}
                  customSections={customSections}
                  onCustomSectionsChange={(s) => { onCustomSectionsChange(s); setDirty(true); }}
                  images={images}
                  onImagesChange={(i) => { onImagesChange(i); setDirty(true); }}
                  attachments={attachments}
                  onAttachmentsChange={(a) => { onAttachmentsChange(a); setDirty(true); }}
                  ppspsId={ppspsId || devis.id}
                  companyId={devis.company_id}
                />
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <SendEmailDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        defaultTo={clientEmail}
        defaultSubject={`PPSPS${devis.code ? ` — ${devis.code}` : ""}`}
        pdfBlobUrl={pdfData?.blobUrl}
        fileName={pdfData?.fileName}
        clientName={clientName}
        visiteCode={devis.code}
        visiteTitle={devis.objet}
        companyId={devis.company_id}
        documentType="ppsps"
      />
    </>
  );
};
