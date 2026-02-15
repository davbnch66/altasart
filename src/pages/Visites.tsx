import { motion } from "framer-motion";
import { ClipboardCheck, Plus, MapPin, Camera, Calendar } from "lucide-react";

const mockVisites = [
  { id: 1, title: "Visite levage piano", client: "LVMH Paris", address: "22 Avenue Montaigne, Paris", date: "12 fév 2026", status: "Planifiée", photos: 0 },
  { id: 2, title: "Évaluation grutage", client: "Bouygues Construction", address: "La Défense, Puteaux", date: "11 fév 2026", status: "Réalisée", photos: 8 },
  { id: 3, title: "Visite stockage", client: "M. Dupont Pierre", address: "15 Rue de la Paix, Lyon", date: "10 fév 2026", status: "Réalisée", photos: 4 },
];

const statusStyle: Record<string, string> = {
  "Planifiée": "bg-info/10 text-info",
  "Réalisée": "bg-success/10 text-success",
};

const Visites = () => (
  <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visites techniques</h1>
        <p className="text-muted-foreground mt-1">Planification et comptes rendus</p>
      </div>
      <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
        <Plus className="h-4 w-4" />
        Nouvelle visite
      </button>
    </motion.div>

    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid gap-4">
      {mockVisites.map((visite) => (
        <div key={visite.id} className="rounded-xl border bg-card p-5 hover:shadow-sm transition-shadow cursor-pointer">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mt-0.5">
                <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{visite.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{visite.client}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {visite.address}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {visite.date}</span>
                  <span className="flex items-center gap-1"><Camera className="h-3 w-3" /> {visite.photos} photos</span>
                </div>
              </div>
            </div>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[visite.status]}`}>
              {visite.status}
            </span>
          </div>
        </div>
      ))}
    </motion.div>
  </div>
);

export default Visites;
