import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, Clock, Plus } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlanningEventDialog } from "@/components/planning/PlanningEventDialog";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  isSameDay,
  isSameMonth,
  startOfDay,
  getDay,
} from "date-fns";
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

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [defaultResourceId, setDefaultResourceId] = useState<string | undefined>();

  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const displayDays = view === "day" ? [currentDate] : view === "week" ? weekDays.slice(0, isMobile ? 5 : 7) : [];

  // Month view days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  // Pad to start on Monday
  const firstDayOfWeek = getDay(monthStart);
  const paddingBefore = (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1);
  const paddedMonthDays = [
    ...Array.from({ length: paddingBefore }, (_, i) => addDays(monthStart, -(paddingBefore - i))),
    ...monthDays,
  ];
  // Pad to end on Sunday
  const remaining = 7 - (paddedMonthDays.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      paddedMonthDays.push(addDays(monthEnd, i));
    }
  }

  // Compute date range for queries
  const rangeStart = view === "month" ? paddedMonthDays[0] : weekStart;
  const rangeEnd = view === "month" ? paddedMonthDays[paddedMonthDays.length - 1] : addDays(weekStart, 7);

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
    queryKey: ["planning-events", companyIds, rangeStart.toISOString()],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("planning_events")
        .select("*, companies(color), resources(name), dossiers(title, code, clients(name))")
        .in("company_id", companyIds)
        .gte("start_time", rangeStart.toISOString())
        .lt("start_time", addDays(rangeEnd, 1).toISOString())
        .order("start_time");
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0,
  });

  // Fetch operations
  const { data: operations = [] } = useQuery({
    queryKey: ["planning-operations", companyIds, rangeStart.toISOString()],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("operations")
        .select("*, dossiers(title, code, clients(name)), companies(color)")
        .in("company_id", companyIds)
        .gte("loading_date", format(rangeStart, "yyyy-MM-dd"))
        .lt("loading_date", format(addDays(rangeEnd, 1), "yyyy-MM-dd"))
        .order("loading_date");
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0,
  });

  // Build resource rows
  const resourceRows = useMemo(() => {
    const rows = resources.map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.type,
    }));
    return [{ id: "__unassigned__", name: "Non assigné", type: "autre" }, ...rows];
  }, [resources]);

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

  const getEventsForDay = (day: Date) => {
    return events.filter((e: any) => isSameDay(startOfDay(new Date(e.start_time)), day));
  };

  const getOpsForDay = (day: Date) => {
    return operations.filter((op: any) =>
      op.loading_date && isSameDay(new Date(op.loading_date), day)
    );
  };

  const nav = (dir: number) => {
    if (view === "month") setCurrentDate(dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (view === "week") setCurrentDate(dir > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, dir));
  };

  const headerLabel = view === "month"
    ? format(currentDate, "MMMM yyyy", { locale: fr })
    : `Semaine ${format(weekStart, "w")} — ${format(weekStart, "d MMM", { locale: fr })} au ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}`;

  const openCreate = (date?: Date, resourceId?: string) => {
    setEditingEvent(null);
    setDefaultDate(date);
    setDefaultResourceId(resourceId);
    setDialogOpen(true);
  };

  const openEdit = (evt: any) => {
    setEditingEvent(evt);
    setDialogOpen(true);
  };

  return (
    <div className={`max-w-full mx-auto h-full flex flex-col ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-5"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Planning Exploitation</h1>
          <p className={`text-muted-foreground capitalize ${isMobile ? "text-xs" : "text-sm"}`}>{headerLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={() => openCreate()} className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Événement
          </Button>
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
          {(["day", "week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
      </div>

      {/* Month View */}
      {view === "month" ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex-1 rounded-xl border bg-card overflow-auto">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b bg-card sticky top-0 z-10">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div key={d} className="text-center text-[10px] text-muted-foreground font-semibold py-2 border-r last:border-r-0">{d}</div>
            ))}
          </div>
          {/* Weeks */}
          <div className="grid grid-cols-7">
            {paddedMonthDays.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const dayOps = getOpsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              return (
                <div
                  key={i}
                  className={`border-r border-b last:border-r-0 min-h-[80px] p-1 cursor-pointer hover:bg-muted/20 transition-colors ${
                    isToday(day) ? "bg-primary/5" : ""
                  } ${!isCurrentMonth ? "opacity-40" : ""}`}
                  onClick={() => openCreate(day)}
                >
                  <p className={`text-[11px] font-medium mb-1 ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </p>
                  {dayEvents.slice(0, 3).map((evt: any) => {
                    const color = companyColors[(evt.companies as any)?.color] || "bg-primary/80 text-primary-foreground";
                    return (
                      <div
                        key={evt.id}
                        className={`rounded px-1 py-0.5 text-[9px] truncate mb-0.5 cursor-pointer ${color}`}
                        onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                      >
                        {format(new Date(evt.start_time), "HH:mm")} {evt.title}
                      </div>
                    );
                  })}
                  {dayOps.slice(0, 2).map((op: any) => {
                    const color = companyColors[(op.companies as any)?.color] || "bg-primary/80 text-primary-foreground";
                    return (
                      <div key={op.id} className={`rounded px-1 py-0.5 text-[9px] truncate mb-0.5 ${color}`}>
                        Op.{op.operation_number}
                      </div>
                    );
                  })}
                  {(dayEvents.length + dayOps.length) > 3 && (
                    <p className="text-[9px] text-muted-foreground">+{dayEvents.length + dayOps.length - 3}</p>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        /* Day/Week Resource Grid */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex-1 rounded-xl border bg-card overflow-auto">
          <div className={isMobile ? "min-w-[600px]" : ""}>
            {/* Day headers */}
            <div className="grid border-b sticky top-0 bg-card z-10" style={{ gridTemplateColumns: `140px repeat(${displayDays.length}, 1fr)` }}>
              <div className="px-3 py-2 border-r text-[10px] font-semibold text-muted-foreground uppercase">Ressource</div>
              {displayDays.map((day) => (
                <div key={day.toISOString()} className={`px-2 py-2 text-center border-r last:border-r-0 ${isToday(day) ? "bg-primary/5" : ""}`}>
                  <span className="text-[10px] text-muted-foreground">{format(day, "EEE", { locale: fr })}</span>
                  <p className={`text-xs font-semibold mt-0.5 ${isToday(day) ? "text-primary" : ""}`}>{format(day, "d MMM", { locale: fr })}</p>
                </div>
              ))}
            </div>

            {/* Operations row */}
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
                    <div
                      key={day.toISOString()}
                      className={`border-r last:border-r-0 p-1 space-y-1 min-h-[48px] cursor-pointer hover:bg-muted/20 transition-colors ${isToday(day) ? "bg-primary/5" : ""}`}
                      onClick={() => openCreate(day, resource.id === "__unassigned__" ? undefined : resource.id)}
                    >
                      {cellEvents.map((evt: any) => {
                        const color = companyColors[(evt.companies as any)?.color] || "bg-primary/80 text-primary-foreground";
                        const client = (evt.dossiers as any)?.clients?.name;
                        const dossierCode = (evt.dossiers as any)?.code;
                        return (
                          <div
                            key={evt.id}
                            className={`rounded-md px-2 py-1.5 text-[10px] cursor-pointer hover:opacity-90 transition-opacity ${color}`}
                            onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                          >
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
      )}

      {/* CRUD Dialog */}
      <PlanningEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editingEvent}
        defaultDate={defaultDate}
        defaultResourceId={defaultResourceId}
      />
    </div>
  );
};

export default Planning;
