import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Receipt, CheckCircle, Clock, AlertTriangle } from "lucide-react";

interface Props {
  dossierId: string;
  dossierAmount: number;
  dossierCost: number;
  companyId: string;
  clientId: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const pct = (value: number, total: number) =>
  total === 0 ? "—" : `${((value / total) * 100).toFixed(1)}%`;

const statusLabels: Record<string, string> = {
  prevu: "Prévu", facture: "Facturé", paye: "Payé",
};
const statusIcons: Record<string, React.ElementType> = {
  prevu: Clock, facture: Receipt, paye: CheckCircle,
};
const statusColors: Record<string, string> = {
  prevu: "text-muted-foreground", facture: "text-warning", paye: "text-success",
};

export const DossierSituationTab = ({ dossierId, dossierAmount, dossierCost, companyId, clientId }: Props) => {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("Acompte");
  const [newPct, setNewPct] = useState(30);

  const { data: factures = [] } = useQuery({
    queryKey: ["dossier-factures", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factures")
        .select("amount, paid_amount, status")
        .eq("dossier_id", dossierId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: situations = [] } = useQuery({
    queryKey: ["dossier-situations", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facture_situations")
        .select("*")
        .eq("dossier_id", dossierId)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const addSituation = useMutation({
    mutationFn: async () => {
      const amount = Math.round(dossierAmount * newPct / 100 * 100) / 100;
      const maxOrder = situations.length > 0 ? Math.max(...situations.map((s: any) => s.sort_order)) + 1 : 0;
      const { error } = await supabase.from("facture_situations").insert({
        dossier_id: dossierId,
        company_id: companyId,
        label: newLabel,
        percentage: newPct,
        amount,
        sort_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dossier-situations", dossierId] });
      setAdding(false);
      setNewLabel("Acompte");
      setNewPct(30);
      toast.success("Situation ajoutée");
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteSituation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("facture_situations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dossier-situations", dossierId] });
      toast.success("Supprimé");
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("facture_situations").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dossier-situations", dossierId] });
    },
  });

  const totalFacture = factures.reduce((s, f) => s + Number(f.amount), 0);
  const totalRegle = factures.reduce((s, f) => s + Number(f.paid_amount), 0);
  const resteAFacturer = Math.max(0, dossierAmount - totalFacture);
  const resteARecevoir = Math.max(0, totalFacture - totalRegle);
  const margePrevue = dossierAmount - dossierCost;
  const margeEnCours = totalFacture - dossierCost;

  const totalSituationsPct = situations.reduce((s: number, sit: any) => s + Number(sit.percentage), 0);

  const rows = [
    { label: "Fact.", prevu: dossierAmount, enCours: totalFacture },
    { label: "Coût", prevu: dossierCost, enCours: dossierCost },
    { label: "Marge", prevu: margePrevue, enCours: margeEnCours, highlight: true },
    { label: "% / CA", prevu: null, enCours: null, prevuPct: pct(margePrevue, dossierAmount), enCoursPct: pct(margeEnCours, totalFacture) },
  ];

  const presets = [
    { label: "30/40/30", splits: [{ label: "Acompte commande", pct: 30 }, { label: "Mi-chantier", pct: 40 }, { label: "Solde livraison", pct: 30 }] },
    { label: "50/50", splits: [{ label: "Acompte", pct: 50 }, { label: "Solde", pct: 50 }] },
    { label: "40/60", splits: [{ label: "Acompte", pct: 40 }, { label: "Solde", pct: 60 }] },
  ];

  const applyPreset = async (splits: { label: string; pct: number }[]) => {
    for (let i = 0; i < splits.length; i++) {
      const amount = Math.round(dossierAmount * splits[i].pct / 100 * 100) / 100;
      await supabase.from("facture_situations").insert({
        dossier_id: dossierId,
        company_id: companyId,
        label: splits[i].label,
        percentage: splits[i].pct,
        amount,
        sort_order: i,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["dossier-situations", dossierId] });
    toast.success("Échéancier appliqué");
  };

  return (
    <div className={`space-y-4 ${isMobile ? "" : "space-y-6"}`}>
      {/* Situation facturation */}
      <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Facturation</h3>
        <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Reste à facturer</p>
            <p className={`font-bold ${isMobile ? "text-base" : "text-xl"} ${resteAFacturer > 0 ? "text-warning" : "text-success"}`}>
              {fmt(resteAFacturer)}
            </p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Reste à recevoir</p>
            <p className={`font-bold ${isMobile ? "text-base" : "text-xl"} ${resteARecevoir > 0 ? "text-destructive" : "text-success"}`}>
              {fmt(resteARecevoir)}
            </p>
          </div>
        </div>
      </div>

      {/* Échéancier de facturation */}
      <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Échéancier de facturation
          </h3>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3" /> Ajouter
          </Button>
        </div>

        {situations.length === 0 && !adding && (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground">Aucun échéancier défini</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {presets.map((p) => (
                <Button key={p.label} variant="outline" size="sm" className="text-xs" onClick={() => applyPreset(p.splits)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {situations.length > 0 && (
          <div className="space-y-2">
            {/* Progress bar */}
            <div className="relative h-3 bg-muted rounded-full overflow-hidden mb-3">
              {situations.map((sit: any, i: number) => {
                const offset = situations.slice(0, i).reduce((s: number, x: any) => s + Number(x.percentage), 0);
                const color = sit.status === "paye" ? "bg-success" : sit.status === "facture" ? "bg-warning" : "bg-primary/30";
                return (
                  <div
                    key={sit.id}
                    className={`absolute top-0 h-full ${color} transition-all`}
                    style={{ left: `${offset}%`, width: `${sit.percentage}%` }}
                  />
                );
              })}
            </div>

            {situations.map((sit: any) => {
              const Icon = statusIcons[sit.status] || Clock;
              return (
                <div key={sit.id} className="flex items-center gap-3 rounded-lg border p-3 group">
                  <Icon className={`h-4 w-4 shrink-0 ${statusColors[sit.status]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{sit.label}</p>
                    <p className="text-xs text-muted-foreground">{sit.percentage}% — {fmt(sit.amount)}</p>
                  </div>
                  <select
                    value={sit.status}
                    onChange={(e) => updateStatus.mutate({ id: sit.id, status: e.target.value })}
                    className="text-xs border rounded px-2 py-1 bg-background"
                  >
                    <option value="prevu">Prévu</option>
                    <option value="facture">Facturé</option>
                    <option value="paye">Payé</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    onClick={() => deleteSituation.mutate(sit.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              );
            })}

            {totalSituationsPct !== 100 && (
              <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 p-2 rounded-lg">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Total : {totalSituationsPct}% — devrait être 100%
              </div>
            )}
          </div>
        )}

        {adding && (
          <div className="rounded-lg border p-3 space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Libellé</Label>
                <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Pourcentage</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={100} value={newPct} onChange={(e) => setNewPct(Number(e.target.value))} className="text-sm" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Montant : {fmt(Math.round(dossierAmount * newPct / 100 * 100) / 100)}</p>
            <div className="flex gap-2">
              <Button size="sm" className="text-xs" onClick={() => addSituation.mutate()}>Ajouter</Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setAdding(false)}>Annuler</Button>
            </div>
          </div>
        )}
      </div>

      {/* Tableau marge */}
      <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Marge</h3>
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm min-w-[280px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-1/3"></th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Prévue</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">En cours</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className={`border-b last:border-b-0 ${row.highlight ? "bg-primary/5" : ""}`}>
                  <td className={`px-3 py-2.5 text-xs font-medium ${row.highlight ? "text-primary font-semibold" : ""}`}>{row.label}</td>
                  <td className={`px-3 py-2.5 text-right text-xs whitespace-nowrap ${row.highlight ? "font-bold text-primary" : ""}`}>
                    {row.prevuPct || fmt(row.prevu || 0)}
                  </td>
                  <td className={`px-3 py-2.5 text-right text-xs whitespace-nowrap ${row.highlight ? "font-bold text-primary" : ""}`}>
                    {row.enCoursPct || fmt(row.enCours || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
