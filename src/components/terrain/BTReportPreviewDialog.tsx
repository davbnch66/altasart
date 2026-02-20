import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Download, Eye } from "lucide-react";
import { generateBTReportPdf } from "@/lib/generateBTReportPdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

interface BTReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  btId: string;
  companyIds: string[];
}

type Stage = "idle" | "generating" | "preview" | "sending";

export function BTReportPreviewDialog({ open, onOpenChange, btId, companyIds }: BTReportPreviewDialogProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [clientEmail, setClientEmail] = useState<string | null>(null);

  const handleGenerate = async () => {
    setStage("generating");
    try {
      const result = await generateBTReportPdf(btId);
      setPdfBase64(result.pdfBase64);
      setFileName(result.fileName);
      setClientEmail(result.clientEmail);

      // Render PDF pages as images using pdfjs
      const byteChars = atob(result.pdfBase64);
      const byteNumbers = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const pdf = await pdfjsLib.getDocument({ data: byteNumbers }).promise;
      const images: string[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const scale = 2;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        images.push(canvas.toDataURL("image/png"));
      }
      setPageImages(images);
      setStage("preview");
    } catch (err: any) {
      console.error("PDF generation error:", err);
      toast.error("Erreur lors de la génération du rapport");
      setStage("idle");
    }
  };

  const handleDownload = () => {
    if (!pdfBase64) return;
    const link = document.createElement("a");
    link.href = `data:application/pdf;base64,${pdfBase64}`;
    link.download = fileName || "rapport-bt.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Rapport téléchargé");
  };

  const handleSend = async () => {
    if (!pdfBase64 || !clientEmail) {
      toast.error("Aucun email client trouvé pour ce dossier");
      return;
    }
    setStage("sending");
    try {
      // Convert base64 to binary and upload to storage
      const byteChars = atob(pdfBase64);
      const byteNumbers = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const storagePath = `reports/${btId}_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("bt-reports")
        .upload(storagePath, byteNumbers, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw uploadError;

      const { data: companyData } = await supabase.from("companies").select("name").in("id", companyIds).limit(1).single();
      const { error } = await supabase.functions.invoke("send-bt-report", {
        body: { to: clientEmail, storagePath, fileName, operationId: btId, companyName: companyData?.name || "" },
      });
      if (error) throw error;
      toast.success(`Rapport envoyé à ${clientEmail}`);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'envoi du rapport");
    } finally {
      setStage("idle");
      setPageImages([]);
      setPdfBase64(null);
    }
  };

  const handleClose = (val: boolean) => {
    if (stage === "generating" || stage === "sending") return;
    onOpenChange(val);
    if (!val) {
      setStage("idle");
      setPageImages([]);
      setPdfBase64(null);
    }
  };

  useEffect(() => {
    if (open && stage === "idle" && pageImages.length === 0) {
      handleGenerate();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Aperçu du rapport
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 px-4 overflow-hidden">
          {stage === "generating" && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Génération du rapport...</p>
              <Progress value={50} className="w-48 h-2" />
            </div>
          )}

          {stage === "sending" && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Envoi en cours...</p>
            </div>
          )}

          {(stage === "preview" || stage === "idle") && pageImages.length > 0 && (
            <ScrollArea className="h-[60vh] rounded-lg border bg-muted/30">
              <div className="space-y-2 p-2">
                {pageImages.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Page ${i + 1}`}
                    className="w-full rounded shadow-sm"
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="p-4 pt-2 flex-row gap-2">
          {stage === "preview" && (
            <>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => handleClose(false)}>
                Annuler
              </Button>
              <Button variant="secondary" size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5 mr-1" />
                Télécharger
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleSend}
                disabled={!clientEmail}
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                Envoyer à {clientEmail || "—"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
