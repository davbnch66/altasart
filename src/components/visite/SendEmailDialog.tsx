import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mail, Send, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SendEmailDialogProps {
  open: boolean;
  onClose: () => void;
  defaultTo?: string;
  defaultSubject?: string;
  pdfBlobUrl?: string | null;
  fileName?: string;
  clientName?: string;
  visiteCode?: string;
  visiteTitle?: string;
  visiteId?: string;
  companyId?: string;
}

export function SendEmailDialog({
  open, onClose, defaultTo, defaultSubject, pdfBlobUrl, fileName,
  clientName, visiteCode, visiteTitle, visiteId, companyId,
}: SendEmailDialogProps) {
  const [to, setTo] = useState(defaultTo || "");
  const [subject, setSubject] = useState(defaultSubject || "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Load template when dialog opens
  useEffect(() => {
    if (open) {
      setTo(defaultTo || "");
      setSubject(defaultSubject || "");
      setBody("");
      if (companyId) {
        loadTemplate();
      }
    }
  }, [open, defaultTo, defaultSubject, companyId, visiteId]);

  const loadTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-email-template", {
        body: {
          templateType: "rapport_visite",
          companyId,
          visiteId,
        },
      });

      if (error) throw error;

      if (data?.found) {
        setSubject(data.subject || defaultSubject || "");
        setBody(data.body || "");
        toast.success("Modèle d'email chargé automatiquement");
      }
    } catch (e: any) {
      console.warn("Template not found or error:", e.message);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleSend = async () => {
    if (!to || !subject) {
      toast.error("Veuillez renseigner le destinataire et l'objet");
      return;
    }

    setSending(true);
    try {
      let pdfBase64: string | undefined;

      if (pdfBlobUrl) {
        const resp = await fetch(pdfBlobUrl);
        const blob = await resp.blob();
        pdfBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.readAsDataURL(blob);
        });
      }

      const { data, error } = await supabase.functions.invoke("send-visite-email", {
        body: {
          to,
          subject,
          body,
          pdfBase64,
          fileName,
          visiteId,
          companyId,
          clientName,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Email envoyé avec succès");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Envoyer le rapport par email
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Destinataire</Label>
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="client@example.com"
            />
          </div>
          <div>
            <Label>Objet</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Rapport de visite technique"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Message</Label>
              {companyId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1 text-muted-foreground"
                  onClick={loadTemplate}
                  disabled={loadingTemplate}
                >
                  {loadingTemplate ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Recharger le modèle
                </Button>
              )}
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={loadingTemplate ? "Chargement du modèle..." : "Bonjour,\n\nVeuillez trouver ci-joint le rapport de visite technique.\n\nCordialement,"}
              rows={10}
              className={loadingTemplate ? "opacity-50" : ""}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {loadingTemplate ? "Chargement du modèle en cours..." : "Relisez et ajustez le message avant envoi"}
            </p>
          </div>
          {pdfBlobUrl && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              📎 {fileName || "rapport.pdf"} sera joint à l'email
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={sending}>Annuler</Button>
            <Button onClick={handleSend} disabled={sending || loadingTemplate}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Envoyer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
