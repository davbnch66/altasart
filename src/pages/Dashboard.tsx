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
} from "lucide-react";
import { useCompany, companies, type CompanyId } from "@/contexts/CompanyContext";

const companyBg: Record<CompanyId, string> = {
  global: "bg-primary/10 text-primary",
  art: "bg-company-art/10 text-company-art",
  altigrues: "bg-company-altigrues/10 text-company-altigrues",
  asdgm: "bg-company-asdgm/10 text-company-asdgm",
};

const stats = [
  { label: "Dossiers actifs", value: "24", icon: FolderOpen, trend: "+3 cette semaine" },
  { label: "Clients", value: "187", icon: Users, trend: "+12 ce mois" },
  { label: "Missions planifiées", value: "18", icon: CalendarDays, trend: "Cette semaine" },
  { label: "CA du mois", value: "142 500 €", icon: DollarSign, trend: "+8.2%" },
];

const recentActivity = [
  { type: "devis", label: "Devis #2024-156 envoyé", client: "LVMH Paris", time: "Il y a 2h", status: "pending", company: "art" as CompanyId },
  { type: "mission", label: "Mission grutage terminée", client: "Bouygues Construction", time: "Il y a 4h", status: "done", company: "altigrues" as CompanyId },
  { type: "paiement", label: "Paiement reçu — 8 400 €", client: "Vinci Immobilier", time: "Hier", status: "paid", company: "art" as CompanyId },
  { type: "visite", label: "Visite technique planifiée", client: "Particulier — M. Dupont", time: "Hier", status: "planned", company: "asdgm" as CompanyId },
  { type: "relance", label: "Relance devis J+5", client: "Eiffage TP", time: "Il y a 2j", status: "warning", company: "altigrues" as CompanyId },
];

const statusIcon: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-info" />,
  done: <CheckCircle2 className="h-4 w-4 text-success" />,
  paid: <DollarSign className="h-4 w-4 text-success" />,
  planned: <CalendarDays className="h-4 w-4 text-primary" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning" />,
};

const companyDot: Record<CompanyId, string> = {
  global: "bg-primary",
  art: "bg-company-art",
  altigrues: "bg-company-altigrues",
  asdgm: "bg-company-asdgm",
};

const Dashboard = () => {
  const { current, currentCompany } = useCompany();

  const filteredActivity = current === "global"
    ? recentActivity
    : recentActivity.filter((a) => a.company === current);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          {current === "global" ? "Vue consolidée — toutes sociétés" : currentCompany.name}
        </p>
      </motion.div>

      {/* Company pills (global view) */}
      {current === "global" && (
        <motion.div
          className="flex gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {companies.filter((c) => c.id !== "global").map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${companyBg[c.id]}`}
            >
              <div className={`h-2 w-2 rounded-full ${companyDot[c.id]}`} />
              {c.shortName}
            </div>
          ))}
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.3 }}
            className="rounded-xl border bg-card p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-success" />
              {stat.trend}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="rounded-xl border bg-card"
      >
        <div className="p-5 border-b">
          <h2 className="font-semibold">Activité récente</h2>
        </div>
        <div className="divide-y">
          {filteredActivity.map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors">
              {statusIcon[item.status]}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.client}</p>
              </div>
              <div className={`h-1.5 w-1.5 rounded-full ${companyDot[item.company]}`} />
              <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {[
          { label: "Nouveau client", icon: Users },
          { label: "Créer devis", icon: FolderOpen },
          { label: "Planifier mission", icon: CalendarDays },
          { label: "Nouvelle visite", icon: CheckCircle2 },
        ].map((action) => (
          <button
            key={action.label}
            className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </button>
        ))}
      </motion.div>
    </div>
  );
};

export default Dashboard;
