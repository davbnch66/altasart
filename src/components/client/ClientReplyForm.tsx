import { useState, useRef, useCallback } from "react";
import { Send, Sparkles, Loader2, Paperclip, X, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/contexts/CompanyContext";

interface ClientReplyFormProps {
  clientId: string;
  clientName: string;
  clientEmail?: string | null;
  onSent?: () => void;
}

export const ClientReplyForm = ({ clientId, clientName, clientEmail, onSent }: ClientReplyFormProps) => {
  const { user } = useAuth();
  const { current } = useCompany();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState("cordial");
  const [intent, setIntent] = useState("custom");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 10 * 1024 * 1024;
    const valid = files.filter(f => {
      if (f.size > maxSize) { toast.error(`${f.name} dépasse 10MB`); return false; }
      return true;
    });
    setAttachedFiles(prev => [...prev, ...valid].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removeFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const filesToBase64 = async (files: File[]) => {
    return Promise.all(files.map(f => new Promise<{ filename: string; content_type: string; content_base64: string; size: number }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1] || "";
        resolve({ filename: f.name, content_type: f.type || "application/octet-stream", content_base64: base64, size: f.size });
      };
      reader.onerror = reject;
      reader.readAsDataURL(f);
    })));
  };

  const handleDraft = async () => {
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: {
          context: {
            clientName,
            subject: subject || "Message",
            existingBody: body || undefined,
          },
          tone,
          intent,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erreur IA");
      setBody(data.draft);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération");
    } finally {
      setDrafting(false);
    }
  };

  const handleSend = async () => {
    if (!clientEmail) {
      toast.error("Aucun email de contact pour ce client");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error("Sujet et contenu requis");
      return;
    }
    setSending(true);
    try {
      const emailAttachments = attachedFiles.length > 0 ? await filesToBase64(attachedFiles) : undefined;

      const { data, error } = await supabase.functions.invoke("send-visite-email", {
        body: {
          to: clientEmail,
          subject,
          body,
          companyId: current && current !== "global" ? current : undefined,
          ...(emailAttachments?.length ? { attachments: emailAttachments } : {}),
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erreur d'envoi");

      const attachmentsMeta = attachedFiles.map(f => ({ filename: f.name, content_type: f.type, size: f.size }));

      if (current && current !== "global") {
        await supabase.from("messages").insert({
          company_id: current,
          client_id: clientId,
          channel: "email",
          direction: "outbound",
          sender: user?.email || "Moi",
          subject,
          body,
          is_read: true,
          created_by: user?.id,
          delivery_status: "sent",
          attachments: attachmentsMeta.length > 0 ? attachmentsMeta : [],
        } as any);
      }

      toast.success("Email envoyé avec succès");
      setSubject("");
      setBody("");
      setAttachedFiles([]);
      setExpanded(false);
      onSent?.();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  if (!expanded) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setExpanded(true)}>
        <Send className="h-4 w-4 mr-2" />
        Répondre au client
      </Button>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Nouveau message</h4>
        <button onClick={() => { setExpanded(false); setAttachedFiles([]); }} className="text-xs text-muted-foreground hover:underline">
          Annuler
        </button>
      </div>

      <Input
        placeholder="Objet"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="text-sm"
      />

      <Textarea
        placeholder="Contenu du message…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        className="text-sm resize-none"
      />

      {/* Attached files */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px]">
              <File className="h-3 w-3 text-muted-foreground" />
              <span className="max-w-[120px] truncate">{f.name}</span>
              <span className="text-muted-foreground">({(f.size / 1024).toFixed(0)}KB)</span>
              <button onClick={() => removeFile(i)} className="ml-0.5 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.zip,.csv,.txt"
      />

      {/* AI draft controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs px-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-3 w-3 mr-1" />
          Joindre
        </Button>

        <Select value={tone} onValueChange={setTone}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cordial">Cordial</SelectItem>
            <SelectItem value="formel">Formel</SelectItem>
            <SelectItem value="relance">Relance</SelectItem>
          </SelectContent>
        </Select>

        <Select value={intent} onValueChange={setIntent}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">Libre</SelectItem>
            <SelectItem value="envoi_rapport">Envoi rapport</SelectItem>
            <SelectItem value="relance">Relance</SelectItem>
            <SelectItem value="confirmation">Confirmation</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleDraft} disabled={drafting}>
          {drafting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
          Rédiger avec l'IA
        </Button>
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={handleSend} disabled={sending || !body.trim() || !subject.trim()}>
          {sending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
          Envoyer
        </Button>
      </div>

      {!clientEmail && (
        <p className="text-xs text-destructive">⚠ Aucun email renseigné pour ce client.</p>
      )}
    </div>
  );
};
