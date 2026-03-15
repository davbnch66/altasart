import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, FolderOpen, Pencil, Trash2, ChevronRight, MapPin, Euro, Plus, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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

const stageBorderColors: Record<string, string> = {
  prospect: "border-muted-foreground/30",
  devis: "border-info/50",
  accepte: "border-success/50",
  planifie: "border-primary/50",
  en_cours: "border-warning/50",
  termine: "border-success/50",
  facture: "border-info/50",
  paye: "border-success/50",
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
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
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

  const filtered = dossiers.filter((d) => {
    const matchSearch = !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.code?.toLowerCase().includes(search.toLowerCase()) ||
      (d.clients as any)?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === "all" || d.stage === stageFilter;
    return matchSearch && matchStage;
  });

  const counts: Record<string, number> = { all: dossiers.length };
  for (const s of pipelineStages) {
    counts[s.key] = dossiers.filter((d) => d.stage === s.key).length;
  }

  return (
    <div className={`max-w-7xl mx-auto space-y-4 ${isMobile ? "p-3 pb-20" : "p-6 lg:p-8 space-y-6"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Dossiers</h1>
          {!isMobile && <p className="text-muted-foreground mt-1">{filtered.length} dossiers</p>}
        </div>
        <CreateDossierDialog
          trigger={isMobile ? (
            <Button size="icon" className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg">
              <Plus className="h-6 w-6" />
            </Button>
          ) : undefined}
        />
      </motion.div>

      {/* Stage filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {([
          { key: "all", label: "Tous" },
          ...pipelineStages.filter((s) => counts[s.key] > 0 || !isMobile),
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStageFilter(key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              stageFilter === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label} ({counts[key] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un dossier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className={`w-full rounded-xl ${isMobile ? "h-20" : "h-16"}`} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Aucun dossier trouvé</div>
      ) : isMobile ? (
        /* Mobile cards */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid gap-3">
          {filtered.map((dossier) => (
            <div
              key={dossier.id}
              onClick={() => navigate(`/dossiers/${dossier.id}`)}
              className="rounded-xl border bg-card p-3 active:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{dossier.title}</p>
                    {dossier.code && <span className="text-[10px] font-mono text-muted-foreground shrink-0">{dossier.code}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{(dossier.clients as any)?.name || "—"}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    {dossier.address && (
                      <span className="flex items-center gap-0.5 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{dossier.address.length > 20 ? dossier.address.slice(0, 20) + "…" : dossier.address}</span>
                      </span>
                    )}
                    {dossier.amount ? (
                      <span className="flex items-center gap-0.5 shrink-0 font-medium">
                        <Euro className="h-3 w-3" />
                        {formatAmount(dossier.amount)}
                      </span>
                    ) : null}
                    {(dossier.companies as any)?.short_name && (
                      <span className="shrink-0">{(dossier.companies as any).short_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${stageStyles[dossier.stage] || "bg-muted text-muted-foreground"}`}>
                    {pipelineStages.find((s) => s.key === dossier.stage)?.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      ) : (
        /* Desktop list */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="grid gap-3">
          {filtered.map((dossier) => (
            <div key={dossier.id} onClick={() => navigate(`/dossiers/${dossier.id}`)} className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4 hover:shadow-sm transition-shadow cursor-pointer">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{dossier.title}</p>
                <p className="text-xs text-muted-foreground">{(dossier.clients as any)?.name || "—"}</p>
              </div>
              <span className="text-xs text-muted-foreground hidden md:block">
                {(dossier.companies as any)?.short_name}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${stageStyles[dossier.stage]}`}>
                {pipelineStages.find((s) => s.key === dossier.stage)?.label}
              </span>
              <span className="text-sm font-semibold whitespace-nowrap">{formatAmount(dossier.amount)}</span>
              <div className="flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); setEditingDossier(dossier); }} className="p-1 rounded hover:bg-muted" title="Modifier">
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setDeletingDossier(dossier); }} className="p-1 rounded hover:bg-muted" title="Supprimer">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </motion.div>
      )}

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

export default Dossiers;
