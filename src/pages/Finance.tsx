import { motion } from "framer-motion";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight } from "lucide-react";

const stats = [
  { label: "CA du mois", value: "142 500 €", icon: TrendingUp, change: "+8.2%", positive: true },
  { label: "Encours clients", value: "38 200 €", icon: DollarSign, change: "12 factures", positive: true },
  { label: "Impayés > 30j", value: "6 800 €", icon: AlertTriangle, change: "3 factures", positive: false },
  { label: "Encaissé ce mois", value: "98 400 €", icon: CheckCircle2, change: "+12.5%", positive: true },
];

const recentInvoices = [
  { id: "FAC-2026-042", client: "LVMH Paris", amount: "4 200 €", date: "12 fév", status: "Payée" },
  { id: "FAC-2026-041", client: "Bouygues Construction", amount: "18 500 €", date: "10 fév", status: "Envoyée" },
  { id: "FAC-2026-040", client: "Vinci Immobilier", amount: "8 400 €", date: "08 fév", status: "Payée" },
  { id: "FAC-2026-039", client: "Eiffage TP", amount: "12 300 €", date: "05 fév", status: "En retard" },
  { id: "FAC-2026-038", client: "M. Dupont Pierre", amount: "980 €", date: "03 fév", status: "Envoyée" },
];

const invoiceStatus: Record<string, string> = {
  "Payée": "bg-success/10 text-success",
  "Envoyée": "bg-info/10 text-info",
  "En retard": "bg-destructive/10 text-destructive",
};

const Finance = () => (
  <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
      <p className="text-muted-foreground mt-1">Suivi facturation et paiements</p>
    </motion.div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{stat.label}</span>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left font-medium text-muted-foreground px-5 py-3">N°</th>
            <th className="text-left font-medium text-muted-foreground px-5 py-3">Client</th>
            <th className="text-left font-medium text-muted-foreground px-5 py-3">Montant</th>
            <th className="text-left font-medium text-muted-foreground px-5 py-3">Date</th>
            <th className="text-left font-medium text-muted-foreground px-5 py-3">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {recentInvoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
              <td className="px-5 py-3 font-mono text-xs">{inv.id}</td>
              <td className="px-5 py-3 font-medium">{inv.client}</td>
              <td className="px-5 py-3 font-semibold">{inv.amount}</td>
              <td className="px-5 py-3 text-muted-foreground">{inv.date}</td>
              <td className="px-5 py-3">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${invoiceStatus[inv.status]}`}>{inv.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  </div>
);

export default Finance;
