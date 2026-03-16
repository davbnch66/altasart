import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Mail, RefreshCw, Loader2, FileText, X, Minimize2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { generatePpspsPdf } from "@/lib/generatePpspsPdf";
import { PdfCanvasViewer } from "@/components/visite/PdfCanvasViewer";
import { SendEmailDialog } from "@/components/visite/SendEmailDialog";
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
}

export const PpspsPreviewDialog = ({ open, onOpenChange, content, devis, onRegenerate, regenerating, version }: Props) => {
  const isMobile = useIsMobile();
  const [pdfData, setPdfData] = useState<{ blobUrl: string; dataUri: string; fileName: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [compress, setCompress] = useState(true);
  const [fileSizeKb, setFileSizeKb] = useState<number | null>(null);

  const generatePreview = async (shouldCompress: boolean) => {
    if (!content) return;
    setGenerating(true);
    try {
      // Revoke previous blob
      if (pdfData?.blobUrl) URL.revokeObjectURL(pdfData.blobUrl);
      const result = await generatePpspsPdf(content, devis, { compress: shouldCompress });
      setPdfData(result);
      // Estimate file size
      const resp = await fetch(result.blobUrl);
      const blob = await resp.blob();
      setFileSizeKb(Math.round(blob.size / 1024));
    } catch (e: any) {
      toast.error("Erreur génération PDF : " + (e.message || ""));
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (open && content) {
      generatePreview(compress);
    }
    if (!open) {
      if (pdfData?.blobUrl) URL.revokeObjectURL(pdfData.blobUrl);
      setPdfData(null);
      setFileSizeKb(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, content]);

  useEffect(() => {
    if (open && content) {
      generatePreview(compress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compress]);

  if (!content) return null;

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
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-sm font-semibold truncate flex-1 mr-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              PPSPS — {devis.code || "Devis"}
              <span className="text-xs text-muted-foreground">v{version}</span>
              {fileSizeKb !== null && (
                <span className="text-xs text-muted-foreground font-normal ml-1">({fileSizeKb} Ko)</span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 mr-1">
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
              <Button size="sm" variant="outline" onClick={onRegenerate} disabled={regenerating}>
                {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-auto">
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
          </div>
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
