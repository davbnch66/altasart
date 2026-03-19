import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Inbox, MailWarning, Loader2, ArrowUpDown, Eye, CheckCircle2,
  Trash2, Star, StarOff, Archive, Reply, Forward, Send, Menu, X, Filter,
  MailOpen, MailX, FolderInput, Tag
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InboxEmailDetail } from "@/components/inbox/InboxEmailDetail";
import { InboxSidebar, type MailFolder, type EmailAccount, type EmailLabel } from "@/components/inbox/InboxSidebar";
import { DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { InboxComposeDialog } from "@/components/inbox/InboxComposeDialog";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";

type CategoryTab = "principal" | "autre";
type SortKey = "date_desc" | "date_asc" | "name_asc" | "name_desc" | "status";
type ReadFilter = "all" | "unread" | "read";

type InfiniteEmailsData = {
  pages: Array<{
    emails: any[];
    totalCount: number;
    page: number;
  }>;
  pageParams: number[];
};

const PAGE_SIZE = 30;

const statusLabels: Record<string, string> = {
  pending: "Non traité",
  processing: "Analyse…",
  processed: "Traité",
  error: "Erreur",
};

const statusStyles: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  processing: "bg-info/10 text-info",
  processed: "bg-success/10 text-success",
  error: "bg-destructive/10 text-destructive",
};

const sortLabels: Record<SortKey, string> = {
  date_desc: "Plus récent",
  date_asc: "Plus ancien",
  name_asc: "Expéditeur A→Z",
  name_desc: "Expéditeur Z→A",
  status: "Par statut",
};

const readFilterLabels: Record<ReadFilter, string> = {
  all: "Tous",
  unread: "Non lus",
  read: "Lus",
};

const isBusinessRelevant = (email: any): boolean => {
  const types: string[] = email.ai_analysis?.type_demande || [];
  if (types.length === 0) return true;
  return types.some((t: string) => t !== "autre");
};

