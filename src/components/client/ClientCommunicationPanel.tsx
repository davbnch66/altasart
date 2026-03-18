import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Mail, Phone, MessageSquare, StickyNote, ArrowDownLeft, ArrowUpRight,
  Paperclip, Search, X, Send, Sparkles, Loader2, ExternalLink, Filter,
  Check, CheckCheck, AlertCircle, FileIcon, Image as ImageIcon, File,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/contexts/CompanyContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";



interface Props {
  clientId: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientMobile?: string | null;
  companyId: string;
  dossiers?: { id: string; title: string; code: string | null }[];
}

type ChannelFilter = "all" | "email" | "whatsapp" | "phone" | "sms" | "internal" | "note";

interface UnifiedEntry {
  id: string;
  type: "message" | "note";
  channel: string;
  direction: string;
  sender: string;
  subject?: string | null;
  body?: string | null;
  created_at: string;
  inbound_email_id?: string | null;
  attachments?: any[];
  dossier?: { code: string | null; title: string } | null;
  author?: { full_name: string | null; email: string | null } | null;
  noteType?: string;
  delivery_status?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
}

const channelIcons: Record<string, React.ElementType> = {
  email: Mail,
  whatsapp: MessageSquare,
  phone: Phone,
  sms: MessageSquare,
  internal: MessageSquare,
  note: StickyNote,
  appel: Phone,
  rdv: StickyNote,
};

const channelLabels: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  phone: "Appel",
  sms: "SMS",
  internal: "Interne",
  note: "Note",
  appel: "Appel",
  rdv: "RDV",
};

const channelColors: Record<string, string> = {
  email: "bg-info/10 text-info",
  whatsapp: "bg-success/10 text-success",
  phone: "bg-warning/10 text-warning",
  sms: "bg-primary/10 text-primary",
  internal: "bg-muted text-muted-foreground",
  note: "bg-accent text-accent-foreground",
  appel: "bg-warning/10 text-warning",
  rdv: "bg-primary/10 text-primary",
};

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

const formatDateGroup = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

