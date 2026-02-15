import { motion } from "framer-motion";
import { Search, Filter, FileText, Pencil, Trash2 } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CreateDevisDialog } from "@/components/forms/CreateDevisDialog";
import { EditDevisDialog } from "@/components/forms/EditDevisDialog";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
};

const statusStyles: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-info/10 text-info",
  accepte: "bg-success/10 text-success",
  refuse: "bg-destructive/10 text-destructive",
  expire: "bg-warning/10 text-warning",
};

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy");
  } catch {
    return "—";
  }
};

const Devis = () => {
  const { current } = useCompany();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingDevis, setEditingDevis] = useState<any>(null);
  const [deletingDevis, setDeletingDevis] = useState<any>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("devis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devis supprimé");
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      setDeletingDevis(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });
  const { data: devis = [], isLoading } = useQuery({
    queryKey: ["devis", current],
    queryFn: async () => {
      let query = supabase
        .from("devis")
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
    ? devis.filter(
        (d) =>
          d.objet.toLowerCase().includes(search.toLowerCase()) ||
          d.code?.toLowerCase().includes(search.toLowerCase()) ||
          (d.clients as any)?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : devis;

  const stats = useMemo(() => {
    const grouped: Record<string, { count: number; amount: number }> = {};
    for (const s of ["brouillon", "envoye", "accepte", "refuse", "expire"]) {
      const items = filtered.filter((d) => d.status === s);
      grouped[s] = { count: items.length, amount: items.reduce((sum, d) => sum + (d.amount || 0), 0) };
    }
    return [
      { label: "Brouillons", ...grouped.brouillon },
      { label: "Envoyés", ...grouped.envoye },
      { label: "Acceptés", ...grouped.accepte },
      { label: "Refusés", ...grouped.refuse },
    ];
  }, [filtered]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devis / Cotations</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} devis</p>
        </div>
        <CreateDevisDialog />
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-bold mt-1">{s.count}</p>
            <p className="text-xs text-muted-foreground">{formatAmount(s.amount)}</p>
          </div>
        ))}
      </motion.div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un devis..."
            className="w-full rounded-lg border bg-card pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors">
          <Filter className="h-4 w-4" />
          Filtres
        </button>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left font-medium text-muted-foreground px-5 py-3">N°</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3">Client</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden lg:table-cell">Objet</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden md:table-cell">Date</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden md:table-cell">Validité</th>
              <th className="text-right font-medium text-muted-foreground px-5 py-3">Montant</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3">Statut</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-3" colSpan={8}><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">
                  Aucun devis trouvé
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="font-mono text-xs">{d.code || d.id.slice(0, 8)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-medium">{(d.clients as any)?.name || "—"}</span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground hidden lg:table-cell">{d.objet}</td>
                  <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{formatDate(d.created_at)}</td>
                  <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{formatDate(d.valid_until)}</td>
                  <td className="px-5 py-3 text-right font-semibold">{formatAmount(d.amount)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[d.status] || ""}`}>
                      {statusLabels[d.status] || d.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setEditingDevis(d)} className="p-1 rounded hover:bg-muted" title="Modifier">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => setDeletingDevis(d)} className="p-1 rounded hover:bg-muted" title="Supprimer">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </motion.div>

      {editingDevis && (
        <EditDevisDialog devis={editingDevis} open={!!editingDevis} onOpenChange={(v) => !v && setEditingDevis(null)} />
      )}
      <DeleteConfirmDialog
        open={!!deletingDevis}
        onOpenChange={(v) => !v && setDeletingDevis(null)}
        onConfirm={() => deletingDevis && deleteMutation.mutate(deletingDevis.id)}
        title="Supprimer ce devis ?"
        description={`Le devis "${deletingDevis?.objet}" sera définitivement supprimé.`}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
};

export default Devis;
