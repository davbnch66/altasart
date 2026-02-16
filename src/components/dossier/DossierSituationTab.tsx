import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  dossierId: string;
  dossierAmount: number;
  dossierCost: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const pct = (value: number, total: number) =>
  total === 0 ? "—" : `${((value / total) * 100).toFixed(1)}%`;

export const DossierSituationTab = ({ dossierId, dossierAmount, dossierCost }: Props) => {
  const isMobile = useIsMobile();

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

  const totalFacture = factures.reduce((s, f) => s + Number(f.amount), 0);
  const totalRegle = factures.reduce((s, f) => s + Number(f.paid_amount), 0);
  const resteAFacturer = Math.max(0, dossierAmount - totalFacture);
  const resteARecevoir = Math.max(0, totalFacture - totalRegle);

  // Marge calculation
  const margePrevue = dossierAmount - dossierCost;
  const margeEnCours = totalFacture - dossierCost;

  const rows = [
    { label: "Fact.", prevu: dossierAmount, enCours: totalFacture },
    { label: "Coût", prevu: dossierCost, enCours: dossierCost },
    { label: "Marge", prevu: margePrevue, enCours: margeEnCours, highlight: true },
    { label: "% / CA", prevu: null, enCours: null, prevuPct: pct(margePrevue, dossierAmount), enCoursPct: pct(margeEnCours, totalFacture) },
  ];

  return (
    <div className={`space-y-4 ${isMobile ? "" : "space-y-6"}`}>
      {/* Situation facturation */}
      <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Facturation</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Reste à facturer</p>
            <p className={`font-bold ${isMobile ? "text-sm" : "text-lg"} ${resteAFacturer > 0 ? "text-warning" : "text-success"}`}>
              {fmt(resteAFacturer)}
            </p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Reste à recevoir</p>
            <p className={`font-bold ${isMobile ? "text-sm" : "text-lg"} ${resteARecevoir > 0 ? "text-destructive" : "text-success"}`}>
              {fmt(resteARecevoir)}
            </p>
          </div>
        </div>
      </div>

      {/* Tableau marge */}
      <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Marge</h3>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground"></th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Prévue</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">En cours</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className={`border-b last:border-b-0 ${row.highlight ? "bg-primary/5" : ""}`}>
                  <td className={`px-3 py-2 text-xs font-medium ${row.highlight ? "text-primary font-semibold" : ""}`}>{row.label}</td>
                  <td className={`px-3 py-2 text-right text-xs ${row.highlight ? "font-bold text-primary" : ""}`}>
                    {row.prevuPct || fmt(row.prevu || 0)}
                  </td>
                  <td className={`px-3 py-2 text-right text-xs ${row.highlight ? "font-bold text-primary" : ""}`}>
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
