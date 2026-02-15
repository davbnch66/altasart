import { motion } from "framer-motion";
import { Search, Plus, Filter, FolderOpen, MoreHorizontal } from "lucide-react";
import { useCompany, type CompanyId } from "@/contexts/CompanyContext";

const companyDot: Record<CompanyId, string> = {
  global: "bg-primary",
  art: "bg-company-art",
  altigrues: "bg-company-altigrues",
  asdgm: "bg-company-asdgm",
};

const pipelineStages = [
  { key: "prospect", label: "Prospect", color: "border-muted-foreground/30" },
  { key: "devis", label: "Devis envoyé", color: "border-info/50" },
  { key: "accepted", label: "Accepté", color: "border-success/50" },
  { key: "planned", label: "Planifié", color: "border-primary/50" },
  { key: "progress", label: "En cours", color: "border-warning/50" },
  { key: "done", label: "Terminé", color: "border-success/50" },
];

const mockDossiers = [
  { id: 1, title: "Levage piano LVMH", client: "LVMH Paris", stage: "progress", amount: "4 200 €", company: "art" as CompanyId },
  { id: 2, title: "Grutage chantier Défense", client: "Bouygues Construction", stage: "planned", amount: "18 500 €", company: "altigrues" as CompanyId },
  { id: 3, title: "Stockage mobilier Dupont", client: "M. Dupont Pierre", stage: "accepted", amount: "980 €", company: "asdgm" as CompanyId },
  { id: 4, title: "Manutention œuvres Louvre", client: "Vinci Immobilier", stage: "devis", amount: "12 800 €", company: "art" as CompanyId },
  { id: 5, title: "Location grue 3 mois", client: "Eiffage TP", stage: "prospect", amount: "45 000 €", company: "altigrues" as CompanyId },
  { id: 6, title: "Déménagement coffre-fort", client: "BNP Paribas", stage: "done", amount: "6 700 €", company: "art" as CompanyId },
];

const stageStyles: Record<string, string> = {
  prospect: "bg-muted text-muted-foreground",
  devis: "bg-info/10 text-info",
  accepted: "bg-success/10 text-success",
  planned: "bg-primary/10 text-primary",
  progress: "bg-warning/10 text-warning",
  done: "bg-success/10 text-success",
};

const Dossiers = () => {
  const { current } = useCompany();
  const dossiers = current === "global" ? mockDossiers : mockDossiers.filter((d) => d.company === current);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dossiers</h1>
          <p className="text-muted-foreground mt-1">{dossiers.length} dossiers</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Nouveau dossier
        </button>
      </motion.div>

      {/* Pipeline summary */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-2 overflow-x-auto pb-2">
        {pipelineStages.map((stage) => {
          const count = dossiers.filter((d) => d.stage === stage.key).length;
          return (
            <div key={stage.key} className={`flex items-center gap-2 rounded-lg border-2 ${stage.color} px-4 py-2 min-w-fit`}>
              <span className="text-sm font-medium">{stage.label}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{count}</span>
            </div>
          );
        })}
      </motion.div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Rechercher un dossier..." className="w-full rounded-lg border bg-card pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <button className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors">
          <Filter className="h-4 w-4" />
          Filtres
        </button>
      </div>

      {/* Cards */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="grid gap-3">
        {dossiers.map((dossier) => (
          <div key={dossier.id} className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4 hover:shadow-sm transition-shadow cursor-pointer">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{dossier.title}</p>
              <p className="text-xs text-muted-foreground">{dossier.client}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${companyDot[dossier.company]}`} />
            </div>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${stageStyles[dossier.stage]}`}>
              {pipelineStages.find((s) => s.key === dossier.stage)?.label}
            </span>
            <span className="text-sm font-semibold whitespace-nowrap">{dossier.amount}</span>
            <button className="p-1 rounded hover:bg-muted transition-colors">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default Dossiers;
