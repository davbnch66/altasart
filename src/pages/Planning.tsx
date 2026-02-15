import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCompany, type CompanyId } from "@/contexts/CompanyContext";
import { useState } from "react";

const companyBg: Record<CompanyId, string> = {
  global: "bg-primary/80",
  art: "bg-company-art/80",
  altigrues: "bg-company-altigrues/80",
  asdgm: "bg-company-asdgm/80",
};

const companyText: Record<CompanyId, string> = {
  global: "text-primary-foreground",
  art: "text-company-art-foreground",
  altigrues: "text-company-altigrues-foreground",
  asdgm: "text-company-asdgm-foreground",
};

const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const hours = Array.from({ length: 10 }, (_, i) => `${i + 7}:00`);

type ViewMode = "day" | "week" | "month";

const mockEvents = [
  { id: 1, title: "Grutage Tour Eiffel", resource: "Grue 200T", hour: 8, duration: 4, day: 0, company: "altigrues" as CompanyId },
  { id: 2, title: "Levage Piano Steinway", resource: "Équipe A", hour: 9, duration: 2, day: 0, company: "art" as CompanyId },
  { id: 3, title: "Stockage lot #45", resource: "Entrepôt B", hour: 7, duration: 8, day: 1, company: "asdgm" as CompanyId },
  { id: 4, title: "Manutention Chantier Vinci", resource: "Équipe B", hour: 10, duration: 3, day: 2, company: "art" as CompanyId },
  { id: 5, title: "Location grue 50T", resource: "Grue 50T", hour: 7, duration: 6, day: 3, company: "altigrues" as CompanyId },
  { id: 6, title: "Visite technique M. Dupont", resource: "Tech 1", hour: 14, duration: 2, day: 4, company: "art" as CompanyId },
];

const Planning = () => {
  const { current, setCurrent, companies } = useCompany();
  const [view, setView] = useState<ViewMode>("week");

  const events = current === "global" ? mockEvents : mockEvents.filter((e) => e.company === current);

  return (
    <div className="p-6 lg:p-8 max-w-full mx-auto space-y-6 h-full flex flex-col">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
          <p className="text-muted-foreground mt-1">Semaine du 10 février 2026</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Company filter tabs */}
          <div className="flex rounded-lg border bg-card p-0.5 gap-0.5">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => setCurrent(c.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  current === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {c.shortName}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* View switcher + navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg border hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">
            Aujourd'hui
          </button>
          <button className="p-2 rounded-lg border hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex rounded-lg border bg-card p-0.5 gap-0.5">
          {(["day", "week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
      </div>

      {/* Weekly grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex-1 rounded-xl border bg-card overflow-auto"
      >
        <div className="min-w-[800px]">
          {/* Day headers */}
          <div className="grid grid-cols-[80px_repeat(5,1fr)] border-b sticky top-0 bg-card z-10">
            <div className="px-3 py-2 border-r" />
            {days.slice(0, 5).map((day, i) => (
              <div key={day} className="px-3 py-2 text-center border-r last:border-r-0">
                <span className="text-xs text-muted-foreground">{day}</span>
                <p className="text-sm font-semibold mt-0.5">{10 + i}</p>
              </div>
            ))}
          </div>

          {/* Time slots */}
          {hours.map((hour, hi) => (
            <div key={hour} className="grid grid-cols-[80px_repeat(5,1fr)] border-b last:border-b-0 min-h-[60px]">
              <div className="px-3 py-2 text-xs text-muted-foreground border-r flex items-start justify-end">
                {hour}
              </div>
              {days.slice(0, 5).map((_, di) => {
                const event = events.find((e) => e.day === di && e.hour === hi + 7);
                return (
                  <div key={di} className="border-r last:border-r-0 relative p-0.5">
                    {event && (
                      <div
                        className={`absolute inset-x-1 rounded-md px-2 py-1 text-xs cursor-pointer hover:opacity-90 transition-opacity ${companyBg[event.company]} ${companyText[event.company]}`}
                        style={{ height: `${event.duration * 60 - 4}px`, zIndex: 5 }}
                      >
                        <p className="font-medium truncate">{event.title}</p>
                        <p className="opacity-80 truncate">{event.resource}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Planning;
