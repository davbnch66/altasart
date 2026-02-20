import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Eye, Download } from "lucide-react";
import { generateBTReportPdf } from "@/lib/generateBTReportPdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface BTReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  btId: string;
  companyIds: string[];
}

type Stage = "idle" | "generating" | "preview" | "sending";

export function BTReportPreviewDialog({ open, onOpenChange, btId, companyIds }: BTReportPreviewDialogProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);
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
      setPdfDataUri(`data:application/pdf;base64,${result.pdfBase64}`);
      setStage("preview");
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de la génération du rapport");
      setStage("idle");
    }
  };

  const handleDownload = () => {
    if (!pdfDataUri) return;
    const link = document.createElement("a");
    link.href = pdfDataUri;
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
      const { data: companyData } = await supabase.from("companies").select("name").in("id", companyIds).limit(1).single();
      const { error } = await supabase.functions.invoke("send-bt-report", {
        body: { to: clientEmail, pdfBase64, fileName, operationId: btId, companyName: companyData?.name || "" },
      });
      if (error) throw error;
      toast.success(`Rapport envoyé à ${clientEmail}`);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'envoi du rapport");
    } finally {
      setStage("idle");
      setPdfDataUri(null);
      setPdfBase64(null);
    }
  };

  const handleClose = (val: boolean) => {
    if (stage === "generating" || stage === "sending") return;
    onOpenChange(val);
    if (!val) {
      setStage("idle");
      setPdfDataUri(null);
      setPdfBase64(null);
    }
  };

  useEffect(() => {
    if (open && stage === "idle" && !pdfDataUri) {
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

        <div className="flex-1 min-h-0 px-4">
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

          {(stage === "preview" || stage === "idle") && pdfDataUri && (
            <div className="w-full h-[60vh] rounded-lg overflow-hidden border">
              <iframe
                src={pdfDataUri}
                className="w-full h-full"
                title="Aperçu rapport BT"
              />
            </div>
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