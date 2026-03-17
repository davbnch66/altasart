import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FolderOpen,
  Users,
  CalendarDays,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Eye,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { CreateClientDialog } from "@/components/forms/CreateClientDialog";
import { CreateDevisDialog } from "@/components/forms/CreateDevisDialog";
import { CreateDossierDialog } from "@/components/forms/CreateDossierDialog";
import { CreateFactureDialog } from "@/components/forms/CreateFactureDialog";
import { DashboardAlerts } from "@/components/DashboardAlerts";
import { useCompany, type CompanyId } from "@/contexts/CompanyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { GenericPdfPreviewDialog } from "@/components/shared/GenericPdfPreviewDialog";
import { generateDevisPdf } from "@/lib/generateDevisPdf";
import { generateFacturePdf } from "@/lib/generateFacturePdf";
import { toast } from "sonner";
import { Loader2, Download as DownloadIcon } from "lucide-react";

const companyDot: Record<string, string> = {
  global: "bg-primary",
};

const statusIcon: Record<string, React.ReactNode> = {
  devis: <FileText className="h-4 w-4 text-info" />,
  dossier: <FolderOpen className="h-4 w-4 text-primary" />,
  facture: <DollarSign className="h-4 w-4 text-success" />,
  visite: <Eye className="h-4 w-4 text-warning" />,
  reglement: <CheckCircle2 className="h-4 w-4 text-success" />,
};

function useCompanyFilter() {
  const { current, dbCompanies } = useCompany();
  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];
  return companyIds;
}

function useStats(companyIds: string[]) {
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();
  const prevMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
  const prevMonthEnd = endOfMonth(subMonths(now, 1)).toISOString();

  return useQuery({
    queryKey: ["dashboard-stats", companyIds],
    queryFn: async () => {
      const [
        { count: dossiersActifs },
        { count: totalClients },
        { count: eventsThisWeek },
        { data: facturesThisMonth },
        { data: facturesPrevMonth },
        { count: clientsPrevMonth },
        { count: totalDevis },
        { count: devisAcceptes },
        { data: allDossiers },
        { data: allCosts },
      ] = await Promise.all([
        supabase
          .from("dossiers")
          .select("*", { count: "exact", head: true })
          .in("company_id", companyIds)
          .not("stage", "in", '("termine","paye","facture")'),
        supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .in("company_id", companyIds),
        supabase
          .from("planning_events")
          .select("*", { count: "exact", head: true })
          .in("company_id", companyIds)
          .gte("start_time", new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString())
          .lte("start_time", new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 6, 23, 59, 59).toISOString()),
        supabase
          .from("factures")
          .select("amount")
          .in("company_id", companyIds)
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd),
        supabase
          .from("factures")
          .select("amount")
          .in("company_id", companyIds)
          .gte("created_at", prevMonthStart)
          .lte("created_at", prevMonthEnd),
        supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .in("company_id", companyIds)
          .lte("created_at", prevMonthEnd),
        // KPIs avancés: total devis
        supabase
          .from("devis")
          .select("*", { count: "exact", head: true })
          .in("company_id", companyIds),
        // KPIs avancés: devis acceptés
        supabase
          .from("devis")
          .select("*", { count: "exact", head: true })
          .in("company_id", companyIds)
          .eq("status", "accepte"),
        // KPIs avancés: dossiers avec montant pour marge
        supabase
          .from("dossiers")
          .select("id, amount")
          .in("company_id", companyIds)
          .not("stage", "eq", "prospect"),
        // KPIs avancés: coûts dossiers
        supabase
          .from("dossier_costs")
          .select("dossier_id, amount")
          .in("company_id", companyIds),
      ]);

      const caThisMonth = (facturesThisMonth ?? []).reduce((s, f) => s + Number(f.amount), 0);
      const caPrevMonth = (facturesPrevMonth ?? []).reduce((s, f) => s + Number(f.amount), 0);
      const caChange = caPrevMonth > 0 ? (((caThisMonth - caPrevMonth) / caPrevMonth) * 100).toFixed(1) : null;

      const clientsNew = (totalClients ?? 0) - (clientsPrevMonth ?? 0);

      // Taux de conversion devis
      const conversionRate = (totalDevis ?? 0) > 0
        ? (((devisAcceptes ?? 0) / (totalDevis ?? 1)) * 100).toFixed(1)
        : "0";

      // Marge globale
      const totalRevenue = (allDossiers ?? []).reduce((s, d) => s + Number(d.amount || 0), 0);
      const totalCosts = (allCosts ?? []).reduce((s, c) => s + Number(c.amount || 0), 0);
      const globalMargin = totalRevenue > 0 ? (((totalRevenue - totalCosts) / totalRevenue) * 100).toFixed(1) : null;
      const globalMarginAmount = totalRevenue - totalCosts;

      return {
        dossiersActifs: dossiersActifs ?? 0,
        totalClients: totalClients ?? 0,
        eventsThisWeek: eventsThisWeek ?? 0,
        caThisMonth,
        caChange,
        clientsNew,
        conversionRate,
        totalDevis: totalDevis ?? 0,
        devisAcceptes: devisAcceptes ?? 0,
        globalMargin,
        globalMarginAmount,
      };
    },
    enabled: companyIds.length > 0,
  });
}

