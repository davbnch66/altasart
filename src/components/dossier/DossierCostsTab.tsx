import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  dossierId: string;
  companyId: string;
  dossierAmount: number;
}

const categories: Record<string, string> = {
  main_oeuvre: "Main d'œuvre",
  carburant: "Carburant",
  sous_traitance: "Sous-traitance",
  peage: "Péages",
  location: "Location engin",
  materiel: "Matériel",
  autre: "Autre",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export const DossierCostsTab = ({ dossierId, companyId, dossierAmount }: Props) => {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newCost, setNewCost] = useState({ category: "main_oeuvre", description: "", amount: "", date: "" });

  const { data: costs = [] } = useQuery({
    queryKey: ["dossier-costs", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossier_costs")
        .select("*")
        .eq("dossier_id", dossierId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newCost.description.trim() || !newCost.amount) throw new Error("Champs requis");
      const { error } = await supabase.from("dossier_costs").insert({
        dossier_id: dossierId,
        company_id: companyId,
        category: newCost.category,
        description: newCost.description.trim(),
        amount: parseFloat(newCost.amount),
        date: newCost.date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coût ajouté");
      queryClient.invalidateQueries({ queryKey: ["dossier-costs", dossierId] });
      setNewCost({ category: "main_oeuvre", description: "", amount: "", date: "" });
      setAdding(false);
    },
    onError: (e) => toast.error(e.message || "Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dossier_costs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coût supprimé");
      queryClient.invalidateQueries({ queryKey: ["dossier-costs", dossierId] });
    },
  });

  const totalCosts = costs.reduce((s: number, c: any) => s + Number(c.amount), 0);
  const margin = dossierAmount - totalCosts;
  const marginPct = dossierAmount > 0 ? ((margin / dossierAmount) * 100).toFixed(1) : "—";

  // Group by category
  const grouped: Record<string, number> = {};
  for (const c of costs) {
    grouped[c.category] = (grouped[c.category] || 0) + Number(c.amount);
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}>
        <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"}`}>
          <p className="text-[10px] text-muted-foreground">CA prévu</p>
          <p className={`font-bold ${isMobile ? "text-sm" : "text-lg"}`}>{fmt(dossierAmount)}</p>
        </div>
        <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"}`}>
          <p className="text-[10px] text-muted-foreground">Coûts réels</p>
          <p className={`font-bold text-destructive ${isMobile ? "text-sm" : "text-lg"}`}>{fmt(totalCosts)}</p>
        </div>
        <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"}`}>
          <p className="text-[10px] text-muted-foreground">Marge nette</p>
          <p className={`font-bold ${margin >= 0 ? "text-success" : "text-destructive"} ${isMobile ? "text-sm" : "text-lg"}`}>{fmt(margin)}</p>
        </div>
        <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"}`}>
          <p className="text-[10px] text-muted-foreground">% marge</p>
          <p className={`font-bold ${margin >= 0 ? "text-success" : "text-destructive"} ${isMobile ? "text-sm" : "text-lg"}`}>{marginPct}%</p>
        </div>
      </div>

      {/* Breakdown by category */}
      {Object.keys(grouped).length > 0 && (
        <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"}`}>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Répartition</h3>
          <div className="space-y-1.5">
            {Object.entries(grouped).sort(([, a], [, b]) => b - a).map(([cat, amount]) => (
              <div key={cat} className="flex items-center justify-between text-xs">
                <span>{categories[cat] || cat}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min((amount / totalCosts) * 100, 100)}%` }} />
                  </div>
                  <span className="font-medium w-20 text-right">{fmt(amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add button */}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAdding(!adding)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Ajouter un coût
        </Button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={newCost.category} onValueChange={(v) => setNewCost({ ...newCost, category: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(categories).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" placeholder="Montant €" value={newCost.amount} onChange={(e) => setNewCost({ ...newCost, amount: e.target.value })} className="h-8 text-xs" />
          </div>
          <Input placeholder="Description" value={newCost.description} onChange={(e) => setNewCost({ ...newCost, description: e.target.value })} className="h-8 text-xs" />
          <div className="flex gap-2">
            <Input type="date" value={newCost.date} onChange={(e) => setNewCost({ ...newCost, date: e.target.value })} className="h-8 text-xs" />
            <Button size="sm" className="h-8" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>Ajouter</Button>
          </div>
        </div>
      )}

      {/* Costs list */}
      <div className="rounded-xl border bg-card divide-y">
        {costs.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">Aucun coût enregistré</div>
        ) : costs.map((c: any) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`text-[10px] rounded px-1.5 py-0.5 bg-muted font-medium`}>{categories[c.category] || c.category}</span>
            <span className="flex-1 text-xs truncate">{c.description}</span>
            {c.date && <span className="text-[10px] text-muted-foreground">{c.date}</span>}
            <span className="text-xs font-semibold">{fmt(c.amount)}</span>
            <button onClick={() => deleteMutation.mutate(c.id)} className="p-1 rounded hover:bg-muted">
              <Trash2 className="h-3 w-3 text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