export const ClientCommunicationPanel = ({
  clientId, clientName, clientEmail, clientPhone, clientMobile, companyId, dossiers = [],
}: Props) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current } = useCompany();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Compose state
  const [composeMode, setComposeMode] = useState<"none" | "email" | "note" | "sms" | "whatsapp">("none");
  const [noteType, setNoteType] = useState("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState("cordial");
  const [dossierId, setDossierId] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email accounts for bridge sending
  const [emailAccounts, setEmailAccounts] = useState<Array<{ id: string; label: string; email_address: string; is_default: boolean; status: string }>>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  useEffect(() => {
    if (composeMode !== "email" || !companyId) return;
    const fetchAccounts = async () => {
      const { data } = await supabase
        .from("email_accounts")
        .select("id, label, email_address, is_default, status")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("is_default", { ascending: false });
      if (data && data.length > 0) {
        setEmailAccounts(data);
        const def = data.find(a => a.is_default) || data[0];
        setSelectedAccountId(def.id);
      } else {
        setEmailAccounts([]);
        setSelectedAccountId("");
      }
    };
    fetchAccounts();
  }, [composeMode, companyId]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 10 * 1024 * 1024; // 10MB per file
    const valid = files.filter(f => {
      if (f.size > maxSize) {
        toast.error(`${f.name} dépasse 10MB`);
        return false;
      }
      return true;
    });
    setAttachedFiles(prev => [...prev, ...valid].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removeFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const filesToBase64 = async (files: File[]): Promise<Array<{ filename: string; content_type: string; content_base64: string; size: number }>> => {
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

  // Fetch messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["client-messages", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, inbound_emails(id, subject, ai_analysis, attachments)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Fetch direct inbound emails
  const { data: directEmails = [], isLoading: emailsLoading } = useQuery({
    queryKey: ["client-inbound-emails", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_emails")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Fetch notes
  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["client-notes", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_notes")
        .select("*, profiles:author_id(full_name, email), dossiers:dossier_id(code, title)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const isLoading = messagesLoading || emailsLoading || notesLoading;

  // Merge all entries into unified timeline
  const allEntries = useMemo(() => {
    const entries: UnifiedEntry[] = [];

    // Messages
    const messageEmailIds = new Set(messages.map((m: any) => m.inbound_email_id).filter(Boolean));
    messages.forEach((m: any) => {
      const msgAttachments = m.attachments && Array.isArray(m.attachments) && m.attachments.length > 0
        ? m.attachments
        : m.inbound_emails?.attachments
          ? (Array.isArray(m.inbound_emails.attachments) ? m.inbound_emails.attachments : [])
          : [];
      entries.push({
        id: m.id,
        type: "message",
        channel: m.channel,
        direction: m.direction,
        sender: m.sender || (m.direction === "inbound" ? "Client" : "Vous"),
        subject: m.subject || m.inbound_emails?.subject,
        body: m.body,
        created_at: m.created_at,
        inbound_email_id: m.inbound_email_id,
        attachments: msgAttachments,
        delivery_status: m.delivery_status || null,
        delivered_at: m.delivered_at || null,
        read_at: m.read_at || null,
      });
    });

    // Direct inbound emails not linked via messages
    directEmails
      .filter((e: any) => !messageEmailIds.has(e.id))
      .forEach((e: any) => {
        entries.push({
          id: `ie-${e.id}`,
          type: "message",
          channel: "email",
          direction: "inbound",
          sender: e.from_name || e.from_email || "Inconnu",
          subject: e.subject,
          body: e.body_text?.substring(0, 300),
          created_at: e.created_at,
          inbound_email_id: e.id,
          attachments: Array.isArray(e.attachments) ? e.attachments : [],
        });
      });

    // Notes
    notes.forEach((n: any) => {
      const author = n.profiles as any;
      const dossier = n.dossiers as any;
      entries.push({
        id: `note-${n.id}`,
        type: "note",
        channel: n.note_type || "note",
        direction: "internal",
        sender: author?.full_name || author?.email || "Équipe",
        body: n.content,
        created_at: n.created_at,
        noteType: n.note_type,
        dossier: dossier ? { code: dossier.code, title: dossier.title } : null,
        author,
      });
    });

    return entries.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages, directEmails, notes]);

  // Apply filters
  const filteredEntries = useMemo(() => {
    let result = allEntries;

    if (channelFilter !== "all") {
      if (channelFilter === "note") {
        result = result.filter((e) => e.type === "note");
      } else {
        result = result.filter((e) => e.type === "message" && e.channel === channelFilter);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.body?.toLowerCase().includes(q) ||
          e.subject?.toLowerCase().includes(q) ||
          e.sender?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allEntries, channelFilter, searchQuery]);

  // Group by date
  const groupedEntries = useMemo(() => {
    const groups: { date: string; entries: UnifiedEntry[] }[] = [];
    let currentDate = "";
    filteredEntries.forEach((entry) => {
      const dateGroup = formatDateGroup(entry.created_at);
      if (dateGroup !== currentDate) {
        currentDate = dateGroup;
        groups.push({ date: dateGroup, entries: [] });
      }
      groups[groups.length - 1].entries.push(entry);
    });
    return groups;
  }, [filteredEntries]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && !isLoading) {
      const el = scrollRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [filteredEntries.length, isLoading]);

  const selectedAccount = emailAccounts.find(a => a.id === selectedAccountId);
  const hasBridgeAccount = emailAccounts.length > 0 && !!selectedAccountId;

  // Send email
  const handleSendEmail = async () => {
    if (!clientEmail) {
      toast.error("Aucun email pour ce client");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error("Sujet et contenu requis");
      return;
    }
    setSending(true);
    try {
      const emailAttachments = attachedFiles.length > 0 ? await filesToBase64(attachedFiles) : undefined;

      if (hasBridgeAccount) {
        // Send via email bridge (user's own SMTP/OAuth account)
        const bodyHtml = `<div style="font-family:sans-serif;white-space:pre-wrap;color:#333;font-size:15px;line-height:1.7;">${body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>`;
        const { data, error } = await supabase.functions.invoke("email-bridge-send", {
          body: {
            account_id: selectedAccountId,
            to: [{ email: clientEmail }],
            subject,
            body_html: bodyHtml,
            body_text: body,
            client_id: clientId,
            ...(emailAttachments?.length ? { attachments: emailAttachments } : {}),
          },
        });
        if (error || data?.error) throw new Error(data?.error || "Erreur d'envoi");
      } else {
        // Fallback: send via Resend (noreply)
        const { data, error } = await supabase.functions.invoke("send-visite-email", {
          body: {
            to: clientEmail,
            subject,
            body,
            companyId,
            ...(emailAttachments?.length ? { attachments: emailAttachments } : {}),
          },
        });
        if (error || data?.error) throw new Error(data?.error || "Erreur d'envoi");

        const attachmentsMeta = attachedFiles.map(f => ({ filename: f.name, content_type: f.type, size: f.size }));
        await supabase.from("messages").insert({
          company_id: companyId,
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

      toast.success("Email envoyé");
      setSubject("");
      setBody("");
      setAttachedFiles([]);
      setComposeMode("none");
      queryClient.invalidateQueries({ queryKey: ["client-messages", clientId] });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  // Normalize phone to E.164 format (French default)
  const normalizePhone = (phone: string): string => {
    let cleaned = phone.replace(/[\s.\-()]/g, "");
    if (cleaned.startsWith("0") && cleaned.length === 10) {
      cleaned = "+33" + cleaned.slice(1);
    }
    if (!cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    }
    return cleaned;
  };

  // Send SMS or WhatsApp
  const handleSendSmsWhatsapp = async (channel: "sms" | "whatsapp") => {
    const rawPhone = clientMobile || clientPhone;
    if (!rawPhone) {
      toast.error("Aucun numéro de téléphone pour ce client");
      return;
    }
    if (!body.trim()) {
      toast.error("Message requis");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms-whatsapp", {
        body: {
          channel,
          to: normalizePhone(rawPhone),
          body: body.trim(),
          clientId,
          companyId,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erreur d'envoi");

      toast.success(`${channel === "whatsapp" ? "WhatsApp" : "SMS"} envoyé`);
      setBody("");
      setComposeMode("none");
      queryClient.invalidateQueries({ queryKey: ["client-messages", clientId] });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  // Add note
  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!body.trim() || !user) return;
      const { error } = await supabase.from("client_notes").insert({
        client_id: clientId,
        company_id: companyId,
        author_id: user.id,
        content: body.trim(),
        note_type: noteType,
        dossier_id: dossierId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note ajoutée");
      setBody("");
      setComposeMode("none");
      setDossierId("");
      queryClient.invalidateQueries({ queryKey: ["client-notes", clientId] });
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  // AI draft
  const handleDraft = async () => {
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: {
          context: { clientName, subject: subject || "Message", existingBody: body || undefined },
          tone,
          intent: "custom",
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

  const filterButtons: { key: ChannelFilter; label: string; icon: React.ElementType }[] = [
    { key: "all", label: "Tout", icon: MessageSquare },
    { key: "email", label: "Emails", icon: Mail },
    { key: "phone", label: "Appels", icon: Phone },
    { key: "note", label: "Notes", icon: StickyNote },
    { key: "sms", label: "SMS", icon: MessageSquare },
    { key: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  ];

  const renderBubble = (entry: UnifiedEntry) => {
    const isOutbound = entry.direction === "outbound";
    const isInternal = entry.type === "note" || entry.direction === "internal";
    const ChannelIcon = channelIcons[entry.channel] || MessageSquare;
    const hasAttachments = entry.attachments && entry.attachments.length > 0;

    return (
      <div
        key={entry.id}
        className={`flex ${isOutbound ? "justify-end" : isInternal ? "justify-center" : "justify-start"} mb-2`}
      >
        <div
          className={`max-w-[85%] rounded-2xl transition-colors ${
            isInternal
              ? "bg-accent/50 border border-accent px-4 py-2.5 max-w-[90%]"
              : isOutbound
                ? "bg-primary text-primary-foreground px-4 py-2.5"
                : "bg-card border px-4 py-2.5"
          } ${entry.inbound_email_id ? "cursor-pointer hover:opacity-90" : ""}`}
          onClick={() => {
            if (entry.inbound_email_id) {
              navigate(`/inbox?email=${entry.inbound_email_id}`);
            }
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-1">
            <ChannelIcon className={`h-3 w-3 ${isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"}`} />
            <span className={`text-[10px] font-medium ${isOutbound ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              {entry.sender}
            </span>
            <span className={`text-[10px] ${isOutbound ? "text-primary-foreground/60" : "text-muted-foreground/60"}`}>
              · {channelLabels[entry.channel] || entry.channel}
            </span>
            <span className={`text-[10px] ml-auto ${isOutbound ? "text-primary-foreground/60" : "text-muted-foreground/60"}`}>
              {formatTime(entry.created_at)}
            </span>
          </div>

          {/* Subject */}
          {entry.subject && (
            <p className={`text-xs font-semibold mb-0.5 ${isOutbound ? "text-primary-foreground" : ""}`}>
              {entry.subject}
            </p>
          )}

          {/* Dossier link for notes */}
          {entry.dossier && (
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium mb-1 ${
              isInternal ? "bg-muted text-muted-foreground" : isOutbound ? "bg-primary-foreground/10 text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              📂 {entry.dossier.code || entry.dossier.title}
            </span>
          )}

          {/* Body */}
          {entry.body && (
            <p className={`text-sm whitespace-pre-wrap leading-relaxed ${
              isOutbound ? "text-primary-foreground" : isInternal ? "text-foreground" : ""
            }`}>
              {entry.body.length > 300 ? entry.body.substring(0, 300) + "…" : entry.body}
            </p>
          )}

          {/* Attachments */}
          {hasAttachments && (
            <div className={`flex items-center gap-1 mt-1.5 text-[10px] ${isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
              <Paperclip className="h-3 w-3" />
              {entry.attachments!.length} pièce{entry.attachments!.length > 1 ? "s" : ""} jointe{entry.attachments!.length > 1 ? "s" : ""}
            </div>
          )}

          {/* Inbox link */}
          {entry.inbound_email_id && (
            <div className={`flex items-center gap-1 mt-1 text-[10px] ${isOutbound ? "text-primary-foreground/70" : "text-info"}`}>
              <ExternalLink className="h-3 w-3" />
              Voir dans l'inbox
            </div>
          )}

          {/* Delivery status */}
          {isOutbound && entry.type === "message" && (
            <div className="flex justify-end mt-1">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-0.5">
                      {entry.delivery_status === "read" ? (
                        <CheckCheck className="h-3.5 w-3.5 text-blue-400" />
                      ) : entry.delivery_status === "delivered" ? (
                        <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/60" />
                      ) : entry.delivery_status === "failed" ? (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <Check className="h-3.5 w-3.5 text-primary-foreground/60" />
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs">
                    {entry.delivery_status === "read" && entry.read_at
                      ? `Lu le ${new Date(entry.read_at).toLocaleString("fr-FR")}`
                      : entry.delivery_status === "delivered" && entry.delivered_at
                        ? `Remis le ${new Date(entry.delivered_at).toLocaleString("fr-FR")}`
                        : entry.delivery_status === "failed"
                          ? "Échec d'envoi"
                          : "Envoyé"
                    }
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col bg-background ${isMobile ? "h-[70vh]" : "h-[calc(100vh-200px)]"} rounded-xl border overflow-hidden`}>
      {/* Header */}
      <div className="shrink-0 border-b bg-card px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Échanges</h3>
            <Badge variant="secondary" className="text-[10px] h-5">
              {allEntries.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className={`h-3.5 w-3.5 ${showFilters || channelFilter !== "all" ? "text-primary" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans les échanges…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-8 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex gap-1 flex-wrap">
            {filterButtons.map((f) => (
              <button
                key={f.key}
                onClick={() => setChannelFilter(f.key)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                  channelFilter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <f.icon className="h-3 w-3" />
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : ""}`}>
                <Skeleton className="h-16 w-3/4 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageSquare className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground text-sm">
              {searchQuery || channelFilter !== "all"
                ? "Aucun résultat trouvé"
                : "Aucun échange avec ce client"}
            </p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              {searchQuery || channelFilter !== "all"
                ? "Essayez un autre filtre"
                : "Commencez la conversation"}
            </p>
          </div>
        ) : (
          groupedEntries.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground font-medium px-2 bg-background">
                  {group.date}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {group.entries.map(renderBubble)}
            </div>
          ))
        )}
      </div>

      {/* Compose area */}
      <div className="shrink-0 border-t bg-card px-3 py-2.5 space-y-2">
        {composeMode === "none" ? (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-9"
              onClick={() => setComposeMode("email")}
            >
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Email
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-9"
              onClick={() => setComposeMode("sms")}
              disabled={!clientPhone && !clientMobile}
            >
              <Phone className="h-3.5 w-3.5 mr-1.5" />
              SMS
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-9"
              onClick={() => setComposeMode("whatsapp")}
              disabled={!clientPhone && !clientMobile}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-9"
              onClick={() => setComposeMode("note")}
            >
              <StickyNote className="h-3.5 w-3.5 mr-1.5" />
              Note
            </Button>
          </div>
        ) : composeMode === "note" ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {(["note", "appel", "rdv"] as const).map((t) => {
                  const Icon = channelIcons[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setNoteType(t)}
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                        noteType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {channelLabels[t]}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => { setComposeMode("none"); setBody(""); }} className="text-[10px] text-muted-foreground hover:underline">
                Annuler
              </button>
            </div>
            {dossiers.length > 0 && (
              <select
                value={dossierId}
                onChange={(e) => setDossierId(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Général</option>
                {dossiers.map((d) => (
                  <option key={d.id} value={d.id}>{d.code || d.title}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Écrire une note, CR d'appel…"
                rows={2}
                className="text-xs flex-1 resize-none min-h-[56px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) {
                    addNoteMutation.mutate();
                  }
                }}
              />
              <Button
                size="icon"
                className="h-14 w-10 shrink-0"
                onClick={() => addNoteMutation.mutate()}
                disabled={!body.trim() || addNoteMutation.isPending}
              >
                {addNoteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        ) : composeMode === "sms" || composeMode === "whatsapp" ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                {composeMode === "whatsapp" ? "💬 WhatsApp" : "📱 SMS"} → {clientMobile || clientPhone}
              </span>
              <button onClick={() => { setComposeMode("none"); setBody(""); }} className="text-[10px] text-muted-foreground hover:underline">
                Annuler
              </button>
            </div>
            <div className="flex gap-2">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={`Écrire un ${composeMode === "whatsapp" ? "WhatsApp" : "SMS"}…`}
                rows={2}
                className="text-xs flex-1 resize-none min-h-[56px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) {
                    handleSendSmsWhatsapp(composeMode);
                  }
                }}
              />
              <Button
                size="icon"
                className="h-14 w-10 shrink-0"
                onClick={() => handleSendSmsWhatsapp(composeMode)}
                disabled={sending || !body.trim()}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {!clientPhone && !clientMobile && (
              <p className="text-[10px] text-destructive">⚠ Aucun numéro renseigné pour ce client.</p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Nouvel email</span>
              <button onClick={() => { setComposeMode("none"); setBody(""); setSubject(""); setAttachedFiles([]); }} className="text-[10px] text-muted-foreground hover:underline">
                Annuler
              </button>
            </div>

            {/* Email account selector */}
            {emailAccounts.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="h-7 text-[10px] flex-1">
                    <SelectValue placeholder="Compte…" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        <span className="flex items-center gap-1">
                          <span>{acc.label}</span>
                          <span className="text-muted-foreground">({acc.email_address})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {emailAccounts.length === 0 && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Aucun compte configuré — envoi via adresse par défaut
              </p>
            )}

            <Input
              placeholder="Objet"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-8 text-xs"
            />
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Contenu du message…"
              rows={3}
              className="text-xs resize-none min-h-[72px]"
            />

            {/* Attached files list */}
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

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] px-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-3 w-3 mr-1" />
                Joindre
              </Button>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="w-[100px] h-7 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cordial">Cordial</SelectItem>
                  <SelectItem value="formel">Formel</SelectItem>
                  <SelectItem value="relance">Relance</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={handleDraft} disabled={drafting}>
                {drafting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                IA
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleSendEmail}
                disabled={sending || !body.trim() || !subject.trim()}
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                Envoyer
                {selectedAccount && <span className="ml-1 text-[10px] opacity-70">via {selectedAccount.email_address}</span>}
              </Button>
            </div>
            {!clientEmail && (
              <p className="text-[10px] text-destructive">⚠ Aucun email renseigné pour ce client.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
