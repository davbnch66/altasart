import { motion } from "framer-motion";
import { Building2, Users, Shield, Bell, Database, Palette } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const sections = [
  { icon: Building2, label: "Sociétés", desc: "Gérer ART Levage, Altigrues et ASDGM" },
  { icon: Users, label: "Utilisateurs", desc: "Rôles et permissions" },
  { icon: Shield, label: "Sécurité", desc: "Authentification et RGPD" },
  { icon: Bell, label: "Notifications", desc: "Alertes et relances automatiques" },
  { icon: Database, label: "Import / Export", desc: "Migration depuis Safari GT" },
  { icon: Palette, label: "Personnalisation", desc: "Logo, couleurs et modèles" },
];

const Parametres = () => {
  const isMobile = useIsMobile();

  return (
    <div className={`max-w-3xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Paramètres</h1>
        {!isMobile && <p className="text-muted-foreground mt-1">Configuration de l'application</p>}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid gap-2">
        {sections.map((section) => (
          <div key={section.label} className={`flex items-center gap-3 rounded-xl border bg-card hover:shadow-sm transition-shadow cursor-pointer ${isMobile ? "px-3 py-3" : "px-5 py-4"}`}>
            <div className={`rounded-lg bg-muted flex items-center justify-center ${isMobile ? "h-8 w-8" : "h-10 w-10"}`}>
              <section.icon className={`text-muted-foreground ${isMobile ? "h-4 w-4" : "h-5 w-5"}`} />
            </div>
            <div className="min-w-0">
              <p className={`font-medium ${isMobile ? "text-sm" : ""}`}>{section.label}</p>
              <p className={`text-muted-foreground truncate ${isMobile ? "text-[11px]" : "text-sm"}`}>{section.desc}</p>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default Parametres;
