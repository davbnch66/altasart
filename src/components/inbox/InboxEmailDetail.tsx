import { useState } from "react";
import { ArrowLeft, Mail, Clock, User, Sparkles, Send, RefreshCw, Loader2 } from "lucide-react";
import DOMPurify from "dompurify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InboxAiSummary } from "./InboxAiSummary";
import { InboxActionBar } from "./InboxActionBar";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InboundEmail {
  id: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  status: string;
  ai_analysis: any;
  client_id: string | null;
  created_at: string;
  clients?: { name: string } | null;
  message_id?: string | null;
  email_account_id?: string | null;
  _account_id?: string | null;
}

interface EmailAction {
  id: string;
  action_type: string;
  status: string;
  payload: any;
}

interface Props {
  email: InboundEmail;
  actions: EmailAction[];
  onBack: () => void;
  onActionExecuted: () => void;
  onReply?: (data: { to: string; subject: string; body: string; messageId?: string; accountId?: string }) => void;
}

const statusLabels: Record<string, string> = {
  pending: "En attente",
  processing: "Analyse en cours",
  processed: "Traité",
  error: "Erreur",
};

const statusStyles: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  processing: "bg-info/10 text-info",
  processed: "bg-success/10 text-success",
  error: "bg-destructive/10 text-destructive",
};

export const InboxEmailDetail = ({ email, actions, onBack, onActionExecuted, onReply }: Props) => {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-6rem)] pb-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      {/* Header */}
      <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"} space-y-3`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className={`font-bold truncate ${isMobile ? "text-base" : "text-lg"}`}>
              {email.subject || "(sans objet)"}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{email.from_name || email.from_email}</span>
            </div>
            {email.from_name && email.from_email && (
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{email.from_email}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge className={`text-xs ${statusStyles[email.status] || ""}`}>
              {statusLabels[email.status] || email.status}
            </Badge>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(email.created_at).toLocaleString("fr-FR")}
            </span>
          </div>
        </div>

        {email.clients && (
          <div className="flex items-center gap-1.5 text-xs">
            <Badge variant="outline" className="text-xs">Client : {email.clients.name}</Badge>
          </div>
        )}
      </div>

      {/* AI Summary */}
      <InboxAiSummary analysis={email.ai_analysis} />

      {/* Actions */}
      <InboxActionBar
        actions={actions}
        onActionExecuted={onActionExecuted}
        clientEmail={email.from_email}
        clientName={email.from_name || email.clients?.name}
        emailSubject={email.subject || undefined}
      />

      {/* AI Suggested Reply */}
      {email.ai_analysis?.reponse_suggeree && onReply && (
        <div className="rounded-xl border bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Réponse suggérée
            </h3>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => onReply({
                to: email.from_email || "",
                subject: `Re: ${email.subject || ""}`,
                body: email.ai_analysis.reponse_suggeree,
                messageId: email.message_id || undefined,
                accountId: email._account_id || email.email_account_id || undefined,
              })}
            >
              <Send className="h-3 w-3" /> Utiliser cette réponse
            </Button>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
            {email.ai_analysis.reponse_suggeree}
          </p>
        </div>
      )}

      {/* Body */}
      <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
        <h3 className="text-sm font-semibold mb-3">Contenu de l'email</h3>
        {email.body_html ? (
          <div
            className="prose prose-sm max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(email.body_html, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'hr'], ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style', 'target', 'rel'], ALLOW_DATA_ATTR: false }) }}
          />
        ) : (
          <pre className="text-sm whitespace-pre-wrap text-foreground font-sans">
            {email.body_text || "(vide)"}
          </pre>
        )}
      </div>
    </div>
  );
};