import { useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { CreateFactureDialog } from "@/components/forms/CreateFactureDialog";
import { EditFactureDialog } from "@/components/forms/EditFactureDialog";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { toast } from "sonner";

function useCompanyFilter() {
  const { current, dbCompanies } = useCompany();
  return current === "global" ? dbCompanies.map((c) => c.id) : [current];
}

function useFinanceStats(companyIds: string[]) {
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();
  const prevMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
  const prevMonthEnd = endOfMonth(subMonths(now, 1)).toISOString();

  return useQuery({
    queryKey: ["finance-stats", companyIds],
    queryFn: async () => {
      const [
        { data: facturesThisMonth },
        { data: facturesPrevMonth },
        { data: allFactures },
        { data: reglements },
      ] = await Promise.all([
        supabase.from("factures").select("amount, paid_amount, status").in("company_id", companyIds).gte("created_at", monthStart).lte("created_at", monthEnd),
        supabase.from("factures").select("amount, paid_amount").in("company_id", companyIds).gte("created_at", prevMonthStart).lte("created_at", prevMonthEnd),
        supabase.from("factures").select("id, amount, paid_amount, status, due_date").in("company_id", companyIds).in("status", ["envoyee", "en_retard"]),
        supabase.from("reglements").select("amount").in("company_id", companyIds).gte("payment_date", monthStart.slice(0, 10)).lte("payment_date", monthEnd.slice(0, 10)),
      ]);

      const caThisMonth = (facturesThisMonth ?? []).reduce((s, f) => s + Number(f.amount), 0);
      const caPrevMonth = (facturesPrevMonth ?? []).reduce((s, f) => s + Number(f.amount), 0);
      const caChange = caPrevMonth > 0 ? (((caThisMonth - caPrevMonth) / caPrevMonth) * 100).toFixed(1) : null;

      const encours = (allFactures ?? []).reduce((s, f) => s + (Number(f.amount) - Number(f.paid_amount)), 0);
      const encoursCount = (allFactures ?? []).length;

      const now30 = new Date();
      now30.setDate(now30.getDate() - 30);
      const impayes = (allFactures ?? []).filter((f) => f.status === "en_retard" || (f.due_date && new Date(f.due_date) < now30));
      const impayesTotal = impayes.reduce((s, f) => s + (Number(f.amount) - Number(f.paid_amount)), 0);
      const impayesCount = impayes.length;

      const encaisseThisMonth = (reglements ?? []).reduce((s, r) => s + Number(r.amount), 0);

      return { caThisMonth, caChange, encours, encoursCount, impayesTotal, impayesCount, encaisseThisMonth };
    },
    enabled: companyIds.length > 0,
  });
}

function useRecentFactures(companyIds: string[]) {
  return useQuery({
    queryKey: ["finance-factures", companyIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("factures")
        .select("id, code, amount, paid_amount, status, due_date, notes, created_at, company_id, clients(name)")
        .in("company_id", companyIds)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: companyIds.length > 0,
  });
}

const statusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
  en_retard: "En retard",
  annulee: "Annulée",
};

const invoiceStatusClass: Record<string, string> = {
  payee: "bg-success/10 text-success",
  envoyee: "bg-info/10 text-info",
  en_retard: "bg-destructive/10 text-destructive",
  brouillon: "bg-muted text-muted-foreground",
  annulee: "bg-muted text-muted-foreground",
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const Finance = () => {
  const companyIds = useCompanyFilter();
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useFinanceStats(companyIds);
  const { data: factures, isLoading: facturesLoading } = useRecentFactures(companyIds);

  const [editFacture, setEditFacture] = useState<any>(null);
  const [deleteFacture, setDeleteFacture] = useState<any>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("factures").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Facture supprimée");
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: ["client-factures"] });
      setDeleteFacture(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const statCards = [
    { label: "CA du mois", value: fmt(stats?.caThisMonth ?? 0), icon: TrendingUp, change: stats?.caChange ? `${Number(stats.caChange) >= 0 ? "+" : ""}${stats.caChange}%` : "—", positive: !stats?.caChange || Number(stats.caChange) >= 0 },
    { label: "Encours clients", value: fmt(stats?.encours ?? 0), icon: DollarSign, change: `${stats?.encoursCount ?? 0} facture${(stats?.encoursCount ?? 0) > 1 ? "s" : ""}`, positive: true },
    { label: "Impayés > 30j", value: fmt(stats?.impayesTotal ?? 0), icon: AlertTriangle, change: `${stats?.impayesCount ?? 0} facture${(stats?.impayesCount ?? 0) > 1 ? "s" : ""}`, positive: (stats?.impayesTotal ?? 0) === 0 },
    { label: "Encaissé ce mois", value: fmt(stats?.encaisseThisMonth ?? 0), icon: CheckCircle2, change: "Ce mois", positive: true },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground mt-1">Suivi facturation et paiements</p>
        </div>
        <CreateFactureDialog />
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            {statsLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold tracking-tight">{stat.value}</p>}
            <div className="flex items-center gap-1 text-xs">
              {stat.positive ? <ArrowUpRight className="h-3 w-3 text-success" /> : <ArrowDownRight className="h-3 w-3 text-destructive" />}
              <span className={stat.positive ? "text-success" : "text-destructive"}>{stat.change}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="rounded-xl border bg-card">
        <div className="p-5 border-b">
          <h2 className="font-semibold">Dernières factures</h2>
        </div>
        {facturesLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : factures && factures.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left font-medium text-muted-foreground px-5 py-3">N°</th>
                <th className="text-left font-medium text-muted-foreground px-5 py-3">Client</th>
                <th className="text-left font-medium text-muted-foreground px-5 py-3">Montant</th>
                <th className="text-left font-medium text-muted-foreground px-5 py-3">Date</th>
                <th className="text-left font-medium text-muted-foreground px-5 py-3">Statut</th>
                <th className="text-right font-medium text-muted-foreground px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {factures.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs">{inv.code || "—"}</td>
                  <td className="px-5 py-3 font-medium">{(inv.clients as any)?.name ?? "—"}</td>
                  <td className="px-5 py-3 font-semibold">{fmt(Number(inv.amount))}</td>
                  <td className="px-5 py-3 text-muted-foreground">{format(new Date(inv.created_at), "d MMM", { locale: fr })}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${invoiceStatusClass[inv.status] || "bg-muted text-muted-foreground"}`}>
                      {statusLabels[inv.status] || inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditFacture(inv)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteFacture(inv)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune facture pour le moment</div>
        )}
      </motion.div>

      {editFacture && (
        <EditFactureDialog facture={editFacture} open={!!editFacture} onOpenChange={(v) => !v && setEditFacture(null)} />
      )}

      <DeleteConfirmDialog
        open={!!deleteFacture}
        onOpenChange={(v) => !v && setDeleteFacture(null)}
        onConfirm={() => deleteFacture && deleteMutation.mutate(deleteFacture.id)}
        title="Supprimer la facture"
        description={`Voulez-vous vraiment supprimer la facture ${deleteFacture?.code || ""} ? Cette action est irréversible.`}
      />
    </div>
  );
};

export default Finance;
