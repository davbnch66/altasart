import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, FolderOpen, Pencil, Trash2, ChevronRight, MapPin, Euro, Plus, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { CreateDossierDialog } from "@/components/forms/CreateDossierDialog";
import { EditDossierDialog } from "@/components/forms/EditDossierDialog";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProgressiveList } from "@/hooks/useProgressiveList";

type SortKey = "title" | "code" | "updated_at" | "created_at" | "amount" | "client" | "stage";
type SortDir = "asc" | "desc";

const pipelineStages = [
  { key: "prospect", label: "Prospect" },
  { key: "devis", label: "Devis" },
  { key: "accepte", label: "Accepté" },
  { key: "planifie", label: "Planifié" },
  { key: "en_cours", label: "En cours" },
  { key: "termine", label: "Terminé" },
  { key: "facture", label: "Facturé" },
  { key: "paye", label: "Payé" },
];

const stageStyles: Record<string, string> = {
  prospect: "bg-muted text-muted-foreground",
  devis: "bg-info/10 text-info",
  accepte: "bg-success/10 text-success",
  planifie: "bg-primary/10 text-primary",
  en_cours: "bg-warning/10 text-warning",
  termine: "bg-success/10 text-success",
  facture: "bg-info/10 text-info",
  paye: "bg-success/10 text-success",
};

const formatAmount = (amount: number | null) => {
  if (!amount) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
};

