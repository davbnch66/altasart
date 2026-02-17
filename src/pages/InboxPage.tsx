import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Mail, Search, Inbox, ChevronDown, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { InboxEmailDetail } from "@/components/inbox/InboxEmailDetail";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

type StatusFilter = "all" | "pending" | "processed" | "error";

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

const InboxPage = () => {
  const isMobile = useIsMobile();
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEmailId = searchParams.get("email");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);

  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  // Fetch inbound emails with pagination
  const { data: emailsData, isLoading, isError } = useQuery({
    queryKey: ["inbound-emails", companyIds, statusFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("inbound_emails")
        .select("*, clients(name, id)", { count: "exact" })
        .in("company_id", companyIds)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { emails: data || [], totalCount: count || 0 };
    },
    enabled: companyIds.length > 0,
  });

  const emails = emailsData?.emails || [];
  const totalCount = emailsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Fetch actions for selected email
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

  // Filter by search (subject, from, AND client name)
  const filteredEmails = emails.filter((e: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.subject?.toLowerCase().includes(q) ||
      e.from_name?.toLowerCase().includes(q) ||
      e.from_email?.toLowerCase().includes(q) ||
      (e.clients as any)?.name?.toLowerCase().includes(q)
    );
  });

  const selectedEmail = emails.find((e: any) => e.id === selectedEmailId);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
    queryClient.invalidateQueries({ queryKey: ["email-actions"] });
  };

  if (isError) {
    toast.error("Erreur de chargement des emails");
  }

  if (selectedEmail) {
    return (
      <div className={`max-w-7xl mx-auto ${isMobile ? "p-3 pb-20" : "p-6 lg:p-8"}`}>
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
    <div className={`max-w-7xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Inbox</h1>
        {!isMobile && <p className="text-muted-foreground mt-1">Emails entrants et actions suggérées par l'IA</p>}
      </motion.div>

      {/* Search & Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par sujet, expéditeur ou client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full rounded-lg border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${isMobile ? "py-2 text-xs" : "py-2.5"}`}
          />
        </div>
        <div className="flex gap-1">
          {(["all", "pending", "processed", "error"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(0); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s === "all" ? "Tous" : statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Email List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : filteredEmails.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">Aucun email entrant</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Les emails envoyés à votre adresse dédiée apparaîtront ici</p>
        </motion.div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card divide-y">
            {filteredEmails.map((email: any) => {
              const analysis = email.ai_analysis;
              const hasActions = analysis?.type_demande?.length > 0;
              return (
                <div
                  key={email.id}
                  onClick={() => setSearchParams({ email: email.id })}
                  className={`flex items-start gap-3 hover:bg-muted/30 transition-colors cursor-pointer ${
                    email.status === "pending" ? "bg-primary/[0.02]" : ""
                  } ${isMobile ? "px-3 py-3" : "px-5 py-4"}`}
                >
                  <div className="mt-0.5 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`truncate ${email.status === "pending" ? "font-semibold" : "font-medium"} ${isMobile ? "text-xs" : "text-sm"}`}>
                        {email.from_name || email.from_email || "Inconnu"}
                      </p>
                      {email.status === "pending" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-info flex-shrink-0" />
                      )}
                    </div>
                    <p className={`text-foreground truncate ${isMobile ? "text-xs" : "text-sm"}`}>
                      {email.subject || "(sans objet)"}
                    </p>
                    {!isMobile && analysis?.resume && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{analysis.resume}</p>
                    )}
                    {hasActions && (
                      <div className="flex gap-1 mt-1">
                        {analysis.type_demande.slice(0, 3).map((t: string) => (
                          <Badge key={t} variant="secondary" className="text-[10px] py-0 px-1.5">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(email.created_at).toLocaleDateString("fr-FR")}
                    </span>
                    <Badge className={`text-[10px] py-0 ${statusStyles[email.status] || ""}`}>
                      {statusLabels[email.status] || email.status}
                    </Badge>
                    {(email.clients as any)?.name && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                        {(email.clients as any).name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="text-xs"
              >
                Précédent
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1} / {totalPages} ({totalCount} emails)
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs"
              >
                Suivant
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InboxPage;
