import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Mail, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { SendEmailDialog } from "./SendEmailDialog";

interface PdfPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  blobUrl: string | null;
  dataUri?: string | null;
  fileName: string;
  clientEmail?: string;
  visiteCode?: string;
}

export function PdfPreviewDialog({ open, onClose, blobUrl, dataUri, fileName, clientEmail, visiteCode }: PdfPreviewDialogProps) {
  const isMobile = useIsMobile();
  const [emailOpen, setEmailOpen] = useState(false);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    a.click();
  };

  const handleClose = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-sm font-semibold truncate flex-1 mr-2">{fileName}</DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
                <Mail className="h-4 w-4 mr-1" /> {isMobile ? "" : "Envoyer"}
              </Button>
              <Button size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" /> {isMobile ? "" : "Télécharger"}
              </Button>
              <Button size="icon" variant="ghost" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto">
            {blobUrl && (
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
                  <Button variant="outline" className="w-full" onClick={() => window.open(blobUrl, "_blank")}>
                    Ouvrir dans un nouvel onglet
                  </Button>
                </div>
              ) : dataUri ? (
                <iframe
                  src={dataUri}
                  className="w-full h-full border-0"
                  title="Aperçu PDF"
                />
              ) : (
                <iframe
                  src={`${blobUrl}#zoom=50`}
                  className="w-full h-full border-0"
                  title="Aperçu PDF"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SendEmailDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        defaultTo={clientEmail}
        defaultSubject={`Rapport de visite technique${visiteCode ? ` N° ${visiteCode}` : ""}`}
        pdfBlobUrl={blobUrl}
        fileName={fileName}
      />
    </>
  );
}