const Dossiers = () => {
  const { current } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editingDossier, setEditingDossier] = useState<any>(null);
  const [deletingDossier, setDeletingDossier] = useState<any>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dossiers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dossier supprimé");
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      setDeletingDossier(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ["dossiers", current],
    queryFn: async () => {
      let query = supabase
        .from("dossiers")
        .select("*, clients(name), companies(short_name, color)")
        .order("created_at", { ascending: false });
      if (current !== "global") {
        query = query.eq("company_id", current);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    const base = dossiers.filter((d) => {
      const matchSearch = !search ||
        d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.code?.toLowerCase().includes(search.toLowerCase()) ||
        (d.clients as any)?.name?.toLowerCase().includes(search.toLowerCase());
      const matchStage = stageFilter === "all" || d.stage === stageFilter;
      return matchSearch && matchStage;
    });
    return base.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title": cmp = (a.title || "").localeCompare(b.title || "", "fr"); break;
        case "code": cmp = (a.code || "").localeCompare(b.code || "", "fr"); break;
        case "client": cmp = ((a.clients as any)?.name || "").localeCompare((b.clients as any)?.name || "", "fr"); break;
        case "amount": cmp = (a.amount || 0) - (b.amount || 0); break;
        case "stage": {
          const order = pipelineStages.map(s => s.key);
          cmp = order.indexOf(a.stage) - order.indexOf(b.stage);
          break;
        }
        case "updated_at": cmp = (a.updated_at || "").localeCompare(b.updated_at || ""); break;
        case "created_at": cmp = (a.created_at || "").localeCompare(b.created_at || ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [dossiers, search, stageFilter, sortKey, sortDir]);

  const counts: Record<string, number> = { all: dossiers.length };
  for (const s of pipelineStages) {
    counts[s.key] = dossiers.filter((d) => d.stage === s.key).length;
  }

  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-5"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="page-header">
        <div>
          <h1 className={`font-semibold tracking-tight ${isMobile ? "text-lg" : "page-title"}`}>Dossiers</h1>
          {!isMobile && <p className="page-subtitle">{filtered.length} dossiers</p>}
        </div>
        <CreateDossierDialog
          trigger={isMobile ? (
            <Button size="icon" className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-premium-lg">
              <Plus className="h-6 w-6" />
            </Button>
          ) : undefined}
        />
      </motion.div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {([
            { key: "all", label: "Tous" },
            ...pipelineStages.filter((s) => counts[s.key] > 0 || !isMobile),
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStageFilter(key)}
              className={`filter-chip ${stageFilter === key ? "filter-chip-active" : "filter-chip-inactive"}`}
            >
              {label}
              <span className={`ml-1 ${stageFilter === key ? "opacity-60" : "opacity-40"}`}>{counts[key] || 0}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher un dossier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Sort bar mobile */}
      {isMobile && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {([
            { key: "updated_at" as SortKey, label: "Modifié" },
            { key: "title" as SortKey, label: "Nom" },
            { key: "client" as SortKey, label: "Client" },
            { key: "amount" as SortKey, label: "Montant" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                sortKey === key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {label} <SortIcon col={key} />
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className={`w-full rounded-lg ${isMobile ? "h-16" : "h-14"}`} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Aucun dossier trouvé</p>
        </div>
      ) : <DossierList filtered={filtered} isMobile={isMobile} navigate={navigate} stageStyles={stageStyles} pipelineStages={pipelineStages} formatAmount={formatAmount} toggleSort={toggleSort} SortIcon={SortIcon} setEditingDossier={setEditingDossier} setDeletingDossier={setDeletingDossier} />}

      {editingDossier && (
        <EditDossierDialog dossier={editingDossier} open={!!editingDossier} onOpenChange={(v) => !v && setEditingDossier(null)} />
      )}
      <DeleteConfirmDialog
        open={!!deletingDossier}
        onOpenChange={(v) => !v && setDeletingDossier(null)}
        onConfirm={() => deletingDossier && deleteMutation.mutate(deletingDossier.id)}
        title="Supprimer ce dossier ?"
        description={`Le dossier "${deletingDossier?.title}" sera définitivement supprimé.`}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
};

const DossierList = ({ filtered, isMobile, navigate, stageStyles, pipelineStages, formatAmount, toggleSort, SortIcon, setEditingDossier, setDeletingDossier }: any) => {
  const { visibleItems, sentinelRef, hasMore } = useProgressiveList(filtered);

  return isMobile ? (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
      {visibleItems.map((dossier: any) => (
        <div key={dossier.id} onClick={() => navigate(`/dossiers/${dossier.id}`)} className="card-interactive rounded-lg p-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{dossier.title}</p>
                {dossier.code && <span className="text-2xs font-mono text-muted-foreground shrink-0">{dossier.code}</span>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{(dossier.clients as any)?.name || "—"}</p>
              <div className="flex items-center gap-2.5 mt-0.5 text-2xs text-muted-foreground">
                {dossier.amount ? (
                  <span className="font-medium">{formatAmount(dossier.amount)}</span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`badge-status ${stageStyles[dossier.stage] || "bg-muted text-muted-foreground"}`}>
                {pipelineStages.find((s: any) => s.key === dossier.stage)?.label}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
            </div>
          </div>
        </div>
      ))}
      <ScrollSentinel sentinelRef={sentinelRef} hasMore={hasMore} />
    </motion.div>
  ) : (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-elevated rounded-xl overflow-hidden">
      <table className="w-full table-premium">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left w-10"></th>
            <th className="text-left cursor-pointer select-none" onClick={() => toggleSort("title")}>
              <span className="flex items-center gap-1">Dossier <SortIcon col="title" /></span>
            </th>
            <th className="text-left cursor-pointer select-none w-[80px]" onClick={() => toggleSort("code")}>
              <span className="flex items-center gap-1">N° <SortIcon col="code" /></span>
            </th>
            <th className="text-left cursor-pointer select-none hidden lg:table-cell" onClick={() => toggleSort("client")}>
              <span className="flex items-center gap-1">Client <SortIcon col="client" /></span>
            </th>
            <th className="text-left cursor-pointer select-none w-[90px]" onClick={() => toggleSort("stage")}>
              <span className="flex items-center gap-1">Statut <SortIcon col="stage" /></span>
            </th>
            <th className="text-right cursor-pointer select-none w-[100px]" onClick={() => toggleSort("amount")}>
              <span className="flex items-center gap-1 justify-end">Montant <SortIcon col="amount" /></span>
            </th>
            <th className="text-left hidden xl:table-cell cursor-pointer select-none w-[80px]" onClick={() => toggleSort("updated_at")}>
              <span className="flex items-center gap-1">Modifié <SortIcon col="updated_at" /></span>
            </th>
            <th className="w-[60px]"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {visibleItems.map((dossier: any) => (
            <tr key={dossier.id} onClick={() => navigate(`/dossiers/${dossier.id}`)} className="cursor-pointer">
              <td>
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </td>
              <td>
                <p className="font-medium text-sm truncate">{dossier.title}</p>
                <p className="text-xs text-muted-foreground truncate lg:hidden">{(dossier.clients as any)?.name || "—"}</p>
              </td>
              <td className="font-mono text-xs text-muted-foreground">{dossier.code || "—"}</td>
              <td className="text-sm text-muted-foreground truncate hidden lg:table-cell">{(dossier.clients as any)?.name || "—"}</td>
              <td>
                <span className={`badge-status ${stageStyles[dossier.stage]}`}>
                  {pipelineStages.find((s: any) => s.key === dossier.stage)?.label}
                </span>
              </td>
              <td className="text-right font-semibold text-sm">{formatAmount(dossier.amount)}</td>
              <td className="text-xs text-muted-foreground hidden xl:table-cell">
                {new Date(dossier.updated_at).toLocaleDateString("fr-FR")}
              </td>
              <td>
                <div className="flex gap-0.5 justify-end">
                  <button onClick={(e) => { e.stopPropagation(); setEditingDossier(dossier); }} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Modifier">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeletingDossier(dossier); }} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors" title="Supprimer">
                    <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ScrollSentinel sentinelRef={sentinelRef} hasMore={hasMore} />
    </motion.div>
  );
};

const ScrollSentinel = ({ sentinelRef, hasMore }: { sentinelRef: (node: HTMLDivElement | null) => void; hasMore: boolean }) => (
  <div ref={sentinelRef} className="flex items-center justify-center py-3">
    {hasMore && (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Chargement…
      </div>
    )}
  </div>
);

export default Dossiers;
