import { Mail, Phone, ArrowDownLeft, ArrowUpRight, MessageSquare, Paperclip, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";

interface ClientExchangesTabProps {
  clientId: string;
}

const channelIcons: Record<string, React.ElementType> = {
  email: Mail,
  whatsapp: MessageSquare,
  phone: Phone,
  internal: MessageSquare,
};

const channelLabels: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  phone: "Appel",
  internal: "Interne",
};

const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const ClientExchangesTab = ({ clientId }: ClientExchangesTabProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Fetch messages linked to this client
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["client-messages", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, inbound_emails(id, subject, ai_analysis, attachments)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Fetch inbound emails directly linked to this client (even without a message row)
  const { data: directEmails = [], isLoading: emailsLoading } = useQuery({
    queryKey: ["client-inbound-emails", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_emails")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const isLoading = messagesLoading || emailsLoading;

  // Merge and deduplicate: messages + direct emails not already in messages
  const messageEmailIds = new Set(messages.map((m: any) => m.inbound_email_id).filter(Boolean));
  const extraEmails = directEmails
    .filter((e: any) => !messageEmailIds.has(e.id))
    .map((e: any) => ({
      id: `ie-${e.id}`,
      inbound_email_id: e.id,
      channel: "email" as const,
      direction: "inbound",
      sender: e.from_name || e.from_email || "Inconnu",
      subject: e.subject,
      body: e.body_text?.substring(0, 300) || null,
      created_at: e.created_at,
      is_read: e.status === "processed",
      inbound_emails: e,
    }));

  const allExchanges = [...messages, ...extraEmails].sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (allExchanges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground text-sm">Aucun échange avec ce client</p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          Les emails et messages liés à ce client apparaîtront ici
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {allExchanges.map((exchange: any) => {
        const isInbound = exchange.direction === "inbound";
        const ChannelIcon = channelIcons[exchange.channel] || Mail;
        const inboundEmail = exchange.inbound_emails;
        const attachments = inboundEmail?.attachments;
        const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

        return (
          <div
            key={exchange.id}
            className={`rounded-xl border bg-card transition-colors ${
              exchange.inbound_email_id ? "cursor-pointer hover:bg-muted/30" : ""
            } ${isMobile ? "p-3" : "p-4"}`}
            onClick={() => {
              if (exchange.inbound_email_id) {
                navigate(`/inbox?email=${exchange.inbound_email_id}`);
              }
            }}
          >
            <div className="flex items-start gap-3">
              {/* Direction indicator */}
              <div
                className={`mt-0.5 rounded-lg flex items-center justify-center shrink-0 ${
                  isMobile ? "h-8 w-8" : "h-9 w-9"
                } ${isInbound ? "bg-info/10" : "bg-success/10"}`}
              >
                {isInbound ? (
                  <ArrowDownLeft className={`text-info ${isMobile ? "h-4 w-4" : "h-4.5 w-4.5"}`} />
                ) : (
                  <ArrowUpRight className={`text-success ${isMobile ? "h-4 w-4" : "h-4.5 w-4.5"}`} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`font-medium truncate ${isMobile ? "text-xs" : "text-sm"}`}>
                      {exchange.sender || (isInbound ? "Client" : "Vous")}
                    </span>
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 shrink-0">
                      <ChannelIcon className="h-2.5 w-2.5 mr-0.5" />
                      {channelLabels[exchange.channel] || exchange.channel}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                    {formatDateTime(exchange.created_at)}
                  </span>
                </div>

                {/* Subject */}
                {exchange.subject && (
                  <p className={`font-medium truncate mt-0.5 ${isMobile ? "text-xs" : "text-sm"}`}>
                    {exchange.subject}
                  </p>
                )}

                {/* Body preview */}
                {exchange.body && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {exchange.body}
                  </p>
                )}

                {/* Footer: attachments + link */}
                <div className="flex items-center gap-3 mt-1.5">
                  {hasAttachments && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Paperclip className="h-3 w-3" />
                      {attachments.length} pièce{attachments.length > 1 ? "s" : ""} jointe{attachments.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {exchange.inbound_email_id && (
                    <span className="flex items-center gap-1 text-[10px] text-info">
                      <ExternalLink className="h-3 w-3" />
                      Voir dans l'inbox
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
