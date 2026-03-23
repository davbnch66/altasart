import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { motion } from "framer-motion";
import {
  ArrowLeft, TrendingUp, TrendingDown, BarChart3, AlertTriangle, Download,
  FolderOpen, Euro, PiggyBank, CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const pct = (v: number, total: number) =>
  total === 0 ? 0 : Math.round((v / total) * 100);

const categories: Record<string, string> = {
  main_oeuvre: "Main d'œuvre",
  carburant: "Carburant",
  sous_traitance: "Sous-traitance",
  peage: "Péages",
  location: "Location engin",
  materiel: "Matériel",
  autre: "Autre",
};

const stageLabels: Record<string, string> = {
  prospect: "Prospect", devis: "Devis", accepte: "Accepté", planifie: "Planifié",
  en_cours: "En cours", termine: "Terminé", facture: "Facturé", paye: "Payé",
};

function MarginBar({ value, max }: { value: number; max: number }) {
  const width = max === 0 ? 0 : Math.min(Math.abs(value / max) * 100, 100);
  const isPositive = value >= 0;
  return (
    <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${isPositive ? "bg-success" : "bg-destructive"}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export default function RentabiliteReport() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { current, dbCompanies } = useCompany();
  const [sortBy, setSortBy] = useState<"margin" | "amount" | "pct">("pct");
  const [filterStage, setFilterStage] = useState("all");

  const companyIds = current === "global" ? dbCompanies.map(c => c.id) : [current];

  // Fetch fixed costs (monthly charges like credits/leasing)
  const { data: fixedCosts = [] } = useQuery({
    queryKey: ["company-fixed-costs-rentabilite", current],
    queryFn: async () => {
      let query = (supabase.from("company_fixed_costs" as any).select("*") as any);
      if (current !== "global") {
        query = query.eq("company_id", current);
      } else if (companyIds.length > 0) {
        query = query.in("company_id", companyIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all dossiers with their costs and factures
  const { data, isLoading } = useQuery({
    queryKey: ["rentabilite-report", current],
    queryFn: async () => {
      let dossiersQuery = supabase
        .from("dossiers")
        .select("id, code, title, stage, amount, cost, client_id, company_id, clients(name)")
        .not("stage", "eq", "prospect");

      if (current !== "global") dossiersQuery = dossiersQuery.eq("company_id", current);

      const { data: dossiers, error: dErr } = await dossiersQuery;
      if (dErr) throw dErr;

      const ids = (dossiers || []).map((d) => d.id);
      if (ids.length === 0) return { dossiers: [], costsByDossier: {}, facturesByDossier: {}, catTotals: {} };

      const [{ data: costs }, { data: factures }] = await Promise.all([
        supabase.from("dossier_costs").select("dossier_id, amount, category").in("dossier_id", ids),
        supabase.from("factures").select("dossier_id, amount, paid_amount, status").in("dossier_id", ids),
      ]);

      // Aggregate costs per dossier and category
      const costsByDossier: Record<string, number> = {};
      const catTotals: Record<string, number> = {};
      for (const c of costs || []) {
        costsByDossier[c.dossier_id] = (costsByDossier[c.dossier_id] || 0) + Number(c.amount);
        catTotals[c.category] = (catTotals[c.category] || 0) + Number(c.amount);
      }

      // Aggregate factures per dossier
      const facturesByDossier: Record<string, { facture: number; regle: number }> = {};
      for (const f of factures || []) {
        if (!facturesByDossier[f.dossier_id]) facturesByDossier[f.dossier_id] = { facture: 0, regle: 0 };
        facturesByDossier[f.dossier_id].facture += Number(f.amount);
        facturesByDossier[f.dossier_id].regle += Number(f.paid_amount);
      }

      return { dossiers: dossiers || [], costsByDossier, facturesByDossier, catTotals };
    },
    enabled: true,
  });

  const dossiers = data?.dossiers ?? [];
  const costsByDossier = data?.costsByDossier ?? {};
  const facturesByDossier = data?.facturesByDossier ?? {};
  const catTotals = (data?.catTotals ?? {}) as Record<string, number>;

  // Calculate monthly fixed charges from company_fixed_costs
  const monthlyFixedCharges = fixedCosts
    .filter((fc: any) => fc.unit === "mois")
    .reduce((sum: number, fc: any) => {
      const total = Number(fc.unit_cost) * (1 + Number(fc.charges_rate) / 100);
      return sum + total;
    }, 0);

  // Calculate daily rates for auto-estimation
  const dailyPersonnelRate = fixedCosts
    .filter((fc: any) => fc.category === "personnel" && fc.unit === "jour")
    .reduce((sum: number, fc: any) => {
      const total = Number(fc.unit_cost) * (1 + Number(fc.charges_rate) / 100);
      return sum + total;
    }, 0);

  const dailyVehicleRate = fixedCosts
    .filter((fc: any) => fc.category === "vehicule" && fc.unit === "jour")
    .reduce((sum: number, fc: any) => {
      const total = Number(fc.unit_cost) * (1 + Number(fc.charges_rate) / 100);
      return sum + total;
    }, 0);

  // Build enriched rows - auto-estimate costs for dossiers without manual costs
  const rows = dossiers
    .filter((d) => filterStage === "all" || d.stage === filterStage)
    .map((d) => {
      const manualCosts = costsByDossier[d.id] ?? 0;
      const ca = Number(d.amount ?? 0);
      
      // Auto-estimate if no manual costs: use CA × estimated cost ratio from fixed rates
      // Simple heuristic: estimate 1 day of work per 1000€ of CA (personnel + vehicle)
      let estimatedCosts = 0;
      let isEstimated = false;
      if (manualCosts === 0 && ca > 0 && (dailyPersonnelRate + dailyVehicleRate) > 0) {
        const estimatedDays = Math.max(1, Math.round(ca / 2000));
        estimatedCosts = estimatedDays * (dailyPersonnelRate + dailyVehicleRate);
        isEstimated = true;
      }
      
      const costs = manualCosts > 0 ? manualCosts : estimatedCosts;
      const factureInfo = facturesByDossier[d.id];
      const facture = factureInfo?.facture ?? 0;
      const regle = factureInfo?.regle ?? 0;
      const margin = ca - costs;
      const marginPct = pct(margin, ca);
      return { ...d, costs, ca, facture, regle, margin, marginPct, isEstimated, manualCosts };
    })
    .sort((a, b) => {
      if (sortBy === "pct") return b.marginPct - a.marginPct;
      if (sortBy === "margin") return b.margin - a.margin;
      return b.ca - a.ca;
    });

  // Global KPIs
  const totalCA = rows.reduce((s, r) => s + r.ca, 0);
  const totalCosts = rows.reduce((s, r) => s + r.costs, 0);
  const totalFacture = rows.reduce((s, r) => s + r.facture, 0);
  const totalRegle = rows.reduce((s, r) => s + r.regle, 0);
  const totalMargin = totalCA - totalCosts;
  const globalMarginPct = pct(totalMargin, totalCA);
  const dossiersPositifs = rows.filter((r) => r.margin >= 0).length;
  const dossiersNegatifs = rows.filter((r) => r.margin < 0).length;
  const dossiersEstimes = rows.filter((r) => r.isEstimated).length;
  const maxAbsMargin = Math.max(...rows.map((r) => Math.abs(r.margin)), 1);

  // Export CSV
  const handleExportCSV = () => {
    const header = ["Code", "Titre", "Client", "Statut", "CA Prévu", "Facturé", "Réglé", "Coûts Réels", "Marge €", "Marge %", "Estimé"];
    const lines = rows.map((r) => [
      r.code || "",
      r.title,
      (r.clients as any)?.name || "",
      stageLabels[r.stage] || r.stage,
      r.ca,
      r.facture,
      r.regle,
      r.costs,
      r.margin,
      `${r.marginPct}%`,
      r.isEstimated ? "Oui" : "Non",
    ]);
    const csv = [header, ...lines].map((row) => row.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rentabilite_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stages = [...new Set(dossiers.map((d) => d.stage))];

  return (
    <div className={`max-w-6xl mx-auto ${isMobile ? "p-3 pb-20 space-y-4" : "p-6 lg:p-8 space-y-6"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className={`font-bold tracking-tight ${isMobile ? "text-base" : "text-2xl"}`}>
            Rapport de Rentabilité
          </h1>
          {!isMobile && <p className="text-muted-foreground mt-0.5">Analyse des marges par dossier</p>}
        </div>
        <Button variant="outline" size={isMobile ? "icon" : "sm"} onClick={handleExportCSV}>
          <Download className="h-4 w-4" />
          {!isMobile && <span className="ml-1.5">Export CSV</span>}
        </Button>
      </motion.div>

      {/* Global KPIs */}
      {isLoading ? (
        <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-5"}`}>
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-5"}`}
        >
          <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
            <div className="flex items-center gap-2 mb-1">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">CA Total Prévu</p>
            </div>
            <p className={`font-bold ${isMobile ? "text-base" : "text-2xl"}`}>{fmt(totalCA)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Facturé : {fmt(totalFacture)}</p>
          </div>

          <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground">Coûts Réels</p>
            </div>
            <p className={`font-bold text-destructive ${isMobile ? "text-base" : "text-2xl"}`}>{fmt(totalCosts)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Réglé : {fmt(totalRegle)}</p>
          </div>

          <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
            <div className="flex items-center gap-2 mb-1">
              <PiggyBank className={`h-4 w-4 ${totalMargin >= 0 ? "text-success" : "text-destructive"}`} />
              <p className="text-xs text-muted-foreground">Marge Nette</p>
            </div>
            <p className={`font-bold ${isMobile ? "text-base" : "text-2xl"} ${totalMargin >= 0 ? "text-success" : "text-destructive"}`}>
              {fmt(totalMargin)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{rows.length} dossiers analysés</p>
          </div>

          <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className={`h-4 w-4 ${globalMarginPct >= 20 ? "text-success" : globalMarginPct >= 0 ? "text-warning" : "text-destructive"}`} />
              <p className="text-xs text-muted-foreground">Marge Globale</p>
            </div>
            <p className={`font-bold ${isMobile ? "text-base" : "text-2xl"} ${globalMarginPct >= 20 ? "text-success" : globalMarginPct >= 0 ? "text-warning" : "text-destructive"}`}>
              {globalMarginPct}%
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="text-success">✓ {dossiersPositifs}</span>
              <span className="text-destructive">✗ {dossiersNegatifs}</span>
            </div>
          </div>

          {/* Monthly fixed charges */}
          <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-warning" />
              <p className="text-xs text-muted-foreground">Charges fixes / mois</p>
            </div>
            <p className={`font-bold text-warning ${isMobile ? "text-base" : "text-2xl"}`}>{fmt(monthlyFixedCharges)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {monthlyFixedCharges > 0 ? `${fmt(monthlyFixedCharges * 12)} / an` : "Non configuré"}
            </p>
          </div>
        </motion.div>
      )}

      {/* Info about estimations */}
      {!isLoading && dossiersEstimes > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-info/30 bg-info/5 p-3 text-xs text-info">
          <BarChart3 className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{dossiersEstimes} dossier(s) avec coûts estimés automatiquement</p>
            <p className="text-muted-foreground mt-0.5">
              Basé sur votre grille tarifaire (personnel {fmt(dailyPersonnelRate)}/j + véhicules {fmt(dailyVehicleRate)}/j). 
              Ajoutez des coûts réels dans chaque dossier pour remplacer l'estimation.
            </p>
          </div>
        </div>
      )}

      {/* Répartition des coûts par catégorie */}
      {!isLoading && Object.keys(catTotals).length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Répartition des coûts réels</h3>
          <div className="space-y-2">
            {(Object.entries(catTotals) as [string, number][])
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amount]) => (
                <div key={cat} className="flex items-center gap-3 text-xs">
                  <span className="w-28 text-muted-foreground shrink-0">{categories[cat] || cat}</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min((Number(amount) / totalCosts) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="font-semibold w-20 text-right shrink-0">{fmt(Number(amount))}</span>
                  <span className="text-muted-foreground w-8 text-right shrink-0">{pct(Number(amount), totalCosts)}%</span>
                </div>
              ))}
          </div>
        </motion.div>
      )}

      {/* Filters & Sort */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFilterStage("all")}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStage === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            Tous ({rows.length})
          </button>
          {stages.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStage(s)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStage === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {stageLabels[s] || s}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(["pct", "margin", "amount"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${sortBy === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {key === "pct" ? "% Marge" : key === "margin" ? "Marge €" : "CA"}
            </button>
          ))}
        </div>
      </div>

      {/* Dossiers list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>Aucun dossier avec des données de coûts</p>
          <p className="text-xs mt-1">Ajoutez des coûts dans l'onglet "Rentabilité" d'un dossier</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-2">
          {rows.map((row, i) => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.02 * i }}
              onClick={() => navigate(`/dossiers/${row.id}`)}
              className={`rounded-xl border bg-card hover:shadow-sm transition-all cursor-pointer ${isMobile ? "p-3" : "p-4"}`}
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${row.margin >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                  {row.margin >= 0
                    ? <TrendingUp className="h-4 w-4 text-success" />
                    : <TrendingDown className="h-4 w-4 text-destructive" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-medium truncate ${isMobile ? "text-xs" : "text-sm"}`}>{row.title}</p>
                    {row.code && <span className="text-[10px] font-mono text-muted-foreground">{row.code}</span>}
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
                      {stageLabels[row.stage] || row.stage}
                    </span>
                    {row.isEstimated && (
                      <span className="text-[10px] rounded-full px-2 py-0.5 bg-info/10 text-info font-medium">
                        ≈ estimé
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{(row.clients as any)?.name || "—"}</p>
                  {!isMobile && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <MarginBar value={row.margin} max={maxAbsMargin} />
                    </div>
                  )}
                </div>

                {/* KPIs */}
                <div className={`flex items-center gap-4 shrink-0 ${isMobile ? "gap-2" : ""}`}>
                  {!isMobile && (
                    <>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">CA prévu</p>
                        <p className="text-xs font-medium">{fmt(row.ca)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">Coûts{row.isEstimated ? " ≈" : ""}</p>
                        <p className={`text-xs font-medium text-destructive ${row.isEstimated ? "italic" : ""}`}>{fmt(row.costs)}</p>
                      </div>
                    </>
                  )}
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Marge</p>
                    <p className={`text-sm font-bold ${row.margin >= 0 ? "text-success" : "text-destructive"}`}>
                      {fmt(row.margin)}
                    </p>
                  </div>
                  <div className={`text-right min-w-[2.5rem] ${isMobile ? "" : "min-w-[3rem]"}`}>
                    <p className="text-[10px] text-muted-foreground">%</p>
                    <p className={`text-sm font-bold ${row.marginPct >= 20 ? "text-success" : row.marginPct >= 0 ? "text-warning" : "text-destructive"}`}>
                      {row.marginPct}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Mobile margin bar */}
              {isMobile && (
                <div className="mt-2 flex items-center gap-2">
                  <MarginBar value={row.margin} max={maxAbsMargin} />
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    CA: {fmt(row.ca)} · Coûts: {fmt(row.costs)}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Alert: dossiers without costs */}
      {!isLoading && dossiersEstimes > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            {dossiersEstimes} dossier(s) n'ont pas encore de coûts réels saisis — les marges affichées sont des estimations basées sur votre grille tarifaire.
          </p>
        </div>
      )}
    </div>
  );
}