const InboxPage = () => {
  const isMobile = useIsMobile();
  const { current, dbCompanies } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEmailId = searchParams.get("email");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryTab>("principal");
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all | pending | processed
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Mail client state
  const [currentFolder, setCurrentFolder] = useState<MailFolder>("inbox");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyData, setReplyData] = useState<any>(null);
  const [forwardData, setForwardData] = useState<any>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [draggedEmailIds, setDraggedEmailIds] = useState<string[]>([]);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  useEffect(() => {
    setSelectedIds(new Set());
    setPendingDeleteIds([]);
    setSelectionMode(false);
    setDeleteDialogOpen(false);
  }, [category, currentFolder]);

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      const map: Record<string, { full_name: string | null; email: string | null }> = {};
      (data || []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
  });

  // ============ EMAIL ACCOUNTS ============
  const { data: emailAccounts = [] } = useQuery<EmailAccount[]>({
    queryKey: ["email-accounts-list", companyIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_accounts")
        .select("id, label, email_address, provider, status")
        .in("company_id", companyIds)
        .in("status", ["active", "testing"])
        .order("is_default", { ascending: false });
      return (data || []) as EmailAccount[];
    },
    enabled: companyIds.length > 0,
  });

  // Build email address to account map
  const emailToAccountMap = useMemo(() => {
    const map: Record<string, EmailAccount> = {};
    emailAccounts.forEach((a) => {
      map[a.email_address.toLowerCase()] = a;
    });
    return map;
  }, [emailAccounts]);

  const emailAccountsMap = useMemo(() => {
    const map: Record<string, EmailAccount> = {};
    emailAccounts.forEach((a) => { map[a.id] = a; });
    return map;
  }, [emailAccounts]);

  // ============ EMAIL LABELS ============
  const { data: emailLabels = [] } = useQuery<EmailLabel[]>({
    queryKey: ["email-labels", companyIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_labels")
        .select("*")
        .in("company_id", companyIds)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as EmailLabel[];
    },
    enabled: companyIds.length > 0,
  });

  // Determine which folder filter to apply for inbound_emails
  const isLabelFolder = currentFolder.startsWith("label:");
  const activeLabelId = isLabelFolder ? currentFolder.replace("label:", "") : null;
  const isInboxLikeFolder = currentFolder === "inbox" || currentFolder === "archive" || currentFolder === "trash" || isLabelFolder;

  // ============ INBOX (inbound_emails) ============
  const {
    data: inboundData,
    isLoading: inboundLoading,
    fetchNextPage: fetchNextInbound,
    hasNextPage: hasNextInbound,
    isFetchingNextPage: isFetchingNextInbound,
  } = useInfiniteQuery({
    queryKey: ["inbound-emails", companyIds, currentFolder],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from("inbound_emails")
        .select("*, clients(name, id)", { count: "exact" })
        .in("company_id", companyIds)
        .order("created_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      // Apply folder filter
      if (currentFolder === "inbox") {
        query = query.eq("folder", "inbox");
      } else if (currentFolder === "archive") {
        query = query.eq("folder", "archive");
      } else if (currentFolder === "trash") {
        query = query.eq("folder", "trash");
      } else if (isLabelFolder && activeLabelId) {
        query = query.eq("label_id", activeLabelId);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { emails: data || [], totalCount: count || 0, page: pageParam };
    },
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      return nextPage < Math.ceil(lastPage.totalCount / PAGE_SIZE) ? nextPage : undefined;
    },
    initialPageParam: 0,
    enabled: companyIds.length > 0 && isInboxLikeFolder,
  });

  // ============ SENT (email_outbox) ============
  const {
    data: sentData,
    isLoading: sentLoading,
    fetchNextPage: fetchNextSent,
    hasNextPage: hasNextSent,
    isFetchingNextPage: isFetchingNextSent,
  } = useInfiniteQuery({
    queryKey: ["sent-emails", companyIds],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error, count } = await supabase
        .from("email_outbox")
        .select("*, clients(name, id)", { count: "exact" })
        .in("company_id", companyIds)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { emails: data || [], totalCount: count || 0, page: pageParam };
    },
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      return nextPage < Math.ceil(lastPage.totalCount / PAGE_SIZE) ? nextPage : undefined;
    },
    initialPageParam: 0,
    enabled: companyIds.length > 0 && currentFolder === "sent",
  });

  // ============ DRAFTS (email_outbox status=draft) ============
  const {
    data: draftsData,
    isLoading: draftsLoading,
    fetchNextPage: fetchNextDrafts,
    hasNextPage: hasNextDrafts,
    isFetchingNextPage: isFetchingNextDrafts,
  } = useInfiniteQuery({
    queryKey: ["draft-emails", companyIds],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error, count } = await supabase
        .from("email_outbox")
        .select("*, clients(name, id)", { count: "exact" })
        .in("company_id", companyIds)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { emails: data || [], totalCount: count || 0, page: pageParam };
    },
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      return nextPage < Math.ceil(lastPage.totalCount / PAGE_SIZE) ? nextPage : undefined;
    },
    initialPageParam: 0,
    enabled: companyIds.length > 0 && currentFolder === "drafts",
  });

  // ============ SYNCED EMAILS ============
  const { data: syncedData, isLoading: syncedLoading } = useInfiniteQuery({
    queryKey: ["synced-emails", companyIds, currentFolder],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from("synced_emails")
        .select("*, clients(name, id)", { count: "exact" })
        .in("company_id", companyIds)
        .order("received_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (currentFolder === "sent") {
        query = query.eq("direction", "outbound");
      } else if (currentFolder === "inbox") {
        query = query.eq("direction", "inbound");
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { emails: data || [], totalCount: count || 0, page: pageParam };
    },
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      return nextPage < Math.ceil(lastPage.totalCount / PAGE_SIZE) ? nextPage : undefined;
    },
    initialPageParam: 0,
    enabled: companyIds.length > 0 && (currentFolder === "sent" || currentFolder === "inbox"),
  });

  const allInboundEmails = useMemo(() => inboundData?.pages.flatMap((p) => p.emails) || [], [inboundData]);
  const allSentEmails = useMemo(() => sentData?.pages.flatMap((p) => p.emails) || [], [sentData]);
  const allDraftEmails = useMemo(() => draftsData?.pages.flatMap((p) => p.emails) || [], [draftsData]);
  const allSyncedEmails = useMemo(() => syncedData?.pages.flatMap((p) => p.emails) || [], [syncedData]);

  // Enrich inbound emails with receiving account info (match to_email → email_accounts)
  const mergedInboxEmails = useMemo(() => {
    return allInboundEmails.map((email: any) => {
      const toEmail = email.to_email?.toLowerCase();
      const matchedAccount = toEmail ? emailToAccountMap[toEmail] : null;
      return {
        ...email,
        _account_id: matchedAccount?.id || null,
        _account: matchedAccount || null,
      };
    });
  }, [allInboundEmails, emailToAccountMap]);

  // Build merged sent from email_outbox + synced_emails (outbound)
  const mergedSentEmails = useMemo(() => {
    const outboxEmails = allSentEmails.map((email: any) => ({
      id: email.id,
      subject: email.subject,
      from_email: null,
      from_name: null,
      to_recipients: email.to_recipients,
      body_html: email.body_html,
      body_text: email.body_text,
      created_at: email.sent_at || email.created_at,
      status: "sent",
      is_read: true,
      _account_id: email.account_id,
      _account: emailAccountsMap[email.account_id] || null,
      _type: "outbox" as const,
      clients: email.clients,
    }));

    const syncedOutbound = allSyncedEmails
      .filter((e: any) => e.direction === "outbound")
      .map((email: any) => ({
        id: email.id,
        subject: email.subject,
        from_email: email.from_email,
        from_name: email.from_name,
        to_recipients: email.to_emails,
        body_html: email.body_html,
        body_text: email.body_text,
        created_at: email.received_at,
        status: "sent",
        is_read: true,
        _account_id: email.email_account_id,
        _account: emailAccountsMap[email.email_account_id] || null,
        _type: "synced" as const,
        clients: email.clients,
      }));

    const all = [...outboxEmails, ...syncedOutbound];
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return all;
  }, [allSentEmails, allSyncedEmails, emailAccountsMap]);

  // Current dataset based on folder
  const currentDataset = useMemo(() => {
    if (isInboxLikeFolder) return mergedInboxEmails;
    if (currentFolder === "sent") return mergedSentEmails;
    if (currentFolder === "drafts") return allDraftEmails;
    return mergedInboxEmails;
  }, [currentFolder, isInboxLikeFolder, mergedInboxEmails, mergedSentEmails, allDraftEmails]);

  const currentIsLoading = isInboxLikeFolder ? inboundLoading
    : currentFolder === "sent" ? (sentLoading || syncedLoading)
    : currentFolder === "drafts" ? draftsLoading
    : inboundLoading;

  const { data: emailActions = [] } = useQuery({
    queryKey: ["email-actions", selectedEmailId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_actions")
        .select("*")
        .eq("inbound_email_id", selectedEmailId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedEmailId && isInboxLikeFolder,
  });

  // Mark as read
  useEffect(() => {
    if (!selectedEmailId || !user || !isInboxLikeFolder) return;
    const email = allInboundEmails.find((e: any) => e.id === selectedEmailId);
    if (email && !email.is_read) {
      supabase
        .from("inbound_emails")
        .update({ is_read: true, read_by: user.id, read_at: new Date().toISOString() })
        .eq("id", selectedEmailId)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
          queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
        });
    }
  }, [selectedEmailId, user, allInboundEmails, queryClient, currentFolder, isInboxLikeFolder]);

  // Category filtering for inbox only
  const principalEmails = currentDataset.filter(isBusinessRelevant);
  const autreEmails = currentDataset.filter((email: any) => !isBusinessRelevant(email));
  const categoryFiltered = currentFolder === "inbox"
    ? (category === "principal" ? principalEmails : autreEmails)
    : currentDataset;

  // Account filtering — match by _account_id
  const accountFiltered = selectedAccountIds.length > 0
    ? categoryFiltered.filter((email: any) => {
        const accountId = email._account_id || email.account_id;
        return accountId && selectedAccountIds.includes(accountId);
      })
    : categoryFiltered;

  // Read filter
  const readFiltered = useMemo(() => {
    if (readFilter === "all") return accountFiltered;
    if (readFilter === "unread") return accountFiltered.filter((e: any) => !e.is_read);
    return accountFiltered.filter((e: any) => !!e.is_read);
  }, [accountFiltered, readFilter]);

  // Status filter (inbox only)
  const statusFiltered = useMemo(() => {
    if (statusFilter === "all" || currentFolder !== "inbox") return readFiltered;
    return readFiltered.filter((e: any) => e.status === statusFilter);
  }, [readFiltered, statusFilter, currentFolder]);

  // Search
  const searchedEmails = statusFiltered.filter((email: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const toStr = currentFolder === "sent"
      ? (Array.isArray(email.to_recipients)
          ? email.to_recipients.map((r: any) => r.email || r).join(" ")
          : "")
      : "";
    return (
      email.subject?.toLowerCase().includes(q) ||
      email.from_name?.toLowerCase().includes(q) ||
      email.from_email?.toLowerCase().includes(q) ||
      toStr.toLowerCase().includes(q) ||
      (email.clients as any)?.name?.toLowerCase().includes(q)
    );
  });

  // Sort
  const filteredEmails = useMemo(() => {
    const sorted = [...searchedEmails];
    switch (sortKey) {
      case "date_desc":
        sorted.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "date_asc":
        sorted.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "name_asc":
        sorted.sort((a: any, b: any) => (a.from_name || a.from_email || "").localeCompare(b.from_name || b.from_email || ""));
        break;
      case "name_desc":
        sorted.sort((a: any, b: any) => (b.from_name || b.from_email || "").localeCompare(a.from_name || a.from_email || ""));
        break;
      case "status":
        sorted.sort((a: any, b: any) => (a.status || "").localeCompare(b.status || ""));
        break;
    }
    return sorted;
  }, [searchedEmails, sortKey]);

  const selectedEmail: any = isInboxLikeFolder
    ? mergedInboxEmails.find((e: any) => e.id === selectedEmailId)
    : currentFolder === "sent"
    ? mergedSentEmails.find((e: any) => e.id === selectedEmailId)
    : allDraftEmails.find((e: any) => e.id === selectedEmailId);

  const unreadPrincipalCount = mergedInboxEmails.filter(isBusinessRelevant).filter((e: any) => !e.is_read).length;
  const allVisibleSelected = filteredEmails.length > 0 && filteredEmails.every((email: any) => selectedIds.has(email.id));
  const someSelected = selectedIds.size > 0;

  const unreadCounts: Record<string, number> = {
    inbox: unreadPrincipalCount,
    sent: 0,
    drafts: allDraftEmails.length,
    trash: 0,
    archive: 0,
    starred: 0,
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setPendingDeleteIds([]);
    setDeleteDialogOpen(false);
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredEmails.map((email: any) => email.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openDeleteDialog = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { toast.error("Sélectionnez au moins un email"); return; }
    setPendingDeleteIds(ids);
    setDeleteDialogOpen(true);
  };

  const removeEmailsFromCache = useCallback((idsToRemove: string[]) => {
    queryClient.setQueryData<InfiniteEmailsData | undefined>(["inbound-emails", companyIds], (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          totalCount: Math.max(0, page.totalCount - idsToRemove.length),
          emails: page.emails.filter((email: any) => !idsToRemove.includes(email.id)),
        })),
      };
    });
  }, [companyIds, queryClient]);

  const handleDeleteSelected = async () => {
    const ids = [...pendingDeleteIds];
    if (ids.length === 0) { toast.error("Aucun email sélectionné"); setDeleteDialogOpen(false); return; }
    setIsDeleting(true);
    try {
      const { error: actionsError } = await supabase.from("email_actions").delete().in("inbound_email_id", ids);
      if (actionsError) throw actionsError;
      const { error: messagesError } = await supabase.from("messages").delete().in("inbound_email_id", ids);
      if (messagesError) throw messagesError;
      const { data: deletedEmails, error: deleteError } = await supabase.from("inbound_emails").delete().in("id", ids).select("id");
      if (deleteError) throw deleteError;
      const deletedIds = (deletedEmails || []).map((email) => email.id);
      if (deletedIds.length === 0) throw new Error("Aucun email n'a été supprimé");
      removeEmailsFromCache(deletedIds);
      toast.success(`${deletedIds.length} email${deletedIds.length > 1 ? "s" : ""} supprimé${deletedIds.length > 1 ? "s" : ""}`);
      exitSelectionMode();
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    } catch (error) {
      console.error(error);
      toast.error("La suppression a échoué");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // ============ BULK ACTIONS ============
  const handleBulkMarkRead = async (markAsRead: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const updateData: any = { is_read: markAsRead };
      if (markAsRead && user) {
        updateData.read_by = user.id;
        updateData.read_at = new Date().toISOString();
      } else if (!markAsRead) {
        updateData.read_by = null;
        updateData.read_at = null;
      }
      const { error } = await supabase
        .from("inbound_emails")
        .update(updateData)
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} email${ids.length > 1 ? "s" : ""} marqué${ids.length > 1 ? "s" : ""} comme ${markAsRead ? "lu" : "non lu"}${ids.length > 1 ? "s" : ""}`);
      exitSelectionMode();
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleBulkMoveFolder = async (targetFolder: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const { error } = await supabase
        .from("inbound_emails")
        .update({ folder: targetFolder })
        .in("id", ids);
      if (error) throw error;
      const folderNames: Record<string, string> = { inbox: "Réception", archive: "Archives", trash: "Corbeille" };
      toast.success(`${ids.length} email${ids.length > 1 ? "s" : ""} déplacé${ids.length > 1 ? "s" : ""} vers ${folderNames[targetFolder] || targetFolder}`);
      exitSelectionMode();
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du déplacement");
    }
  };

  const handleBulkAssignLabel = async (labelId: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const { error } = await supabase
        .from("inbound_emails")
        .update({ label_id: labelId })
        .in("id", ids);
      if (error) throw error;
      const label = emailLabels.find((l) => l.id === labelId);
      toast.success(`${ids.length} email${ids.length > 1 ? "s" : ""} classé${ids.length > 1 ? "s" : ""} dans "${label?.name || "dossier"}"`);
      exitSelectionMode();
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du classement");
    }
  };

  // ============ DRAG & DROP TO FOLDERS ============
  const handleDropEmails = useCallback(async (targetFolder?: string, targetLabelId?: string) => {
    const ids = draggedEmailIds.length > 0 ? draggedEmailIds : Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      if (targetLabelId) {
        const { error } = await supabase
          .from("inbound_emails")
          .update({ label_id: targetLabelId })
          .in("id", ids);
        if (error) throw error;
        const label = emailLabels.find((l) => l.id === targetLabelId);
        toast.success(`${ids.length} email${ids.length > 1 ? "s" : ""} classé${ids.length > 1 ? "s" : ""} dans "${label?.name || "dossier"}"`);
      } else if (targetFolder) {
        const { error } = await supabase
          .from("inbound_emails")
          .update({ folder: targetFolder })
          .in("id", ids);
        if (error) throw error;
        const folderNames: Record<string, string> = { inbox: "Réception", archive: "Archives", trash: "Corbeille" };
        toast.success(`${ids.length} email${ids.length > 1 ? "s" : ""} déplacé${ids.length > 1 ? "s" : ""} vers ${folderNames[targetFolder] || targetFolder}`);
      }
      setDraggedEmailIds([]);
      exitSelectionMode();
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du déplacement");
    }
  }, [draggedEmailIds, selectedIds, emailLabels, queryClient, exitSelectionMode]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
    queryClient.invalidateQueries({ queryKey: ["sent-emails"] });
    queryClient.invalidateQueries({ queryKey: ["draft-emails"] });
    queryClient.invalidateQueries({ queryKey: ["synced-emails"] });
    queryClient.invalidateQueries({ queryKey: ["email-actions"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
  };

  const handleRowClick = (emailId: string) => {
    if (selectionMode) { toggleSelect(emailId); return; }
    setSearchParams({ email: emailId });
  };

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccountIds((prev) => {
      if (prev.includes(accountId)) {
        return prev.filter((id) => id !== accountId);
      }
      return [...prev, accountId];
    });
  };

  const handleReply = (email: any) => {
    setReplyData({
      to: email.from_email || "",
      subject: email.subject || "",
      body: email.body_text || "",
      messageId: email.message_id || undefined,
      accountId: email._account_id || undefined,
    });
    setComposeOpen(true);
  };

  const handleForward = (email: any) => {
    setForwardData({
      subject: email.subject || "",
      body: email.body_text || "",
    });
    setComposeOpen(true);
  };

  const loadMore = useCallback(() => {
    if (isInboxLikeFolder && hasNextInbound && !isFetchingNextInbound) fetchNextInbound();
    if (currentFolder === "sent" && hasNextSent && !isFetchingNextSent) fetchNextSent();
    if (currentFolder === "drafts" && hasNextDrafts && !isFetchingNextDrafts) fetchNextDrafts();
  }, [currentFolder, isInboxLikeFolder, hasNextInbound, hasNextSent, hasNextDrafts, isFetchingNextInbound, isFetchingNextSent, isFetchingNextDrafts, fetchNextInbound, fetchNextSent, fetchNextDrafts]);

  const hasMore = isInboxLikeFolder ? hasNextInbound
    : currentFolder === "sent" ? hasNextSent
    : currentFolder === "drafts" ? hasNextDrafts
    : false;

  const isFetchingMore = isInboxLikeFolder ? isFetchingNextInbound
    : currentFolder === "sent" ? isFetchingNextSent
    : currentFolder === "drafts" ? isFetchingNextDrafts
    : false;

  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore: !!hasMore,
    isLoading: isFetchingMore,
  });

  // Sidebar props
  const sidebarProps = {
    currentFolder,
    onFolderChange: setCurrentFolder,
    selectedAccountIds,
    onAccountToggle: handleAccountToggle,
    onCompose: () => { setReplyData(null); setForwardData(null); setComposeOpen(true); },
    unreadCounts,
    accounts: emailAccounts,
  };

  // ============ EMAIL DETAIL VIEW ============
  if (selectedEmail && isInboxLikeFolder) {
    return (
      <div className="flex h-[calc(100vh-4rem)]">
        {!isMobile && <InboxSidebar {...sidebarProps} />}
        <div className={`flex-1 overflow-y-auto ${isMobile ? "p-3 pb-20" : "p-6"}`}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={() => setSearchParams({})} className="gap-1.5">
                ← Retour
              </Button>
              {/* Show receiving account */}
              {selectedEmail._account && (
                <Badge variant="outline" className="text-xs">
                  Reçu sur : {selectedEmail._account.email_address}
                </Badge>
              )}
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => handleReply(selectedEmail)} className="gap-1.5">
                <Reply className="h-4 w-4" /> Répondre
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleForward(selectedEmail)} className="gap-1.5">
                <Forward className="h-4 w-4" /> Transférer
              </Button>
            </div>
            <InboxEmailDetail
              email={selectedEmail}
              actions={emailActions}
              onBack={() => setSearchParams({})}
              onActionExecuted={handleRefresh}
            />
          </div>
        </div>
        <InboxComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          onSent={handleRefresh}
          replyTo={replyData}
          forwardData={forwardData}
        />
      </div>
    );
  }

  // SENT EMAIL DETAIL VIEW
  if (selectedEmail && currentFolder === "sent") {
    const recipients = Array.isArray(selectedEmail.to_recipients)
      ? selectedEmail.to_recipients.map((r: any) => r.email || r).join(", ")
      : "";
    return (
      <div className="flex h-[calc(100vh-4rem)]">
        {!isMobile && <InboxSidebar {...sidebarProps} />}
        <div className={`flex-1 overflow-y-auto ${isMobile ? "p-3 pb-20" : "p-6"}`}>
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSearchParams({})} className="gap-1.5">
                ← Retour
              </Button>
              {selectedEmail._account && (
                <Badge variant="outline" className="text-xs">
                  Envoyé via : {selectedEmail._account.email_address}
                </Badge>
              )}
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => handleForward(selectedEmail)} className="gap-1.5">
                <Forward className="h-4 w-4" /> Transférer
              </Button>
            </div>
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h2 className="text-lg font-bold">{selectedEmail.subject || "(sans objet)"}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Send className="h-3.5 w-3.5" />
                <span>À : {recipients}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(selectedEmail.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3">Contenu</h3>
              {selectedEmail.body_html ? (
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }} />
              ) : (
                <pre className="text-sm whitespace-pre-wrap font-sans">{selectedEmail.body_text || "(vide)"}</pre>
              )}
            </div>
          </div>
        </div>
        <InboxComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          onSent={handleRefresh}
          forwardData={forwardData}
        />
      </div>
    );
  }

  // ============ EMAIL LIST VIEW ============
  const activeLabelName = activeLabelId ? emailLabels.find((l) => l.id === activeLabelId)?.name : null;
  const folderTitle = currentFolder === "inbox" ? "Réception"
    : currentFolder === "sent" ? "Envoyés"
    : currentFolder === "drafts" ? "Brouillons"
    : currentFolder === "starred" ? "Suivis"
    : currentFolder === "archive" ? "Archives"
    : currentFolder === "trash" ? "Corbeille"
    : isLabelFolder ? (activeLabelName || "Dossier")
    : "Inbox";

  const providerColors: Record<string, string> = {
    gmail: "bg-red-500",
    outlook: "bg-blue-500",
    imap_smtp: "bg-muted-foreground",
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Mobile sidebar toggle */}
      {isMobile && (
        <AnimatePresence>
          {mobileSidebarOpen && (
            <motion.div
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              className="absolute inset-y-0 left-0 z-50 w-[240px] bg-card shadow-lg"
            >
              <div className="flex items-center justify-end p-2">
                <Button variant="ghost" size="sm" onClick={() => setMobileSidebarOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <InboxSidebar
                {...sidebarProps}
                onFolderChange={(folder) => { setCurrentFolder(folder); setMobileSidebarOpen(false); }}
                onCompose={() => { setReplyData(null); setForwardData(null); setComposeOpen(true); setMobileSidebarOpen(false); }}
                isMobile
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Desktop sidebar */}
      {!isMobile && <InboxSidebar {...sidebarProps} />}

      {/* Main content */}
      <div className={`flex-1 overflow-y-auto animate-fade-in ${isMobile ? "p-3 pb-20 space-y-3" : "p-5 space-y-4"}`}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button variant="ghost" size="sm" onClick={() => setMobileSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className={`font-bold ${isMobile ? "text-lg" : "text-xl"}`}>{folderTitle}</h1>
              {!isMobile && currentFolder === "inbox" && (
                <p className="text-xs text-muted-foreground">Emails entrants et actions suggérées par l'IA</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Category tabs (only for inbox) */}
        {currentFolder === "inbox" && (
          <div className="flex gap-1 border-b">
            <button
              onClick={() => setCategory("principal")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                category === "principal"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Inbox className="h-4 w-4" />
              Principal
              {unreadPrincipalCount > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px]">{unreadPrincipalCount}</Badge>
              )}
            </button>
            <button
              onClick={() => setCategory("autre")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                category === "autre"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <MailWarning className="h-4 w-4" />
              Autre
              {autreEmails.length > 0 && (
                <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px] text-muted-foreground">{autreEmails.length}</Badge>
              )}
            </button>
          </div>
        )}

        {/* Filters row: Search + Read filter + Status filter + Sort */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={currentFolder === "sent" ? "Rechercher par destinataire ou sujet…" : "Rechercher…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded-lg border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${isMobile ? "py-2 text-xs" : "py-2.5"}`}
            />
          </div>

          {/* Read filter (inbox only) */}
          {currentFolder === "inbox" && (
            <div className="flex rounded-lg border bg-card overflow-hidden">
              {(Object.keys(readFilterLabels) as ReadFilter[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setReadFilter(key)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    readFilter === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {readFilterLabels[key]}
                </button>
              ))}
            </div>
          )}

          {/* Status filter (inbox only) */}
          {currentFolder === "inbox" && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                <Filter className="h-3.5 w-3.5" />
                {statusFilter === "all" ? "Statut" : statusFilter === "processed" ? "Traité" : "Non traité"}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter("all")} className={statusFilter === "all" ? "font-semibold" : ""}>
                  Tous
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("processed")} className={statusFilter === "processed" ? "font-semibold" : ""}>
                  Traité
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pending")} className={statusFilter === "pending" ? "font-semibold" : ""}>
                  Non traité
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortLabels[sortKey]}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(sortLabels) as SortKey[]).map((key) => (
                <DropdownMenuItem key={key} onClick={() => setSortKey(key)} className={sortKey === key ? "font-semibold" : ""}>
                  {sortLabels[key]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Selection bar */}
        <AnimatePresence>
          {selectionMode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex items-center gap-2 flex-wrap rounded-lg border bg-muted/50 px-4 py-2.5">
                <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} />
                <span className="text-sm font-medium">{someSelected ? `${selectedIds.size} sélectionné${selectedIds.size > 1 ? "s" : ""}` : "Tout sélectionner"}</span>
                <div className="flex-1" />

                {someSelected && isInboxLikeFolder && (
                  <>
                    {/* Mark as read/unread */}
                    <Button variant="outline" size="sm" onClick={() => handleBulkMarkRead(true)} className="gap-1.5 text-xs">
                      <MailOpen className="h-3.5 w-3.5" /> Lu
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleBulkMarkRead(false)} className="gap-1.5 text-xs">
                      <MailX className="h-3.5 w-3.5" /> Non lu
                    </Button>

                    {/* Move to folder */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                          <FolderInput className="h-3.5 w-3.5" /> Déplacer
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {currentFolder !== "inbox" && (
                          <DropdownMenuItem onClick={() => handleBulkMoveFolder("inbox")} className="gap-2">
                            <Inbox className="h-3.5 w-3.5" /> Réception
                          </DropdownMenuItem>
                        )}
                        {currentFolder !== "archive" && (
                          <DropdownMenuItem onClick={() => handleBulkMoveFolder("archive")} className="gap-2">
                            <Archive className="h-3.5 w-3.5" /> Archives
                          </DropdownMenuItem>
                        )}
                        {currentFolder !== "trash" && (
                          <DropdownMenuItem onClick={() => handleBulkMoveFolder("trash")} className="gap-2">
                            <Trash2 className="h-3.5 w-3.5" /> Corbeille
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Assign label */}
                    {emailLabels.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                            <Tag className="h-3.5 w-3.5" /> Classer
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {emailLabels.map((label) => (
                            <DropdownMenuItem key={label.id} onClick={() => handleBulkAssignLabel(label.id)} className="gap-2">
                              <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: label.color }} />
                              {label.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {/* Delete */}
                    <Button variant="destructive" size="sm" onClick={openDeleteDialog} disabled={isDeleting} className="gap-1.5 text-xs">
                      <Trash2 className="h-3.5 w-3.5" /> Supprimer
                    </Button>
                  </>
                )}

                <Button variant="ghost" size="sm" onClick={exitSelectionMode} className="text-xs">Annuler</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email list */}
        {currentIsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : filteredEmails.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {currentFolder === "sent" ? "Aucun email envoyé" : currentFolder === "drafts" ? "Aucun brouillon" : "Aucun email"}
            </p>
          </motion.div>
        ) : (
          <>
            {currentFolder === "inbox" && category === "autre" && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <MailWarning className="h-3.5 w-3.5 shrink-0" />
                Ces emails ont été classés par l'IA comme non liés à vos métiers.
              </div>
            )}

            {!selectionMode && isInboxLikeFolder && (
              <div className="flex items-center px-5 py-1">
                <button onClick={() => setSelectionMode(true)} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                  Sélectionner
                </button>
              </div>
            )}

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="card-elevated divide-y">
              {filteredEmails.map((email: any) => {
                const isInbox = currentFolder === "inbox";
                const isSent = currentFolder === "sent";
                const analysis = email.ai_analysis;
                const hasActions = isInbox && analysis?.type_demande?.length > 0 && analysis.type_demande.some((t: string) => t !== "autre");
                const isRead = isInbox ? !!email.is_read : true;
                const readByProfile = isInbox && email.read_by ? (profilesMap as any)[email.read_by] : null;
                const isChecked = selectedIds.has(email.id);

                // Account info
                const account = email._account || (email.account_id ? emailAccountsMap[email.account_id] : null);
                const accountColor = account ? (providerColors[account.provider] || "bg-muted-foreground") : null;

                // For sent emails, show recipients
                const recipients = isSent && Array.isArray(email.to_recipients)
                  ? email.to_recipients.map((r: any) => r.email || r).join(", ")
                  : null;

                return (
                  <div
                    key={email.id}
                    onClick={() => handleRowClick(email.id)}
                    className={`flex items-start gap-3 transition-colors ${
                      selectionMode ? "cursor-default" : "cursor-pointer"
                    } ${!isRead ? "bg-primary/[0.03]" : ""} ${isChecked ? "bg-primary/[0.06]" : ""} hover:bg-muted/30 ${isMobile ? "px-3 py-3" : "px-5 py-3.5"}`}
                  >
                    {selectionMode && (
                      <div className="mt-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isChecked} onCheckedChange={() => toggleSelect(email.id)} />
                      </div>
                    )}

                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {/* Read indicator */}
                      {isInbox && (
                        <div className="mt-1 flex w-4 shrink-0 items-center justify-center">
                          {!isRead ? (
                            <div className="h-2.5 w-2.5 rounded-full bg-info" title="Non lu" />
                          ) : (
                            <Eye className="h-3.5 w-3.5 text-muted-foreground/40" />
                          )}
                        </div>
                      )}

                      {isSent && (
                        <div className="mt-1 flex w-4 shrink-0 items-center justify-center">
                          <Send className="h-3.5 w-3.5 text-muted-foreground/40" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className={`truncate ${!isRead ? "font-semibold text-foreground" : "font-medium text-foreground/80"} ${isMobile ? "text-xs" : "text-sm"}`}>
                            {isSent
                              ? `À : ${recipients || "—"}`
                              : (email.from_name || email.from_email || "Inconnu")}
                          </p>
                        </div>
                        <p className={`truncate ${!isRead ? "font-medium text-foreground" : "text-foreground/70"} ${isMobile ? "text-xs" : "text-sm"}`}>
                          {email.subject || "(sans objet)"}
                        </p>
                        {!isMobile && isInbox && analysis?.resume && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{analysis.resume}</p>
                        )}

                        {/* Account badge with colored dot */}
                        {account && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${accountColor}`} />
                            <span className="text-[9px] text-muted-foreground truncate max-w-[180px]">
                              {account.email_address}
                            </span>
                          </div>
                        )}

                        {hasActions && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {analysis.type_demande.filter((t: string) => t !== "autre").slice(0, 3).map((t: string) => (
                              <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[10px]">{t}</Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(email.created_at), { addSuffix: true, locale: fr })}
                        </span>
                        {isInbox && (
                          <Badge className={`py-0 text-[10px] ${statusStyles[email.status] || ""}`}>
                            {statusLabels[email.status] || email.status}
                          </Badge>
                        )}
                        {isInbox && (email.clients as any)?.name && (
                          <span className="max-w-[100px] truncate text-[10px] text-muted-foreground">
                            {(email.clients as any).name}
                          </span>
                        )}
                        {isRead && readByProfile && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                                <CheckCircle2 className="h-3 w-3" />
                                <span className="max-w-[60px] truncate">{readByProfile.full_name?.split(" ")[0] || "Lu"}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p className="text-xs">
                                Lu par {readByProfile.full_name || readByProfile.email}
                                {email.read_at && <> · {format(new Date(email.read_at), "dd/MM/yyyy à HH:mm", { locale: fr })}</>}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>

            <div ref={sentinelRef} className="flex items-center justify-center py-4">
              {isFetchingMore && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Compose Dialog */}
      <InboxComposeDialog
        open={composeOpen}
        onOpenChange={(open) => { setComposeOpen(open); if (!open) { setReplyData(null); setForwardData(null); } }}
        onSent={handleRefresh}
        replyTo={replyData}
        forwardData={forwardData}
      />

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open && !isDeleting) setPendingDeleteIds([]);
        }}
        onConfirm={handleDeleteSelected}
        title={`Supprimer ${pendingDeleteIds.length} email${pendingDeleteIds.length > 1 ? "s" : ""} ?`}
        description={`Cette action est irréversible. ${pendingDeleteIds.length > 1 ? "Ces emails seront" : "Cet email sera"} définitivement supprimé${pendingDeleteIds.length > 1 ? "s" : ""}.`}
        isPending={isDeleting}
      />
    </div>
  );
};

export default InboxPage;
