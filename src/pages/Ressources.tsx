import { motion } from "framer-motion";
import { Users, Truck, HardHat, Wrench as WrenchIcon, Search, Filter } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

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

const Ressources = () => {
  const isMobile = useIsMobile();

  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Ressources</h1>
        {!isMobile && <p className="text-muted-foreground mt-1">Employés, matériel et équipements partagés</p>}
      </motion.div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Rechercher..." className={`w-full rounded-lg border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${isMobile ? "py-2 text-xs" : "py-2.5"}`} />
        </div>
        <button className={`flex items-center gap-1.5 rounded-lg border text-muted-foreground hover:bg-muted transition-colors ${isMobile ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"}`}>
          <Filter className="h-3.5 w-3.5" />
          {!isMobile && "Filtres"}
        </button>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className={`grid gap-3 ${isMobile ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {resources.map((res) => (
          <div key={res.id} className={`rounded-xl border bg-card hover:shadow-sm transition-shadow cursor-pointer space-y-2 ${isMobile ? "p-3" : "p-5 space-y-3"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`rounded-lg bg-muted flex items-center justify-center ${isMobile ? "h-8 w-8" : "h-10 w-10"}`}>
                  <res.icon className={`text-muted-foreground ${isMobile ? "h-4 w-4" : "h-5 w-5"}`} />
                </div>
                <div>
                  <p className={`font-medium ${isMobile ? "text-sm" : ""}`}>{res.name}</p>
                  <p className="text-[11px] text-muted-foreground">{res.type}</p>
                </div>
              </div>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle[res.status]}`}>{res.status}</span>
            </div>
            <div className="flex gap-1">
              {res.companies.map((c) => (
                <span key={c} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{c}</span>
              ))}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default Ressources;
