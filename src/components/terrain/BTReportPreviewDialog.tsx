import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Download, Eye, ChevronDown, Mail } from "lucide-react";
import { generateBTReportPdf } from "@/lib/generateBTReportPdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface ContactEmail {
  label: string;
  email: string;
}

export function BTReportPreviewDialog({ open, onOpenChange, btId, companyIds }: BTReportPreviewDialogProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [selectedEmail, setSelectedEmail] = useState("");
  const [contactEmails, setContactEmails] = useState<ContactEmail[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Fetch client contacts for this operation's dossier
  const fetchContactEmails = async () => {
    try {
      const { data: op } = await supabase
        .from("operations")
        .select("dossier_id, dossiers(client_id)")
        .eq("id", btId)
        .maybeSingle();

      const clientId = (op as any)?.dossiers?.client_id;
      if (!clientId) return;

      // Fetch client main email
      const { data: client } = await supabase
        .from("clients")
        .select("name, email, contact_name")
        .eq("id", clientId)
        .maybeSingle();

      const emails: ContactEmail[] = [];

      if (client?.email) {
        emails.push({
          label: client.contact_name || client.name || "Client principal",
          email: client.email,
        });
      }

      // Fetch client contacts
      const { data: contacts } = await supabase
        .from("client_contacts")
        .select("first_name, last_name, email, function_title, is_default")
        .eq("client_id", clientId)
        .order("is_default", { ascending: false })
        .order("sort_order", { ascending: true });

      if (contacts) {
        for (const c of contacts) {
          if (c.email && !emails.some((e) => e.email === c.email)) {
            const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
            const label = c.function_title ? `${name} (${c.function_title})` : name;
            emails.push({ label, email: c.email });
          }
        }
      }

      setContactEmails(emails);
      // Auto-select the first contact (default or main)
      if (emails.length > 0 && !selectedEmail) {
        setSelectedEmail(emails[0].email);
      }
    } catch (err) {
      console.error("Error fetching contacts:", err);
    }
  };

  const handleGenerate = async () => {
    setStage("generating");
    try {
      const result = await generateBTReportPdf(btId);
      setPdfBase64(result.pdfBase64);
      setFileName(result.fileName);

      // Set default email from PDF generation if none selected
      if (!selectedEmail && result.clientEmail) {
        setSelectedEmail(result.clientEmail);
      }

      // Render PDF pages as images
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

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;

  const handleSend = async () => {
    if (!pdfBase64 || !selectedEmail) {
      toast.error("Veuillez saisir un email destinataire");
      return;
    }
    if (!isValidEmail(selectedEmail)) {
      toast.error("Adresse email invalide");
      return;
    }
    setStage("sending");
    try {
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
        body: { to: selectedEmail, storagePath, fileName, operationId: btId, companyName: companyData?.name || "" },
      });
      if (error) throw error;
      toast.success(`Rapport envoyé à ${selectedEmail}`);
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
      setSelectedEmail("");
      setContactEmails([]);
    }
  };

  useEffect(() => {
    if (open && stage === "idle" && pageImages.length === 0) {
      handleGenerate();
      fetchContactEmails();
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
            <>
              <ScrollArea className="h-[50vh] rounded-lg border bg-muted/30">
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

              {/* Email selector */}
              <div className="mt-3 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Envoyer à
                </label>
                <div className="flex gap-1.5">
                  <Input
                    type="email"
                    placeholder="email@exemple.com"
                    value={selectedEmail}
                    onChange={(e) => setSelectedEmail(e.target.value)}
                    className="flex-1 h-9 text-sm"
                  />
                  {contactEmails.length > 0 && (
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 px-2">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-1" align="end">
                        <div className="space-y-0.5">
                          {contactEmails.map((c) => (
                            <button
                              key={c.email}
                              className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors ${
                                selectedEmail === c.email ? "bg-accent font-medium" : ""
                              }`}
                              onClick={() => {
                                setSelectedEmail(c.email);
                                setPopoverOpen(false);
                              }}
                            >
                              <div className="font-medium text-xs">{c.label}</div>
                              <div className="text-xs text-muted-foreground">{c.email}</div>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            </>
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
                disabled={!selectedEmail || !isValidEmail(selectedEmail)}
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                Envoyer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
