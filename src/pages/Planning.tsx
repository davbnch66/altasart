import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, Clock } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday, isSameDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

type ViewMode = "day" | "week" | "month";

const companyColors: Record<string, string> = {
  "company-art": "bg-company-art/80 text-company-art-foreground",
  "company-altigrues": "bg-company-altigrues/80 text-company-altigrues-foreground",
  "company-asdgm": "bg-company-asdgm/80 text-company-asdgm-foreground",
  primary: "bg-primary/80 text-primary-foreground",
};

const Planning = () => {
  const { current, setCurrent, companies, dbCompanies } = useCompany();
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const isMobile = useIsMobile();

  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const displayDays = view === "day" ? [currentDate] : weekDays.slice(0, isMobile ? 5 : 7);

  // Fetch resources
  const { data: resources = [] } = useQuery({
    queryKey: ["planning-resources", companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("resource_companies")
        .select("resource_id, resources(id, name, type, status)")
        .in("company_id", companyIds);
      if (error) throw error;
      const seen = new Set<string>();
      return (data || [])
        .map((rc: any) => rc.resources)
        .filter((r: any) => r && !seen.has(r.id) && seen.add(r.id));
    },
    enabled: companyIds.length > 0,
  });

  // Fetch events
  const { data: events = [] } = useQuery({
    queryKey: ["planning-events", companyIds, weekStart.toISOString()],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const rangeStart = weekStart.toISOString();
      const rangeEnd = addDays(weekStart, 7).toISOString();
      const { data, error } = await supabase
        .from("planning_events")
        .select("*, companies(color), resources(name), dossiers(title, code, clients(name))")
        .in("company_id", companyIds)
        .gte("start_time", rangeStart)
        .lt("start_time", rangeEnd)
        .order("start_time");
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0,
  });

  // Fetch operations for the week  
  const { data: operations = [] } = useQuery({
    queryKey: ["planning-operations", companyIds, weekStart.toISOString()],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const rangeStart = format(weekStart, "yyyy-MM-dd");
      const rangeEnd = format(addDays(weekStart, 7), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("operations")
        .select("*, dossiers(title, code, clients(name)), companies(color)")
        .in("company_id", companyIds)
        .gte("loading_date", rangeStart)
        .lt("loading_date", rangeEnd)
        .order("loading_date");
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0,
  });

  // Build resource rows (resources + unassigned row)
  const resourceRows = useMemo(() => {
    const rows = resources.map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.type,
    }));
    return [{ id: "__unassigned__", name: "Non assigné", type: "autre" }, ...rows];
  }, [resources]);

  // Map events to resource+day cells
  const getEventsForCell = (resourceId: string, day: Date) => {
    return events.filter((e: any) => {
      const eDay = startOfDay(new Date(e.start_time));
      const matchDay = isSameDay(eDay, day);
      const matchResource = resourceId === "__unassigned__"
        ? !e.resource_id
        : e.resource_id === resourceId;
      return matchDay && matchResource;
    });
  };

  const getOpsForDay = (day: Date) => {
    return operations.filter((op: any) =>
      op.loading_date && isSameDay(new Date(op.loading_date), day)
    );
  };

  const nav = (dir: number) => {
    if (view === "week") setCurrentDate(dir > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, dir));
  };

  const weekLabel = `Semaine ${format(weekStart, "w")} — ${format(weekStart, "d MMM", { locale: fr })} au ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}`;

  return (
    <div className={`max-w-full mx-auto h-full flex flex-col ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-5"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Planning Exploitation</h1>
          <p className={`text-muted-foreground ${isMobile ? "text-xs" : "text-sm"}`}>{weekLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`flex rounded-lg border bg-card p-0.5 gap-0.5 ${isMobile ? "overflow-x-auto scrollbar-none" : ""}`}>
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => setCurrent(c.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                  current === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {c.shortName}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Nav + view toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => nav(-1)} className="p-1.5 rounded-lg border hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className={`rounded-lg border font-medium hover:bg-muted transition-colors ${isMobile ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm"}`}>
            Aujourd'hui
          </button>
          <button onClick={() => nav(1)} className="p-1.5 rounded-lg border hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex rounded-lg border bg-card p-0.5 gap-0.5">
          {(["day", "week"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {v === "day" ? "Jour" : "Semaine"}
            </button>
          ))}
        </div>
      </div>

      {/* Resource grid */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex-1 rounded-xl border bg-card overflow-auto">
        <div className={isMobile ? "min-w-[600px]" : ""}>
          {/* Day headers */}
          <div className={`grid border-b sticky top-0 bg-card z-10`} style={{ gridTemplateColumns: `140px repeat(${displayDays.length}, 1fr)` }}>
            <div className="px-3 py-2 border-r text-[10px] font-semibold text-muted-foreground uppercase">Ressource</div>
            {displayDays.map((day) => (
              <div key={day.toISOString()} className={`px-2 py-2 text-center border-r last:border-r-0 ${isToday(day) ? "bg-primary/5" : ""}`}>
                <span className="text-[10px] text-muted-foreground">{format(day, "EEE", { locale: fr })}</span>
                <p className={`text-xs font-semibold mt-0.5 ${isToday(day) ? "text-primary" : ""}`}>{format(day, "d MMM", { locale: fr })}</p>
              </div>
            ))}
          </div>

          {/* Operations row (not resource-specific) */}
          {operations.length > 0 && (
            <div className="grid border-b" style={{ gridTemplateColumns: `140px repeat(${displayDays.length}, 1fr)` }}>
              <div className="px-3 py-2 border-r flex items-center">
                <span className="text-xs font-medium text-primary">Opérations</span>
              </div>
              {displayDays.map((day) => {
                const dayOps = getOpsForDay(day);
                return (
                  <div key={day.toISOString()} className={`border-r last:border-r-0 p-1 space-y-1 ${isToday(day) ? "bg-primary/5" : ""}`}>
                    {dayOps.map((op: any) => {
                      const color = companyColors[(op.companies as any)?.color] || "bg-primary/80 text-primary-foreground";
                      return (
                        <div key={op.id} className={`rounded-md px-2 py-1.5 text-[10px] ${color}`}>
                          <p className="font-medium truncate">
                            {(op.dossiers as any)?.clients?.name || "—"} · Op.{op.operation_number}
                          </p>
                          <p className="opacity-80 truncate flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" /> {op.loading_city || "—"} → {op.delivery_city || "—"}
                          </p>
                          {op.lv_bt_number && <p className="opacity-70 truncate">LV/BT: {op.lv_bt_number}</p>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Resource rows */}
          {resourceRows.map((resource: any) => (
            <div key={resource.id} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: `140px repeat(${displayDays.length}, 1fr)` }}>
              <div className="px-3 py-2 border-r flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full shrink-0 ${
                  resource.type === "employe" || resource.type === "equipe" ? "bg-info"
                  : resource.type === "vehicule" || resource.type === "grue" ? "bg-warning"
                  : "bg-muted-foreground"
                }`} />
                <span className="text-xs font-medium truncate">{resource.name}</span>
              </div>
              {displayDays.map((day) => {
                const cellEvents = getEventsForCell(resource.id, day);
                return (
                  <div key={day.toISOString()} className={`border-r last:border-r-0 p-1 space-y-1 min-h-[48px] ${isToday(day) ? "bg-primary/5" : ""}`}>
                    {cellEvents.map((evt: any) => {
                      const color = companyColors[(evt.companies as any)?.color] || "bg-primary/80 text-primary-foreground";
                      const client = (evt.dossiers as any)?.clients?.name;
                      const dossierCode = (evt.dossiers as any)?.code;
                      return (
                        <div key={evt.id} className={`rounded-md px-2 py-1.5 text-[10px] cursor-pointer hover:opacity-90 transition-opacity ${color}`}>
                          <p className="font-medium truncate">{evt.title}</p>
                          {client && <p className="opacity-80 truncate">{client}{dossierCode ? ` · ${dossierCode}` : ""}</p>}
                          <p className="opacity-70 truncate flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {format(new Date(evt.start_time), "HH:mm")} - {format(new Date(evt.end_time), "HH:mm")}
                          </p>
                          {evt.description && <p className="opacity-70 truncate">{evt.description}</p>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}

          {resourceRows.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              Aucune ressource. Ajoutez des ressources dans la section Ressources.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Planning;
