import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FolderOpen,
  Users,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Eye,
} from "lucide-react";
import { CreateClientDialog } from "@/components/forms/CreateClientDialog";
import { CreateDevisDialog } from "@/components/forms/CreateDevisDialog";
import { CreateDossierDialog } from "@/components/forms/CreateDossierDialog";
import { CreateFactureDialog } from "@/components/forms/CreateFactureDialog";
import { useCompany, type CompanyId } from "@/contexts/CompanyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";

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
      ]);

      const caThisMonth = (facturesThisMonth ?? []).reduce((s, f) => s + Number(f.amount), 0);
      const caPrevMonth = (facturesPrevMonth ?? []).reduce((s, f) => s + Number(f.amount), 0);
      const caChange = caPrevMonth > 0 ? (((caThisMonth - caPrevMonth) / caPrevMonth) * 100).toFixed(1) : null;

      const clientsNew = (totalClients ?? 0) - (clientsPrevMonth ?? 0);

      return {
        dossiersActifs: dossiersActifs ?? 0,
        totalClients: totalClients ?? 0,
        eventsThisWeek: eventsThisWeek ?? 0,
        caThisMonth,
        caChange,
        clientsNew,
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

      // Sort by time descending, take 10
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
      label: "Missions planifiées",
      value: stats?.eventsThisWeek ?? 0,
      icon: CalendarDays,
      trend: "Cette semaine",
      link: "/planning",
    },
    {
      label: "CA du mois",
      value: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(stats?.caThisMonth ?? 0),
      icon: DollarSign,
      trend: stats?.caChange ? `${Number(stats.caChange) >= 0 ? "+" : ""}${stats.caChange}%` : "—",
      link: "/finance",
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {current === "global" ? "Vue consolidée — toutes sociétés" : currentCompany.name}
        </p>
      </motion.div>

      {/* Company pills (global view) */}
      <motion.div className="flex gap-3 flex-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        {current === "global" && dbCompanies.map((c) => (
          <button
            key={c.id}
            onClick={() => setCurrent(c.id as CompanyId)}
            className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
          >
            <div className="h-2 w-2 rounded-full bg-primary" />
            {c.shortName}
          </button>
        ))}
        {current !== "global" && (
          <button
            onClick={() => setCurrent("global")}
            className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
          >
            ← Vue globale
          </button>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.3 }}
            className="rounded-xl border bg-card p-5 space-y-3 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
            onClick={() => navigate(stat.link)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-success" />
              {stat.trend}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="rounded-xl border bg-card">
        <div className="p-5 border-b">
          <h2 className="font-semibold">Activité récente</h2>
        </div>
        <div className="divide-y">
          {activityLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <Skeleton className="h-4 w-4 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))
          ) : activity && activity.length > 0 ? (
            activity.map((item, i) => {
              const linkMap: Record<string, string> = {
                devis: `/devis/${item.id}`,
                dossier: "/dossiers",
                facture: "/finance",
                visite: "/visites",
              };
              return (
                <div
                  key={i}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(linkMap[item.type] || "/")}
                >
                  {statusIcon[item.type] || <Clock className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.client}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(item.time)}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Aucune activité récente
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CreateClientDialog />
        <CreateDevisDialog />
        <CreateDossierDialog />
        <CreateFactureDialog />
      </motion.div>
    </div>
  );
};

export default Dashboard;
