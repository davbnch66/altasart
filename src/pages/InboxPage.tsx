import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Inbox, MailWarning, Loader2, ArrowUpDown, Eye, CheckCircle2, Trash2 } from "lucide-react";
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
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type CategoryTab = "principal" | "autre";
type SortKey = "date_desc" | "date_asc" | "name_asc" | "name_desc" | "status";

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
  pending: "En attente",
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  useEffect(() => {
    setSelectedIds(new Set());
    setPendingDeleteIds([]);
    setSelectionMode(false);
    setDeleteDialogOpen(false);
  }, [category]);

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      const map: Record<string, { full_name: string | null; email: string | null }> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = p;
      });
      return map;
    },
  });

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["inbound-emails", companyIds],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error, count } = await supabase
        .from("inbound_emails")
        .select("*, clients(name, id)", { count: "exact" })
        .in("company_id", companyIds)
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
    enabled: companyIds.length > 0,
  });

  const allEmails = useMemo(() => data?.pages.flatMap((p) => p.emails) || [], [data]);

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
    enabled: !!selectedEmailId,
  });

  useEffect(() => {
    if (!selectedEmailId || !user) return;

    const email = allEmails.find((e: any) => e.id === selectedEmailId);
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
  }, [selectedEmailId, user, allEmails, queryClient]);

  const principalEmails = allEmails.filter(isBusinessRelevant);
  const autreEmails = allEmails.filter((email: any) => !isBusinessRelevant(email));
  const currentEmails = category === "principal" ? principalEmails : autreEmails;

  const searchedEmails = currentEmails.filter((email: any) => {
    if (!search) return true;
    const q = search.toLowerCase();

    return (
      email.subject?.toLowerCase().includes(q) ||
      email.from_name?.toLowerCase().includes(q) ||
      email.from_email?.toLowerCase().includes(q) ||
      (email.clients as any)?.name?.toLowerCase().includes(q)
    );
  });

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

  const selectedEmail = allEmails.find((email: any) => email.id === selectedEmailId);
  const unreadPrincipalCount = principalEmails.filter((email: any) => !email.is_read).length;
  const allVisibleSelected = filteredEmails.length > 0 && filteredEmails.every((email: any) => selectedIds.has(email.id));
  const someSelected = selectedIds.size > 0;

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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openDeleteDialog = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error("Sélectionnez au moins un email");
      return;
    }

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
    if (ids.length === 0) {
      toast.error("Aucun email sélectionné");
      setDeleteDialogOpen(false);
      return;
    }

    setIsDeleting(true);

    try {
      const { error: actionsError } = await supabase
        .from("email_actions")
        .delete()
        .in("inbound_email_id", ids);

      if (actionsError) throw actionsError;

      const { data: deletedEmails, error: deleteError } = await supabase
        .from("inbound_emails")
        .delete()
        .in("id", ids)
        .select("id");

      if (deleteError) throw deleteError;

      const deletedIds = (deletedEmails || []).map((email) => email.id);
      if (deletedIds.length === 0) {
        throw new Error("Aucun email n'a été supprimé");
      }

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

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
    queryClient.invalidateQueries({ queryKey: ["email-actions"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
  };

  const handleRowClick = (emailId: string) => {
    if (selectionMode) {
      toggleSelect(emailId);
      return;
    }

    setSearchParams({ email: emailId });
  };

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore: !!hasNextPage,
    isLoading: isFetchingNextPage,
  });

  if (isError) {
    toast.error("Erreur de chargement des emails");
  }

  if (selectedEmail) {
    return (
      <div className={`max-w-7xl mx-auto h-full overflow-y-auto ${isMobile ? "p-3 pb-20" : "p-6 lg:p-8"}`}>
        <InboxEmailDetail
          email={selectedEmail}
          actions={emailActions}
          onBack={() => setSearchParams({})}
          onActionExecuted={handleRefresh}
        />
      </div>
    );
  }

  return (
    <div className={`max-w-7xl mx-auto h-full overflow-y-auto animate-fade-in ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={`page-title ${isMobile ? "!text-lg" : ""}`}>Inbox</h1>
        {!isMobile && <p className="page-subtitle">Emails entrants et actions suggérées par l'IA</p>}
      </motion.div>

      <div className="flex gap-1 border-b">
        <button
          onClick={() => setCategory("principal")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            category === "principal"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          <Inbox className="h-4 w-4" />
          Principal
          {unreadPrincipalCount > 0 && (
            <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px]">
              {unreadPrincipalCount}
            </Badge>
          )}
        </button>

        <button
          onClick={() => setCategory("autre")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            category === "autre"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          <MailWarning className="h-4 w-4" />
          Autre
          {autreEmails.length > 0 && (
            <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px] text-muted-foreground">
              {autreEmails.length}
            </Badge>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par sujet, expéditeur ou client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full rounded-lg border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${isMobile ? "py-2 text-xs" : "py-2.5"}`}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortLabels[sortKey]}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(sortLabels) as SortKey[]).map((key) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setSortKey(key)}
                className={sortKey === key ? "font-semibold" : ""}
              >
                {sortLabels[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={toggleSelectAll}
                aria-label="Tout sélectionner"
              />
              <span className="text-sm font-medium text-foreground">
                {someSelected ? `${selectedIds.size} sélectionné${selectedIds.size > 1 ? "s" : ""}` : "Tout sélectionner"}
              </span>
              <div className="flex-1" />
              {someSelected && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={openDeleteDialog}
                  disabled={isDeleting}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer ({selectedIds.size})
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={exitSelectionMode}
                className="text-xs"
              >
                Annuler
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredEmails.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {category === "autre" ? "Aucun email non pertinent" : "Aucun email entrant"}
          </p>
          {category === "principal" && (
            <p className="mt-1 text-xs text-muted-foreground/60">Les emails envoyés à votre adresse dédiée apparaîtront ici</p>
          )}
          {category === "autre" && (
            <p className="mt-1 text-xs text-muted-foreground/60">Les newsletters, notifications et spam triés par l'IA apparaissent ici</p>
          )}
        </motion.div>
      ) : (
        <>
          {category === "autre" && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <MailWarning className="h-3.5 w-3.5 shrink-0" />
              Ces emails ont été classés par l'IA comme non liés à vos métiers. Vérifiez si certains sont pertinents.
            </div>
          )}

          {!selectionMode && (
            <div className="flex items-center px-5 py-1">
              <button
                onClick={() => setSelectionMode(true)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Sélectionner
              </button>
            </div>
          )}

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="card-elevated divide-y">
            {filteredEmails.map((email: any) => {
              const analysis = email.ai_analysis;
              const hasActions = analysis?.type_demande?.length > 0 && analysis.type_demande.some((t: string) => t !== "autre");
              const isRead = !!email.is_read;
              const readByProfile = email.read_by ? (profilesMap as any)[email.read_by] : null;
              const isChecked = selectedIds.has(email.id);

              return (
                <div
                  key={email.id}
                  onClick={() => handleRowClick(email.id)}
                  className={`flex items-start gap-3 transition-colors ${
                    selectionMode ? "cursor-default" : "cursor-pointer"
                  } ${!isRead ? "bg-primary/[0.03]" : ""} ${isChecked ? "bg-primary/[0.06]" : ""} hover:bg-muted/30 ${isMobile ? "px-3 py-3" : "px-5 py-4"}`}
                >
                  {selectionMode && (
                    <div className="mt-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleSelect(email.id)}
                        aria-label={`Sélectionner ${email.subject || "cet email"}`}
                      />
                    </div>
                  )}

                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="mt-1 flex w-4 shrink-0 items-center justify-center">
                      {!isRead ? (
                        <div className="h-2.5 w-2.5 rounded-full bg-info" title="Non lu" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className={`truncate ${!isRead ? "font-semibold text-foreground" : "font-medium text-foreground/80"} ${isMobile ? "text-xs" : "text-sm"}`}>
                          {email.from_name || email.from_email || "Inconnu"}
                        </p>
                      </div>
                      <p className={`truncate ${!isRead ? "font-medium text-foreground" : "text-foreground/70"} ${isMobile ? "text-xs" : "text-sm"}`}>
                        {email.subject || "(sans objet)"}
                      </p>
                      {!isMobile && analysis?.resume && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{analysis.resume}</p>
                      )}
                      {hasActions && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {analysis.type_demande
                            .filter((t: string) => t !== "autre")
                            .slice(0, 3)
                            .map((t: string) => (
                              <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[10px]">
                                {t}
                              </Badge>
                            ))}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(email.created_at), { addSuffix: true, locale: fr })}
                      </span>
                      <Badge className={`py-0 text-[10px] ${statusStyles[email.status] || ""}`}>
                        {statusLabels[email.status] || email.status}
                      </Badge>
                      {(email.clients as any)?.name && (
                        <span className="max-w-[100px] truncate text-[10px] text-muted-foreground">
                          {(email.clients as any).name}
                        </span>
                      )}
                      {isRead && readByProfile && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                              <CheckCircle2 className="h-3 w-3" />
                              <span className="max-w-[60px] truncate">
                                {readByProfile.full_name?.split(" ")[0] || "Lu"}
                              </span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="text-xs">
                              Lu par {readByProfile.full_name || readByProfile.email}
                              {email.read_at && (
                                <>
                                  {" "}· {formatDistanceToNow(new Date(email.read_at), { addSuffix: true, locale: fr })}
                                </>
                              )}
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
            {isFetchingNextPage && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement…
              </div>
            )}
            {!hasNextPage && allEmails.length > PAGE_SIZE && (
              <p className="text-xs text-muted-foreground">{allEmails.length} emails chargés</p>
            )}
          </div>
        </>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open && !isDeleting) {
            setPendingDeleteIds([]);
          }
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
