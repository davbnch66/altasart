import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Trash2, Fuel, Wrench, Receipt, Car, Sparkles, Eye } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { useState } from "react";

const EXPENSE_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  gasoil: { label: "Gasoil", icon: Fuel, color: "bg-orange-500/10 text-orange-600" },
  entretien: { label: "Entretien", icon: Wrench, color: "bg-blue-500/10 text-blue-600" },
  reparation: { label: "Réparation", icon: Wrench, color: "bg-destructive/10 text-destructive" },
  peage: { label: "Péage", icon: Car, color: "bg-purple-500/10 text-purple-600" },
  lavage: { label: "Lavage", icon: Car, color: "bg-teal-500/10 text-teal-600" },
  amende: { label: "Amende", icon: Receipt, color: "bg-destructive/10 text-destructive" },
  autre: { label: "Autre", icon: Receipt, color: "bg-muted text-muted-foreground" },
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export function VehicleExpensesTab() {
  const { current, dbCompanies } = useCompany();
  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const [deleteExpense, setDeleteExpense] = useState<any>(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["vehicle-expenses", companyIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_expenses")
        .select("*, resources!left(name, type)")
        .in("company_id", companyIds)
        .order("expense_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: companyIds.length > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const exp = expenses.find((e: any) => e.id === id);
      if (exp?.photo_url) {
        await supabase.storage.from("vehicle-expenses").remove([exp.photo_url]);
      }
      const { error } = await supabase.from("vehicle_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dépense supprimée");
      qc.invalidateQueries({ queryKey: ["vehicle-expenses"] });
      setDeleteExpense(null);
    },
  });

  const totalAmount = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

  if (isLoading) {
    return <div className="space-y-3 mt-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  if (expenses.length === 0) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Aucune dépense véhicule enregistrée</div>;
  }

  return (
    <div className="space-y-3 mt-3">
      {/* Summary */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-muted-foreground">{expenses.length} dépense(s)</span>
        <span className="font-semibold text-sm">Total : {fmt(totalAmount)}</span>
      </div>

      {/* Expense list */}
      <div className="grid gap-3">
        {expenses.map((exp: any) => {
          const meta = EXPENSE_TYPE_META[exp.expense_type] || EXPENSE_TYPE_META.autre;
          const Icon = meta.icon;
          return (
            <div key={exp.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {(exp.resources as any)?.name || "—"}
                    </p>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${meta.color}`}>{meta.label}</Badge>
                    {exp.ai_extracted && <Sparkles className="h-3 w-3 text-primary shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span>{format(new Date(exp.expense_date), "d MMM yyyy", { locale: fr })}</span>
                    {exp.vendor && <span className="truncate">{exp.vendor}</span>}
                    {exp.liters && <span>{exp.liters}L</span>}
                    {exp.mileage_km && <span>{exp.mileage_km.toLocaleString()} km</span>}
                  </div>
                  {exp.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{exp.description}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="font-semibold text-sm">{fmt(Number(exp.amount))}</span>
                  <button onClick={() => setDeleteExpense(exp)} className="p-1 rounded hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <DeleteConfirmDialog
        open={!!deleteExpense}
        onOpenChange={(v) => !v && setDeleteExpense(null)}
        onConfirm={() => deleteExpense && deleteMutation.mutate(deleteExpense.id)}
        title="Supprimer la dépense"
        description={`Supprimer cette dépense de ${deleteExpense ? fmt(Number(deleteExpense.amount)) : ""} ?`}
      />
    </div>
  );
}
