import { useNavigate } from "react-router-dom";
import type { DossierListItem } from "@/types/entities";
import { motion } from "framer-motion";
import { Search, FolderOpen, Pencil, Trash2, Plus, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type SortKey = "updated_at" | "amount" | "client" | "stage";
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
  const [editingDossier, setEditingDossier] = useState<DossierListItem | null>(null);
  const [deletingDossier, setDeletingDossier] = useState<DossierListItem | null>(null);

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
        case "client": cmp = ((a.clients as any)?.name || "").localeCompare((b.clients as any)?.name || "", "fr"); break;
        case "amount": cmp = (a.amount || 0) - (b.amount || 0); break;
        case "stage": {
          const order = pipelineStages.map(s => s.key);
          cmp = order.indexOf(a.stage) - order.indexOf(b.stage);
          break;
        }
        case "updated_at": cmp = (a.updated_at || "").localeCompare(b.updated_at || ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [dossiers, search, stageFilter, sortKey, sortDir]);

  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? "p-3 pb-20 space-y-4" : "p-6 lg:p-8 space-y-6"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Dossiers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} dossier{filtered.length > 1 ? "s" : ""} · {dossiers.filter(d => d.stage === "en_cours").length} en cours
          </p>
        </div>
        <CreateDossierDialog
          trigger={isMobile ? (
            <Button size="icon" className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg btn-primary-glow">
              <Plus className="h-6 w-6" />
            </Button>
          ) : undefined}
        />
      </motion.div>

      {/* Filters + Search */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un dossier, client, code..."
            className="pl-9 h-10 bg-card"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {[{ key: "all", label: "Tous" }, ...pipelineStages].map(({ key, label }) => {
              const count = key === "all" ? dossiers.length : dossiers.filter(d => d.stage === key).length;
              if (count === 0 && key !== "all") return null;
              return (
                <button
                  key={key}
                  onClick={() => setStageFilter(key)}
                  className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    stageFilter === key
                      ? "bg-foreground text-background shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {label}
                  <span className={`text-[10px] rounded-full px-1 ${stageFilter === key ? "bg-background/20" : "bg-muted-foreground/20"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Sort buttons */}
          <div className="flex gap-1 ml-auto">
            {([
              { key: "updated_at" as SortKey, label: "Modifié" },
              { key: "amount" as SortKey, label: "Montant" },
              { key: "client" as SortKey, label: "Client" },
              { key: "stage" as SortKey, label: "Statut" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  sortKey === key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {label} <SortIcon col={key} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="w-full rounded-xl h-14" />)}
        </div>
      )}

      {/* Empty */}
      {filtered.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Aucun dossier trouvé</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Modifiez vos filtres ou créez un nouveau dossier</p>
        </div>
      )}

      {/* Desktop table */}
      {!isLoading && filtered.length > 0 && !isMobile && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-elevated rounded-xl overflow-hidden">
          <table className="w-full table-premium">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left w-[90px] cursor-pointer select-none" onClick={() => toggleSort("updated_at")}>
                  <span className="flex items-center gap-1">Code</span>
                </th>
                <th className="text-left">Dossier</th>
                <th className="text-left cursor-pointer select-none" onClick={() => toggleSort("stage")}>
                  <span className="flex items-center gap-1">Statut <SortIcon col="stage" /></span>
                </th>
                <th className="text-right cursor-pointer select-none w-[120px]" onClick={() => toggleSort("amount")}>
                  <span className="flex items-center gap-1 justify-end">Montant <SortIcon col="amount" /></span>
                </th>
                <th className="text-left hidden xl:table-cell cursor-pointer select-none w-[100px]" onClick={() => toggleSort("updated_at")}>
                  <span className="flex items-center gap-1">Modifié <SortIcon col="updated_at" /></span>
                </th>
                <th className="w-[70px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(d => (
                <tr key={d.id} onClick={() => navigate(`/dossiers/${d.id}`)} className="cursor-pointer transition-colors hover:bg-muted/40">
                  <td className="font-mono text-xs text-muted-foreground">{d.code || "—"}</td>
                  <td>
                    <p className="text-sm font-semibold truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{(d.clients as any)?.name || "—"}</p>
                  </td>
                  <td>
                    <span className={`badge-status ${stageStyles[d.stage] || "bg-muted text-muted-foreground"}`}>
                      {pipelineStages.find(s => s.key === d.stage)?.label || d.stage}
                    </span>
                  </td>
                  <td className="text-right font-black text-sm tabular-nums">{formatAmount(d.amount)}</td>
                  <td className="text-xs text-muted-foreground hidden xl:table-cell">
                    {d.updated_at ? format(new Date(d.updated_at), "d MMM", { locale: fr }) : "—"}
                  </td>
                  <td>
                    <div className="flex gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ opacity: undefined }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
                    >
                      <button onClick={e => { e.stopPropagation(); setEditingDossier(d); }} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Modifier">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeletingDossier(d); }} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors" title="Supprimer">
                        <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Mobile cards */}
      {!isLoading && filtered.length > 0 && isMobile && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2.5">
          {filtered.map(d => (
            <div
              key={d.id}
              className="card-interactive p-4"
              onClick={() => navigate(`/dossiers/${d.id}`)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{(d.clients as any)?.name}</p>
                </div>
                {d.code && (
                  <span className="font-mono text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">{d.code}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stageStyles[d.stage] || "bg-muted text-muted-foreground"}`}>
                  {pipelineStages.find(s => s.key === d.stage)?.label || d.stage}
                </span>
                {d.amount && <span className="font-black text-foreground text-sm tabular-nums">{formatAmount(d.amount)}</span>}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Dialogs */}
      {editingDossier && (
        <EditDossierDialog dossier={editingDossier} open={!!editingDossier} onOpenChange={v => !v && setEditingDossier(null)} />
      )}
      <DeleteConfirmDialog
        open={!!deletingDossier}
        onOpenChange={v => !v && setDeletingDossier(null)}
        onConfirm={() => deletingDossier && deleteMutation.mutate(deletingDossier.id)}
        title="Supprimer ce dossier ?"
        description={`Le dossier "${deletingDossier?.title}" sera définitivement supprimé.`}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
};

export default Dossiers;
