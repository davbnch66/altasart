import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { AlertTriangle, Clock, FileText, CalendarDays, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, addDays, isBefore } from "date-fns";
import { fr } from "date-fns/locale";

interface AlertItem {
  id: string;
  type: "overdue_invoice" | "expiring_devis" | "upcoming_event" | "overdue_maintenance";
  severity: "error" | "warning" | "info";
  title: string;
  description: string;
  link: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  error: "border-destructive/30 bg-destructive/5",
  warning: "border-warning/30 bg-warning/5",
  info: "border-info/30 bg-info/5",
};

const SEVERITY_ICON_COLOR: Record<string, string> = {
  error: "text-destructive",
  warning: "text-warning",
  info: "text-info",
};

export function DashboardAlerts() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { current, dbCompanies } = useCompany();
  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];

  const { data: alerts = [] } = useQuery({
    queryKey: ["dashboard-alerts", companyIds],
    queryFn: async () => {
      const items: AlertItem[] = [];
      const now = new Date();
      const in7days = addDays(now, 7);

      const [
        { data: overdueInvoices },
        { data: expiringDevis },
        { data: upcomingEvents },
      ] = await Promise.all([
        // Overdue invoices
        supabase
          .from("factures")
          .select("id, code, amount, due_date, clients(name)")
          .in("company_id", companyIds)
          .in("status", ["envoyee", "en_retard"])
          .lt("due_date", now.toISOString().slice(0, 10))
          .order("due_date")
          .limit(5),
        // Expiring devis (within 7 days)
        supabase
          .from("devis")
          .select("id, code, objet, valid_until, clients(name)")
          .in("company_id", companyIds)
          .eq("status", "envoye")
          .lte("valid_until", in7days.toISOString().slice(0, 10))
          .gte("valid_until", now.toISOString().slice(0, 10))
          .order("valid_until")
          .limit(5),
        // Upcoming events (next 48h)
        supabase
          .from("planning_events")
          .select("id, title, start_time, dossiers(clients(name))")
          .in("company_id", companyIds)
          .gte("start_time", now.toISOString())
          .lte("start_time", addDays(now, 2).toISOString())
          .order("start_time")
          .limit(5),
      ]);

      (overdueInvoices ?? []).forEach((inv) => {
        const daysLate = Math.floor((now.getTime() - new Date(inv.due_date!).getTime()) / 86400000);
        items.push({
          id: `inv-${inv.id}`,
          type: "overdue_invoice",
          severity: daysLate > 30 ? "error" : "warning",
          title: `Facture ${inv.code || ""} en retard`,
          description: `${(inv.clients as any)?.name} · ${daysLate}j de retard · ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(inv.amount))}`,
          link: `/finance/${inv.id}`,
        });
      });

      (expiringDevis ?? []).forEach((d) => {
        const daysLeft = Math.max(0, Math.floor((new Date(d.valid_until!).getTime() - now.getTime()) / 86400000));
        items.push({
          id: `dev-${d.id}`,
          type: "expiring_devis",
          severity: daysLeft <= 2 ? "warning" : "info",
          title: `Devis ${d.code || ""} expire ${daysLeft === 0 ? "aujourd'hui" : `dans ${daysLeft}j`}`,
          description: `${(d.clients as any)?.name} · ${d.objet}`,
          link: `/devis/${d.id}`,
        });
      });

      (upcomingEvents ?? []).forEach((ev) => {
        const clientName = (ev.dossiers as any)?.clients?.name;
        items.push({
          id: `evt-${ev.id}`,
          type: "upcoming_event",
          severity: "info",
          title: ev.title,
          description: `${format(new Date(ev.start_time), "EEEE d MMM 'à' HH:mm", { locale: fr })}${clientName ? ` · ${clientName}` : ""}`,
          link: "/planning",
        });
      });

      // Sort: errors first, then warnings, then info
      const order: Record<string, number> = { error: 0, warning: 1, info: 2 };
      items.sort((a, b) => order[a.severity] - order[b.severity]);

      return items;
    },
    enabled: companyIds.length > 0,
    refetchInterval: 60000,
  });

  if (alerts.length === 0) return null;

  const iconMap: Record<string, typeof AlertTriangle> = {
    overdue_invoice: AlertTriangle,
    expiring_devis: FileText,
    upcoming_event: CalendarDays,
    overdue_maintenance: Clock,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="space-y-2"
    >
      <h2 className={`font-semibold flex items-center gap-2 ${isMobile ? "text-sm" : ""}`}>
        <AlertTriangle className="h-4 w-4 text-warning" />
        Alertes ({alerts.length})
      </h2>
      <div className={`grid gap-2 ${isMobile ? "" : "grid-cols-2 lg:grid-cols-3"}`}>
        {alerts.slice(0, isMobile ? 3 : 6).map((alert) => {
          const Icon = iconMap[alert.type] || AlertTriangle;
          return (
            <button
              key={alert.id}
              onClick={() => navigate(alert.link)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all hover:shadow-sm ${SEVERITY_STYLES[alert.severity]}`}
            >
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${SEVERITY_ICON_COLOR[alert.severity]}`} />
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${isMobile ? "text-xs" : "text-sm"}`}>{alert.title}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{alert.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
