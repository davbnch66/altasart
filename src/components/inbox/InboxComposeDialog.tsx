import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Paperclip, X, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface EmailAccount {
  id: string;
  label: string;
  email_address: string;
  is_default: boolean;
  status: string;
}

interface ComposeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
  replyTo?: {
    to: string;
    subject: string;
    body: string;
    messageId?: string;
    accountId?: string;
  };
  forwardData?: {
    subject: string;
    body: string;
  };
}

export const InboxComposeDialog = ({ open, onOpenChange, onSent, replyTo, forwardData }: ComposeProps) => {
  const { current, dbCompanies } = useCompany();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  useEffect(() => {
    if (!open) return;
    const fetchAccounts = async () => {
      const { data } = await supabase
        .from("email_accounts")
        .select("id, label, email_address, is_default, status")
        .in("company_id", companyIds)
        .in("status", ["active", "testing"])
        .order("is_default", { ascending: false });
      const accs = data || [];
      setAccounts(accs);
      if (replyTo?.accountId) {
        setSelectedAccountId(replyTo.accountId);
      } else {
        const def = accs.find((a) => a.is_default);
        setSelectedAccountId(def?.id || accs[0]?.id || "");
      }
    };
    fetchAccounts();
  }, [open, companyIds.join(",")]);

  useEffect(() => {
    if (open && replyTo) {
      setTo(replyTo.to);
      setSubject(replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`);
      setBody(`\n\n--- Message original ---\n${replyTo.body}`);
    } else if (open && forwardData) {
      setTo("");
      setSubject(forwardData.subject.startsWith("Fwd:") ? forwardData.subject : `Fwd: ${forwardData.subject}`);
      setBody(`\n\n--- Message transféré ---\n${forwardData.body}`);
    } else if (open) {
      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");
      setAttachedFiles([]);
      setShowCcBcc(false);
    }
  }, [open, replyTo, forwardData]);

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error("Veuillez saisir un destinataire");
      return;
    }
    if (!selectedAccountId) {
      toast.error("Veuillez sélectionner un compte expéditeur");
      return;
    }

    setSending(true);
    try {
      const toRecipients = to.split(",").map((e) => e.trim()).filter(Boolean).map((email) => ({ email }));
      const ccRecipients = cc ? cc.split(",").map((e) => e.trim()).filter(Boolean).map((email) => ({ email })) : null;
      const bccRecipients = bcc ? bcc.split(",").map((e) => e.trim()).filter(Boolean).map((email) => ({ email })) : null;

      const { error } = await supabase.functions.invoke("email-bridge-send", {
        body: {
          account_id: selectedAccountId,
          to: toRecipients,
          cc: ccRecipients,
          bcc: bccRecipients,
          subject,
          body_html: `<div style="white-space:pre-wrap">${body.replace(/\n/g, "<br>")}</div>`,
          body_text: body,
          reply_to_message_id: replyTo?.messageId || null,
        },
      });

      if (error) throw error;
      toast.success("Email envoyé avec succès");
      onOpenChange(false);
      onSent?.();
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'envoi: " + (err.message || "Inconnue"));
    } finally {
      setSending(false);
    }
  };

  const handleDraftAI = async () => {
    if (!subject.trim() && !to.trim()) {
      toast.error("Renseignez au moins un sujet ou destinataire");
      return;
    }
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: {
          to: to.trim(),
          subject: subject.trim(),
          context: body.trim() || undefined,
          tone: "cordial",
          intent: "custom",
        },
      });
      if (error) throw error;
      if (data?.body) setBody(data.body);
      if (data?.subject && !subject.trim()) setSubject(data.subject);
    } catch {
      toast.error("Erreur lors de la rédaction IA");
    } finally {
      setDrafting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const total = [...attachedFiles, ...files];
    if (total.length > 5) {
      toast.error("Maximum 5 pièces jointes");
      return;
    }
    const tooLarge = files.find((f) => f.size > 10 * 1024 * 1024);
    if (tooLarge) {
      toast.error("Taille max : 10 Mo par fichier");
      return;
    }
    setAttachedFiles(total);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {replyTo ? "Répondre" : forwardData ? "Transférer" : "Nouveau message"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto">
          {accounts.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-12 shrink-0">De :</span>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Compte expéditeur" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">
                      {a.label} ({a.email_address})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-12 shrink-0">À :</span>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="destinataire@example.com"
              className="h-8 text-xs"
            />
            <button
              onClick={() => setShowCcBcc(!showCcBcc)}
              className="text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              {showCcBcc ? <ChevronUp className="h-3.5 w-3.5" /> : "Cc/Cci"}
            </button>
          </div>

          {showCcBcc && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-12 shrink-0">Cc :</span>
                <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc@example.com" className="h-8 text-xs" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-12 shrink-0">Cci :</span>
                <Input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="cci@example.com" className="h-8 text-xs" />
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-12 shrink-0">Objet :</span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet du message"
              className="h-8 text-xs"
            />
          </div>

          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Votre message..."
            className="min-h-[200px] text-sm"
          />

          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachedFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-1 rounded border bg-muted/50 px-2 py-1 text-xs">
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <button onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex gap-1.5">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDraftAI} disabled={drafting}>
              {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleSend} disabled={sending} className="gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