interface ActivityItem {
  id: string;
  type: string;
  label: string;
  client: string;
  time: string;
  companyId: string;
}

function useRecentActivity(companyIds: string[]) {
  return useQuery({
    queryKey: ["dashboard-activity", companyIds],
    queryFn: async () => {
      const [
        { data: recentDevis },
        { data: recentDossiers },
        { data: recentFactures },
        { data: recentVisites },
      ] = await Promise.all([
        supabase
          .from("devis")
          .select("id, code, objet, status, created_at, company_id, clients(name)")
          .in("company_id", companyIds)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("dossiers")
          .select("id, code, title, stage, created_at, company_id, clients(name)")
          .in("company_id", companyIds)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("factures")
          .select("id, code, amount, status, created_at, company_id, clients(name)")
          .in("company_id", companyIds)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("visites")
          .select("id, title, status, scheduled_date, company_id, clients(name)")
          .in("company_id", companyIds)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const items: ActivityItem[] = [];

      (recentDevis ?? []).forEach((d) => {
        const statusLabel: Record<string, string> = {
          brouillon: "Brouillon",
          envoye: "Envoyé",
          accepte: "Accepté",
          refuse: "Refusé",
          expire: "Expiré",
        };
        items.push({
          id: d.id,
          type: "devis",
          label: `Devis ${d.code || ""} — ${statusLabel[d.status] || d.status}`,
          client: (d.clients as any)?.name ?? "—",
          time: d.created_at,
          companyId: d.company_id,
        });
      });

      (recentDossiers ?? []).forEach((d) => {
        items.push({
          id: d.id,
          type: "dossier",
          label: `Dossier ${d.code || ""} — ${d.title}`,
          client: (d.clients as any)?.name ?? "—",
          time: d.created_at,
          companyId: d.company_id,
        });
      });

      (recentFactures ?? []).forEach((f) => {
        const amount = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(f.amount));
        items.push({
          id: f.id,
          type: "facture",
          label: `Facture ${f.code || ""} — ${amount}`,
          client: (f.clients as any)?.name ?? "—",
          time: f.created_at,
          companyId: f.company_id,
        });
      });

      (recentVisites ?? []).forEach((v) => {
        items.push({
          id: v.id,
          type: "visite",
          label: `Visite — ${v.title}`,
          client: (v.clients as any)?.name ?? "—",
          time: v.scheduled_date || v.status,
          companyId: v.company_id,
        });
      });

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return items.slice(0, 10);
    },
    enabled: companyIds.length > 0,
  });
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Hier";
  if (diffD < 7) return `Il y a ${diffD}j`;
  return format(date, "d MMM", { locale: fr });
}

const Dashboard = () => {
  const { current, currentCompany, dbCompanies, setCurrent } = useCompany();
  const companyIds = useCompanyFilter();
  const { data: stats, isLoading: statsLoading } = useStats(companyIds);
  const { data: activity, isLoading: activityLoading } = useRecentActivity(companyIds);
  const isMobile = useIsMobile();
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<{ open: boolean; blobUrl: string | null; dataUri: string | null; fileName: string }>({
    open: false, blobUrl: null, dataUri: null, fileName: "",
  });

  const handlePreview = async (docType: string, docId: string) => {
    const key = `${docType}-${docId}`;
    setLoadingDoc(key);
    try {
      if (docType === "devis") {
        const result = await generateDevisPdf(docId, false, true);
        if (result && typeof result === "object" && "blobUrl" in result) {
          setPreviewState({ open: true, blobUrl: result.blobUrl, dataUri: result.dataUri, fileName: result.fileName });
        }
      } else if (docType === "facture") {
        const result = await generateFacturePdf(docId, true);
        if (result && typeof result === "object" && "blobUrl" in result) {
          setPreviewState({ open: true, blobUrl: result.blobUrl, dataUri: result.dataUri, fileName: result.fileName });
        }
      }
    } catch {
      toast.error("Erreur lors de la génération du document");
    } finally {
      setLoadingDoc(null);
    }
  };

  const handleDownload = async (docType: string, docId: string) => {
    const key = `dl-${docType}-${docId}`;
    setLoadingDoc(key);
    try {
      if (docType === "devis") {
        await generateDevisPdf(docId);
      } else if (docType === "facture") {
        await generateFacturePdf(docId);
      }
      toast.success("Document téléchargé");
    } catch {
      toast.error("Erreur lors du téléchargement");
    } finally {
      setLoadingDoc(null);
    }
  };

  // Top dossiers rentabilité
  const { data: topDossiers } = useQuery({
    queryKey: ["dashboard-top-rentabilite", companyIds],
    queryFn: async () => {
      let q = supabase.from("dossiers").select("id, code, title, amount, clients(name)").in("company_id", companyIds).not("amount", "is", null).neq("amount", 0);
      const { data: dossiers } = await q.limit(20);
      if (!dossiers?.length) return [];
      const ids = dossiers.map((d) => d.id);
      const { data: costs } = await supabase.from("dossier_costs").select("dossier_id, amount").in("dossier_id", ids);
      const costMap: Record<string, number> = {};
      for (const c of costs || []) costMap[c.dossier_id] = (costMap[c.dossier_id] || 0) + Number(c.amount);
      return dossiers
        .filter((d) => costMap[d.id] !== undefined)
        .map((d) => {
          const ca = Number(d.amount);
          const cost = costMap[d.id] || 0;
          const margin = ca - cost;
          const marginPct = ca > 0 ? Math.round((margin / ca) * 100) : 0;
          return { ...d, margin, marginPct, clientName: (d.clients as any)?.name || "—" };
        })
        .sort((a, b) => b.marginPct - a.marginPct)
        .slice(0, 5);
    },
    enabled: companyIds.length > 0,
  });

  const navigate = useNavigate();

  const statCards = [
    {
      label: "Dossiers actifs",
      value: stats?.dossiersActifs ?? 0,
      icon: FolderOpen,
      trend: `${stats?.dossiersActifs ?? 0} en cours`,
      link: "/dossiers",
    },
    {
      label: "Clients",
      value: stats?.totalClients ?? 0,
      icon: Users,
      trend: stats?.clientsNew ? `+${stats.clientsNew} ce mois` : "—",
      link: "/clients",
    },
    {
      label: "CA du mois",
      value: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(stats?.caThisMonth ?? 0),
      icon: DollarSign,
      trend: stats?.caChange ? `${Number(stats.caChange) >= 0 ? "+" : ""}${stats.caChange}%` : "—",
      link: "/finance",
    },
    {
      label: "Taux conversion",
      value: `${stats?.conversionRate ?? 0}%`,
      icon: TrendingUp,
      trend: `${stats?.devisAcceptes ?? 0}/${stats?.totalDevis ?? 0} devis acceptés`,
      link: "/devis",
    },
    {
      label: "Marge globale",
      value: stats?.globalMargin ? `${stats.globalMargin}%` : "—",
      icon: AlertTriangle,
      trend: stats?.globalMarginAmount !== undefined
        ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(stats.globalMarginAmount)
        : "—",
      link: "/dossiers",
    },
    {
      label: "Missions",
      value: stats?.eventsThisWeek ?? 0,
      icon: CalendarDays,
      trend: "Cette semaine",
      link: "/planning",
    },
  ];

  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? "p-3 pb-20 space-y-4" : "p-6 lg:p-8 space-y-8"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Dashboard</h1>
        {!isMobile && (
          <p className="text-muted-foreground mt-1">
            {current === "global" ? "Vue consolidée — toutes sociétés" : currentCompany.name}
          </p>
        )}
      </motion.div>

      {/* Company pills */}
      <motion.div className="flex gap-2 flex-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        {current === "global" && dbCompanies.map((c) => (
          <button
            key={c.id}
            onClick={() => setCurrent(c.id as CompanyId)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer`}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            {c.shortName}
          </button>
        ))}
        {current !== "global" && (
          <button
            onClick={() => setCurrent("global")}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
          >
            ← Vue globale
          </button>
        )}
      </motion.div>

      {/* Alerts */}
      <DashboardAlerts />

      {/* Stats */}
      <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"}`}>
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.3 }}
            className={`rounded-xl border bg-card cursor-pointer hover:shadow-md hover:border-primary/30 transition-all ${isMobile ? "p-3 space-y-1" : "p-5 space-y-3"}`}
            onClick={() => navigate(stat.link)}
          >
            <div className="flex items-center justify-between">
              <span className={`text-muted-foreground ${isMobile ? "text-[11px]" : "text-sm"}`}>{stat.label}</span>
              {!isMobile && <stat.icon className="h-4 w-4 text-muted-foreground" />}
            </div>
            {statsLoading ? (
              <Skeleton className={`${isMobile ? "h-6 w-16" : "h-8 w-24"}`} />
            ) : (
              <p className={`font-bold tracking-tight ${isMobile ? "text-base" : "text-2xl"}`}>{stat.value}</p>
            )}
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-success" />
              {stat.trend}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="rounded-xl border bg-card">
        <div className={`border-b ${isMobile ? "px-3 py-2" : "p-5"}`}>
          <h2 className={`font-semibold ${isMobile ? "text-sm" : ""}`}>Activité récente</h2>
        </div>
        <div className="divide-y">
          {activityLoading ? (
            Array.from({ length: isMobile ? 3 : 5 }).map((_, i) => (
              <div key={i} className={`flex items-center gap-3 ${isMobile ? "px-3 py-2.5" : "px-5 py-3.5"}`}>
                <Skeleton className="h-4 w-4 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className={`h-4 ${isMobile ? "w-32" : "w-48"}`} />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))
          ) : activity && activity.length > 0 ? (
            activity.map((item, i) => {
              const linkMap: Record<string, string> = {
                devis: `/devis/${item.id}`,
                dossier: `/dossiers/${item.id}`,
                facture: `/finance/${item.id}`,
                visite: `/visites/${item.id}`,
              };
              const hasDoc = item.type === "devis" || item.type === "facture";
              const previewKey = `${item.type}-${item.id}`;
              const dlKey = `dl-${item.type}-${item.id}`;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${isMobile ? "px-3 py-2.5" : "px-5 py-3.5"}`}
                  onClick={() => navigate(linkMap[item.type] || "/")}
                >
                  {statusIcon[item.type] || <Clock className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isMobile ? "text-xs" : "text-sm"}`}>{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.client}</p>
                  </div>
                  {hasDoc && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={loadingDoc === previewKey}
                        onClick={(e) => { e.stopPropagation(); handlePreview(item.type, item.id); }}
                      >
                        {loadingDoc === previewKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={loadingDoc === dlKey}
                        onClick={(e) => { e.stopPropagation(); handleDownload(item.type, item.id); }}
                      >
                        {loadingDoc === dlKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DownloadIcon className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  )}
                  {!isMobile && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(item.time)}
                    </span>
                  )}
                  {isMobile && !hasDoc && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              );
            })
          ) : (
            <div className={`text-center text-sm text-muted-foreground ${isMobile ? "px-3 py-6" : "px-5 py-8"}`}>
              Aucune activité récente
            </div>
          )}
        </div>
      </motion.div>

      {/* Top Rentabilité */}
      {topDossiers && topDossiers.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="rounded-xl border bg-card">
          <div className={`border-b flex items-center justify-between ${isMobile ? "px-3 py-2" : "p-5"}`}>
            <h2 className={`font-semibold flex items-center gap-2 ${isMobile ? "text-sm" : ""}`}>
              <BarChart3 className="h-4 w-4 text-primary" />
              Top Rentabilité
            </h2>
            <button onClick={() => navigate("/rentabilite")} className="text-xs text-primary hover:underline">
              Voir tout →
            </button>
          </div>
          <div className="divide-y">
            {topDossiers.map((d, i) => (
              <div
                key={d.id}
                onClick={() => navigate(`/dossiers/${d.id}`)}
                className={`flex items-center gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${isMobile ? "px-3 py-2.5" : "px-5 py-3"}`}
              >
                <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                {d.margin >= 0
                  ? <TrendingUp className="h-4 w-4 text-success shrink-0" />
                  : <TrendingDown className="h-4 w-4 text-destructive shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isMobile ? "text-xs" : "text-sm"}`}>{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.clientName}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${d.marginPct >= 20 ? "text-success" : d.marginPct >= 0 ? "text-warning" : "text-destructive"}`}>
                    {d.marginPct}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(d.margin)}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Actions — hidden on mobile since we have FABs */}
      {!isMobile && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <CreateClientDialog />
          <CreateDevisDialog />
          <CreateDossierDialog />
          <CreateFactureDialog />
        </motion.div>
      )}
    </div>
  );
};

export default Dashboard;
