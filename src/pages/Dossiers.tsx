import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, FolderOpen, Pencil, Trash2, Plus, Loader2 } from "lucide-react";
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

const stageColors: Record<string, string> = {
  prospect: "bg-muted-foreground",
  devis: "bg-info",
  accepte: "bg-success",
  planifie: "bg-primary",
  en_cours: "bg-warning",
  termine: "bg-success",
  facture: "bg-info",
  paye: "bg-emerald-500",
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
  const [editingDossier, setEditingDossier] = useState<any>(null);
  const [deletingDossier, setDeletingDossier] = useState<any>(null);

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
    return dossiers.filter((d) => {
      const matchSearch = !search ||
        d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.code?.toLowerCase().includes(search.toLowerCase()) ||
        (d.clients as any)?.name?.toLowerCase().includes(search.toLowerCase());
      const matchStage = stageFilter === "all" || d.stage === stageFilter;
      return matchSearch && matchStage;
    });
  }, [dossiers, search, stageFilter]);

  return (
    <div className={`max-w-[1600px] mx-auto ${isMobile ? "p-3 pb-20 space-y-4" : "p-6 lg:p-8 space-y-6"}`}>
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
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="w-full rounded-xl h-16" />)}
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

      {/* Kanban desktop */}
      {!isLoading && filtered.length > 0 && !isMobile && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {pipelineStages
            .filter(s => filtered.some(d => d.stage === s.key) || stageFilter === s.key)
            .map(stage => {
              const stageDossiers = filtered.filter(d => d.stage === stage.key);
              return (
                <div key={stage.key} className="flex-shrink-0 w-[280px]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${stageColors[stage.key]}`} />
                      <span className="text-xs font-semibold text-foreground">{stage.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">{stageDossiers.length}</span>
                  </div>
                  <div className="space-y-2">
                    {stageDossiers.map(d => (
                      <div
                        key={d.id}
                        className="card-interactive p-4 space-y-3 group"
                        onClick={() => navigate(`/dossiers/${d.id}`)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{d.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{(d.clients as any)?.name}</p>
                          </div>
                          {d.code && (
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0 bg-muted rounded px-1.5 py-0.5">
                              {d.code}
                            </span>
                          )}
                        </div>
                        {d.amount && (
                          <p className="text-sm font-black text-foreground tabular-nums">{formatAmount(d.amount)}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            {d.updated_at ? format(new Date(d.updated_at), "d MMM", { locale: fr }) : ""}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={e => { e.stopPropagation(); setEditingDossier(d); }}
                              className="p-1 rounded hover:bg-muted"
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setDeletingDossier(d); }}
                              className="p-1 rounded hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {stageDossiers.length === 0 && (
                      <div className="rounded-xl border-2 border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        Aucun dossier
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </motion.div>
      )}

      {/* Mobile list */}
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
                <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${stageStyles[d.stage] || "bg-muted text-muted-foreground"}`}>
                  {pipelineStages.find(s => s.key === d.stage)?.label || d.stage}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">{d.code}</span>
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
