import { motion } from "framer-motion";
import { Search, Filter, FolderOpen, Pencil, Trash2 } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { CreateDossierDialog } from "@/components/forms/CreateDossierDialog";
import { EditDossierDialog } from "@/components/forms/EditDossierDialog";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { toast } from "sonner";

const pipelineStages = [
  { key: "prospect", label: "Prospect" },
  { key: "devis", label: "Devis envoyé" },
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
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
};

const Dossiers = () => {
  const { current } = useCompany();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
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

  const filtered = search
    ? dossiers.filter(
        (d) =>
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.code?.toLowerCase().includes(search.toLowerCase()) ||
          (d.clients as any)?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : dossiers;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dossiers</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} dossiers</p>
        </div>
        <CreateDossierDialog />
      </motion.div>

      {/* Pipeline summary */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-2 overflow-x-auto pb-2">
        {pipelineStages.map((stage) => {
          const count = filtered.filter((d) => d.stage === stage.key).length;
          return (
            <div key={stage.key} className={`flex items-center gap-2 rounded-lg border-2 ${stageBorderColors[stage.key]} px-4 py-2 min-w-fit`}>
              <span className="text-sm font-medium">{stage.label}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{count}</span>
            </div>
          );
        })}
      </motion.div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un dossier..."
            className="w-full rounded-lg border bg-card pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors">
          <Filter className="h-4 w-4" />
          Filtres
        </button>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="grid gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-card px-5 py-12 text-center text-muted-foreground">
            Aucun dossier trouvé
          </div>
        ) : (
          filtered.map((dossier) => (
            <div key={dossier.id} className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4 hover:shadow-sm transition-shadow cursor-pointer">
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
          ))
        )}
      </motion.div>

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
