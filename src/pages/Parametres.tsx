import { motion } from "framer-motion";
import { Building2, Users, Shield, Bell, Database, Palette } from "lucide-react";

const sections = [
  { icon: Building2, label: "Sociétés", desc: "Gérer ART Levage, Altigrues et ASDGM" },
  { icon: Users, label: "Utilisateurs", desc: "Rôles et permissions" },
  { icon: Shield, label: "Sécurité", desc: "Authentification et RGPD" },
  { icon: Bell, label: "Notifications", desc: "Alertes et relances automatiques" },
  { icon: Database, label: "Import / Export", desc: "Migration depuis Safari GT" },
  { icon: Palette, label: "Personnalisation", desc: "Logo, couleurs et modèles" },
];

const Parametres = () => (
  <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
      <p className="text-muted-foreground mt-1">Configuration de l'application</p>
    </motion.div>

    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid gap-3">
      {sections.map((section) => (
        <div key={section.label} className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4 hover:shadow-sm transition-shadow cursor-pointer">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
            <section.icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{section.label}</p>
            <p className="text-sm text-muted-foreground">{section.desc}</p>
          </div>
        </div>
      ))}
    </motion.div>
  </div>
);

export default Parametres;
