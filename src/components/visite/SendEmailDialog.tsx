import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SendEmailDialogProps {
  open: boolean;
  onClose: () => void;
  defaultTo?: string;
  defaultSubject?: string;
  pdfBlobUrl?: string | null;
  fileName?: string;
}

export function SendEmailDialog({ open, onClose, defaultTo, defaultSubject, pdfBlobUrl, fileName }: SendEmailDialogProps) {
  const [to, setTo] = useState(defaultTo || "");
  const [subject, setSubject] = useState(defaultSubject || "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

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
        body: { to, subject, body, pdfBase64, fileName },
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
            <Label>Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Bonjour,&#10;&#10;Veuillez trouver ci-joint le rapport de visite technique.&#10;&#10;Cordialement,"
              rows={5}
            />
          </div>
          {pdfBlobUrl && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              📎 {fileName || "rapport.pdf"} sera joint à l'email
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={sending}>Annuler</Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Envoyer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
