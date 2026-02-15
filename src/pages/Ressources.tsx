import { motion } from "framer-motion";
import { Users, Truck, HardHat, Wrench as WrenchIcon, Search, Filter } from "lucide-react";

const resources = [
  { id: 1, name: "Marc Dubois", type: "Grutier", status: "Disponible", companies: ["ART", "Altigrues"], icon: HardHat },
  { id: 2, name: "Grue Liebherr 200T", type: "Grue", status: "Occupé", companies: ["Altigrues"], icon: WrenchIcon },
  { id: 3, name: "Camion MAN 26T", type: "Véhicule", status: "Disponible", companies: ["ART", "ASDGM"], icon: Truck },
  { id: 4, name: "Équipe Alpha", type: "Équipe", status: "En mission", companies: ["ART"], icon: Users },
  { id: 5, name: "Grue Potain 50T", type: "Grue", status: "Maintenance", companies: ["Altigrues"], icon: WrenchIcon },
  { id: 6, name: "Sophie Laurent", type: "Technicienne", status: "Disponible", companies: ["ART", "Altigrues", "ASDGM"], icon: HardHat },
];

const statusStyle: Record<string, string> = {
  "Disponible": "bg-success/10 text-success",
  "Occupé": "bg-warning/10 text-warning",
  "En mission": "bg-info/10 text-info",
  "Maintenance": "bg-destructive/10 text-destructive",
};

const Ressources = () => (
  <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-bold tracking-tight">Ressources</h1>
      <p className="text-muted-foreground mt-1">Employés, matériel et équipements partagés</p>
    </motion.div>

    <div className="flex gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" placeholder="Rechercher une ressource..." className="w-full rounded-lg border bg-card pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <button className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors">
        <Filter className="h-4 w-4" />
        Filtres
      </button>
    </div>

    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {resources.map((res) => (
        <div key={res.id} className="rounded-xl border bg-card p-5 hover:shadow-sm transition-shadow cursor-pointer space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <res.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{res.name}</p>
                <p className="text-xs text-muted-foreground">{res.type}</p>
              </div>
            </div>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[res.status]}`}>{res.status}</span>
          </div>
          <div className="flex gap-1.5">
            {res.companies.map((c) => (
              <span key={c} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{c}</span>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  </div>
);

export default Ressources;
