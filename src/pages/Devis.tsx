import { motion } from "framer-motion";
import { Search, Plus, Filter, FileText, Eye, Download, Send, MoreHorizontal } from "lucide-react";
import { useCompany, type CompanyId } from "@/contexts/CompanyContext";

const companyDot: Record<CompanyId, string> = {
  global: "bg-primary",
  art: "bg-company-art",
  altigrues: "bg-company-altigrues",
  asdgm: "bg-company-asdgm",
};

const mockDevis = [
  { id: "DEV-2026-162", client: "LVMH Paris", objet: "Déménagement coffre-fort", date: "14/02/2026", validite: "14/03/2026", montant: "6 500,00 €", status: "En attente", company: "art" as CompanyId },
  { id: "DEV-2026-161", client: "Bouygues Construction", objet: "Grutage 200T — 3 jours", date: "13/02/2026", validite: "13/03/2026", montant: "24 800,00 €", status: "Envoyé", company: "altigrues" as CompanyId },
  { id: "DEV-2026-156", client: "LVMH Paris", objet: "Levage piano Steinway", date: "10/02/2026", validite: "10/03/2026", montant: "4 200,00 €", status: "Accepté", company: "art" as CompanyId },
  { id: "DEV-2026-150", client: "Vinci Immobilier", objet: "Manutention lourde chantier", date: "08/02/2026", validite: "08/03/2026", montant: "18 900,00 €", status: "Accepté", company: "art" as CompanyId },
  { id: "DEV-2026-148", client: "M. Dupont Pierre", objet: "Garde-meuble 6 mois", date: "06/02/2026", validite: "06/03/2026", montant: "2 400,00 €", status: "Refusé", company: "asdgm" as CompanyId },
  { id: "DEV-2026-145", client: "Eiffage TP", objet: "Location grue 50T", date: "04/02/2026", validite: "04/03/2026", montant: "45 000,00 €", status: "Relance J+5", company: "altigrues" as CompanyId },
];

const statusStyles: Record<string, string> = {
  "En attente": "bg-warning/10 text-warning",
  "Envoyé": "bg-info/10 text-info",
  "Accepté": "bg-success/10 text-success",
  "Refusé": "bg-destructive/10 text-destructive",
  "Relance J+5": "bg-warning/10 text-warning",
};

const stats = [
  { label: "En attente", count: 1, amount: "6 500 €" },
  { label: "Envoyés", count: 1, amount: "24 800 €" },
  { label: "Acceptés", count: 2, amount: "23 100 €" },
  { label: "Refusés", count: 1, amount: "2 400 €" },
];

const Devis = () => {
  const { current } = useCompany();
  const devis = current === "global" ? mockDevis : mockDevis.filter((d) => d.company === current);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devis / Cotations</h1>
          <p className="text-muted-foreground mt-1">{devis.length} devis</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Nouveau devis
        </button>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-bold mt-1">{s.count}</p>
            <p className="text-xs text-muted-foreground">{s.amount}</p>
          </div>
        ))}
      </motion.div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Rechercher un devis..." className="w-full rounded-lg border bg-card pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <button className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors">
          <Filter className="h-4 w-4" />
          Filtres
        </button>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left font-medium text-muted-foreground px-5 py-3">N°</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3">Client</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden lg:table-cell">Objet</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden md:table-cell">Date</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3 hidden md:table-cell">Validité</th>
              <th className="text-right font-medium text-muted-foreground px-5 py-3">Montant</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3">Statut</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {devis.map((d) => (
              <tr key={d.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="font-mono text-xs">{d.id}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${companyDot[d.company]}`} />
                    <span className="font-medium">{d.client}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-muted-foreground hidden lg:table-cell">{d.objet}</td>
                <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{d.date}</td>
                <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{d.validite}</td>
                <td className="px-5 py-3 text-right font-semibold">{d.montant}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[d.status] || ""}`}>{d.status}</span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-1">
                    <button className="p-1 rounded hover:bg-muted"><Eye className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    <button className="p-1 rounded hover:bg-muted"><Send className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    <button className="p-1 rounded hover:bg-muted"><Download className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default Devis;
