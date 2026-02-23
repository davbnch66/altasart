import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, Plus, Briefcase, Truck, User, Globe, ClipboardList } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useState, useMemo, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanningEventDialog } from "@/components/planning/PlanningEventDialog";
import { PlanningOperationDialog } from "@/components/planning/PlanningOperationDialog";
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
import { useNavigate } from "react-router-dom";

type ViewMode = "day" | "week" | "month";
type PlanningType = "exploitation" | "commercial";
type ExploitationMode = "operation" | "vehicule" | "personnel";

// Vibrant palette for event rows (exploitation)
const ROW_COLORS = [
  "bg-[hsl(142,76%,36%)]/20 border-[hsl(142,76%,36%)]/50 text-[hsl(142,76%,20%)]",
  "bg-[hsl(217,91%,60%)]/20 border-[hsl(217,91%,60%)]/50 text-[hsl(217,91%,35%)]",
  "bg-[hsl(280,67%,55%)]/20 border-[hsl(280,67%,55%)]/50 text-[hsl(280,67%,35%)]",
  "bg-[hsl(32,95%,44%)]/20 border-[hsl(32,95%,44%)]/50 text-[hsl(32,95%,28%)]",
  "bg-[hsl(354,70%,54%)]/20 border-[hsl(354,70%,54%)]/50 text-[hsl(354,70%,35%)]",
  "bg-[hsl(188,78%,41%)]/20 border-[hsl(188,78%,41%)]/50 text-[hsl(188,78%,25%)]",
  "bg-[hsl(48,95%,53%)]/20 border-[hsl(48,95%,53%)]/50 text-[hsl(48,95%,28%)]",
];

const EVENT_BG_COLORS = [
  "bg-[hsl(142,76%,36%)] text-white",
  "bg-[hsl(217,91%,60%)] text-white",
  "bg-[hsl(280,67%,55%)] text-white",
  "bg-[hsl(32,95%,44%)] text-white",
  "bg-[hsl(354,70%,54%)] text-white",
  "bg-[hsl(188,78%,41%)] text-white",
  "bg-[hsl(48,95%,53%)] text-foreground",
];

const companyColors: Record<string, string> = {
  "company-art": "bg-company-art text-company-art-foreground",
  "company-altigrues": "bg-company-altigrues text-company-altigrues-foreground",
  "company-asdgm": "bg-company-asdgm text-company-asdgm-foreground",
  primary: "bg-primary text-primary-foreground",
};

const Planning = () => {
  const { current, setCurrent, companies, dbCompanies } = useCompany();
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();
  const [planningType, setPlanningType] = useState<PlanningType>(() => {
    return (sessionStorage.getItem("planningTab") as PlanningType) || "exploitation";
  });
  const [selectedCommercial, setSelectedCommercial] = useState<string>("global");
  const [exploitationMode, setExploitationMode] = useState<ExploitationMode>(() => {
    return (sessionStorage.getItem("exploitationMode") as ExploitationMode) || "vehicule";
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    sessionStorage.setItem("exploitationMode", exploitationMode);
  }, [exploitationMode]);

  useEffect(() => {
    sessionStorage.setItem("planningTab", planningType);
  }, [planningType]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [defaultResourceId, setDefaultResourceId] = useState<string | undefined>();
  const [opDialogOpen, setOpDialogOpen] = useState(false);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);

  const companyIds = current === "global"
    ? dbCompanies.map((c) => c.id)
    : [current];

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const displayDays = view === "day" ? [currentDate] : view === "week" ? weekDays.slice(0, isMobile ? 5 : 7) : [];

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = getDay(monthStart);
  const paddingBefore = (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1);
  const paddedMonthDays = [
    ...Array.from({ length: paddingBefore }, (_, i) => addDays(monthStart, -(paddingBefore - i))),
    ...monthDays,
  ];
  const remaining = 7 - (paddedMonthDays.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) paddedMonthDays.push(addDays(monthEnd, i));
  }

  const rangeStart = view === "month" ? paddedMonthDays[0] : view === "day" ? currentDate : weekStart;
  const rangeEnd = view === "month" ? paddedMonthDays[paddedMonthDays.length - 1] : view === "day" ? addDays(currentDate, 1) : addDays(weekStart, 7);

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
    queryKey: ["planning-events", companyIds, rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("planning_events")
        .select("*, companies(color), resources(name), dossiers(title, code, clients(name))")
        .in("company_id", companyIds)
        .lt("start_time", addDays(rangeEnd, 1).toISOString())
        .gte("end_time", rangeStart.toISOString())
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

  // Fetch operation_resources to link operations to resources
  const { data: opResources = [] } = useQuery({
    queryKey: ["planning-op-resources", companyIds, rangeStart.toISOString()],
    queryFn: async () => {
      if (companyIds.length === 0 || operations.length === 0) return [];
      const opIds = operations.map((op: any) => op.id);
      const { data, error } = await supabase
        .from("operation_resources")
        .select("operation_id, resource_id, resources(id, name, type)")
        .in("operation_id", opIds);
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0 && operations.length > 0 && planningType === "exploitation",
  });

  const { data: visites = [] } = useQuery({
    queryKey: ["planning-visites", companyIds, rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("visites")
        .select("*, clients(name, advisor), companies(color)")
        .in("company_id", companyIds)
        .gte("scheduled_date", format(rangeStart, "yyyy-MM-dd"))
        .lt("scheduled_date", format(addDays(rangeEnd, 1), "yyyy-MM-dd"))
        .order("scheduled_date");
      if (error) return [];
      return data || [];
    },
    enabled: companyIds.length > 0 && planningType === "commercial",
  });

  // Fetch devis for commercial planning
  const { data: devisData = [] } = useQuery({
    queryKey: ["planning-devis", companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("devis")
        .select("*, clients(name, advisor), companies(color)")
        .in("company_id", companyIds)
        .in("status", ["brouillon", "envoye"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return [];
      return data || [];
    },
    enabled: companyIds.length > 0 && planningType === "commercial",
  });

  // Extract unique commercials (advisors) from visites + devis
  const commercials = useMemo(() => {
    const advisors = new Set<string>();
    visites.forEach((v: any) => { if (v.clients?.advisor) advisors.add(v.clients.advisor); });
    devisData.forEach((d: any) => { if (d.clients?.advisor) advisors.add(d.clients.advisor); });
    return Array.from(advisors).sort();
  }, [visites, devisData]);

  // Filtered data for commercial
  const filteredVisites = useMemo(() => {
    if (selectedCommercial === "global") return visites;
    return visites.filter((v: any) => v.clients?.advisor === selectedCommercial);
  }, [visites, selectedCommercial]);

  const filteredDevis = useMemo(() => {
    if (selectedCommercial === "global") return devisData;
    return devisData.filter((d: any) => d.clients?.advisor === selectedCommercial);
  }, [devisData, selectedCommercial]);

  // Resource rows with color index
  const resourceRows = useMemo(() => {
    const rows = resources.map((r: any, i: number) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      colorIdx: i % ROW_COLORS.length,
    }));
    return rows;
  }, [resources]);

  // Filtered resource rows based on exploitation mode
  const filteredResourceRows = useMemo(() => {
    if (exploitationMode === "vehicule") {
      return resourceRows.filter((r: any) => r.type === "vehicule" || r.type === "grue");
    }
    if (exploitationMode === "personnel") {
      return resourceRows.filter((r: any) => r.type === "employe" || r.type === "equipe");
    }
    return resourceRows; // operation mode shows all
  }, [resourceRows, exploitationMode]);

  // Check if a day falls within an operation's date range (loading_date to delivery_date)
  const isOpOnDay = (op: any, day: Date) => {
    if (!op.loading_date) return false;
    const loadDay = startOfDay(new Date(op.loading_date));
    const delivDay = op.delivery_date ? startOfDay(new Date(op.delivery_date)) : loadDay;
    const d = startOfDay(day);
    return d >= loadDay && d <= delivDay;
  };

  // Get operations for a specific resource on a specific day
  const getOpsForResourceDay = (resourceId: string, day: Date) => {
    const opIds = opResources
      .filter((or: any) => or.resource_id === resourceId)
      .map((or: any) => or.operation_id);
    return operations.filter((op: any) =>
      opIds.includes(op.id) && isOpOnDay(op, day)
    );
  };

  const getEventsForResource = (resourceId: string, day: Date) => {
    return events.filter((e: any) => {
      const eStart = startOfDay(new Date(e.start_time));
      const eEnd = startOfDay(new Date(e.end_time));
      const matchDay = eStart <= day && eEnd >= day;
      return matchDay && e.resource_id === resourceId;
    });
  };

  const getUnassignedEventsForDay = (day: Date) => {
    return events.filter((e: any) => {
      const eStart = startOfDay(new Date(e.start_time));
      const eEnd = startOfDay(new Date(e.end_time));
      return eStart <= day && eEnd >= day && !e.resource_id;
    });
  };

  const getOpsForDay = (day: Date) => {
    return operations.filter((op: any) => isOpOnDay(op, day));
  };

  const getVisitesForDay = (day: Date) => {
    return filteredVisites.filter((v: any) =>
      v.scheduled_date && isSameDay(new Date(v.scheduled_date), day)
    );
  };

  const getEventsForDay = (day: Date) => {
    return events.filter((e: any) => {
      const eStart = startOfDay(new Date(e.start_time));
      const eEnd = startOfDay(new Date(e.end_time));
      return eStart <= day && eEnd >= day;
    });
  };

  const nav = (dir: number) => {
    if (view === "month") setCurrentDate(dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (view === "week") setCurrentDate(dir > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, dir));
  };

  const headerLabel = view === "month"
    ? format(currentDate, "MMMM yyyy", { locale: fr })
    : view === "day"
    ? format(currentDate, "EEEE d MMMM yyyy", { locale: fr })
    : `Semaine ${format(weekStart, "w")} — ${format(weekStart, "d MMM", { locale: fr })} au ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}`;

  const openCreate = (date?: Date, resourceId?: string) => {
    setEditingEvent(null);
    setDefaultDate(date);
    setDefaultResourceId(resourceId);
    setDialogOpen(true);
  };
  const openEdit = (evt: any) => { setEditingEvent(evt); setDialogOpen(true); };

  // ==================== EXPLOITATION VIEW ====================
  const renderExploitationView = () => {
    if (view === "month") return renderMonthView(false);
    const days = displayDays;
    const colWidth = view === "day" ? "1fr" : `repeat(${days.length}, minmax(0, 1fr))`;

    return (
      <div className="flex-1 rounded-xl border bg-card overflow-auto">
        <div className={isMobile ? "min-w-[700px]" : ""}>
          {/* Day headers */}
          <div className="grid border-b sticky top-0 bg-card z-10 shadow-sm" style={{ gridTemplateColumns: `160px ${colWidth}` }}>
            <div className="px-3 py-3 border-r bg-muted/50">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {exploitationMode === "vehicule" ? "Véhicule" : exploitationMode === "personnel" ? "Personnel" : "Opération"}
              </span>
            </div>
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={`px-2 py-3 text-center border-r last:border-r-0 cursor-pointer hover:bg-primary/15 transition-colors ${isToday(day) ? "bg-primary/10 border-b-2 border-b-primary" : "bg-muted/30"}`}
                onClick={() => { setView("day"); setCurrentDate(day); }}
              >
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {format(day, "EEE", { locale: fr })}
                </span>
                <p className={`text-xl font-black mt-0.5 leading-none ${isToday(day) ? "text-primary" : "text-foreground"}`}>
                  {format(day, "d")}
                </p>
                <span className="text-[10px] text-muted-foreground capitalize">{format(day, "MMM", { locale: fr })}</span>
              </div>
            ))}
          </div>

          {/* Operations summary row (only in operation mode) */}
          {exploitationMode === "operation" && operations.length > 0 && (
            <>
              {operations.map((op: any, opIdx: number) => {
                const color = companyColors[(op.companies as any)?.color] || "bg-primary text-primary-foreground";
                const loadDay = op.loading_date ? startOfDay(new Date(op.loading_date)) : null;
                const delivDay = op.delivery_date ? startOfDay(new Date(op.delivery_date)) : loadDay;
                const totalDays = loadDay && delivDay ? Math.round((delivDay.getTime() - loadDay.getTime()) / 86400000) + 1 : 1;

                // Find first and last visible day index for this op
                let firstIdx = -1;
                let lastIdx = -1;
                days.forEach((d, i) => {
                  if (isOpOnDay(op, d)) {
                    if (firstIdx === -1) firstIdx = i;
                    lastIdx = i;
                  }
                });
                const span = firstIdx >= 0 ? lastIdx - firstIdx + 1 : 0;

                return (
                  <div key={op.id} className="grid border-b" style={{ gridTemplateColumns: `160px ${colWidth}` }}>
                    <div
                      className="px-3 py-2.5 border-r bg-muted/10 flex items-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => { setEditingOpId(op.id); setOpDialogOpen(true); }}
                    >
                      <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 bg-warning/20 text-warning">
                        {opIdx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate text-foreground">
                          {(op.dossiers as any)?.clients?.name || "—"}
                        </p>
                        <p className="text-[9px] text-muted-foreground truncate">
                          {op.lv_bt_number ? `BT ${op.lv_bt_number}` : `Op. ${op.operation_number}`}
                          {(op.dossiers as any)?.code ? ` · ${(op.dossiers as any).code}` : ""}
                        </p>
                      </div>
                    </div>
                    {days.map((day, dayIdx) => (
                      <div
                        key={day.toISOString()}
                        className={`border-r last:border-r-0 min-h-[64px] relative overflow-visible ${isToday(day) ? "bg-primary/5" : ""}`}
                      >
                        {dayIdx === firstIdx && span > 0 && (
                          <div
                            className={`absolute inset-y-1 left-1 rounded-lg ${color} flex items-center px-3 cursor-pointer hover:opacity-90 transition-opacity shadow-sm`}
                            style={{ width: span > 1 ? `calc(${span * 100}% - 4px)` : "calc(100% - 8px)", zIndex: 5 }}
                            onClick={() => { setEditingOpId(op.id); setOpDialogOpen(true); }}
                          >
                            <div className="flex items-center gap-3 min-w-0 w-full text-[11px] font-medium overflow-hidden">
                              <p className="font-bold truncate">{(op.dossiers as any)?.clients?.name || "—"}</p>
                              <p className="opacity-80 flex items-center gap-0.5 truncate shrink-0">
                                <MapPin className="h-2.5 w-2.5 shrink-0" />
                                {op.loading_city || "—"} → {op.delivery_city || "—"}
                              </p>
                              {totalDays > 1 && <span className="opacity-70 shrink-0">{totalDays}j</span>}
                              {op.volume != null && totalDays <= 1 && <span className="opacity-70 shrink-0">{op.volume} m³</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}

          {/* Events rows in operation mode */}
          {exploitationMode === "operation" && events.length > 0 && (() => {
            const renderedEvtIds = new Set<string>();
            return events.map((evt: any, evtIdx: number) => {
              const evtStart = startOfDay(new Date(evt.start_time));
              const evtEnd = startOfDay(new Date(evt.end_time));
              let firstIdx = -1;
              let lastIdx = -1;
              days.forEach((d, i) => {
                const dayStart = startOfDay(d);
                if (evtStart <= dayStart && evtEnd >= dayStart) {
                  if (firstIdx === -1) firstIdx = i;
                  lastIdx = i;
                }
              });
              const span = firstIdx >= 0 ? lastIdx - firstIdx + 1 : 0;
              if (span === 0) return null;
              const bgColor = evt.color || "#6b7280";
              const client = (evt.dossiers as any)?.clients?.name;
              const totalDays = Math.round((evtEnd.getTime() - evtStart.getTime()) / 86400000) + 1;
              const resourceName = (evt.resources as any)?.name;

              return (
                <div key={evt.id} className="grid border-b" style={{ gridTemplateColumns: `160px ${colWidth}` }}>
                  <div
                    className="px-3 py-2.5 border-r bg-muted/10 flex items-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => openEdit(evt)}
                  >
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ backgroundColor: bgColor + "33", color: bgColor }}>
                      <Globe className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate text-foreground">{evt.title}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{resourceName || "Non assigné"}</p>
                    </div>
                  </div>
                  {days.map((day, dayIdx) => (
                    <div
                      key={day.toISOString()}
                      className={`border-r last:border-r-0 min-h-[64px] relative overflow-visible ${isToday(day) ? "bg-primary/5" : ""}`}
                    >
                      {dayIdx === firstIdx && span > 0 && (
                        <div
                          className="absolute inset-y-1 left-1 rounded-lg flex items-center px-3 cursor-pointer hover:opacity-90 transition-opacity shadow-sm text-white"
                          style={{ backgroundColor: bgColor, width: span > 1 ? `calc(${span * 100}% - 4px)` : "calc(100% - 8px)", zIndex: 5 }}
                          onClick={() => openEdit(evt)}
                        >
                          <div className="flex items-center gap-3 min-w-0 w-full text-[11px] font-medium overflow-hidden">
                            <p className="font-bold truncate">{evt.title}</p>
                            {client && <p className="opacity-85 truncate">{client}</p>}
                            {totalDays > 1 && <span className="opacity-70 shrink-0">{totalDays}j</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            });
          })()}

          {/* Resource rows (vehicule / personnel modes) */}
          {exploitationMode !== "operation" && filteredResourceRows.map((resource: any, rowIdx: number) => {
            // Pre-compute spans for ops and events on this resource
            const resOpIds = opResources
              .filter((or: any) => or.resource_id === resource.id)
              .map((or: any) => or.operation_id);
            const resourceOps = operations.filter((op: any) => resOpIds.includes(op.id));
            const resourceEvents = events.filter((e: any) => e.resource_id === resource.id);
            const renderedOpIds = new Set<string>();
            const renderedEvtIds = new Set<string>();

            return (
              <div
                key={resource.id}
                className={`grid border-b last:border-b-0 transition-colors hover:brightness-95`}
                style={{ gridTemplateColumns: `160px ${colWidth}` }}
              >
                {/* Resource label */}
                <div className={`px-3 py-2.5 border-r flex items-center gap-2.5 ${rowIdx % 2 === 0 ? "bg-muted/20" : "bg-muted/5"}`}>
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    resource.type === "employe" || resource.type === "equipe"
                      ? "bg-info/20 text-info"
                      : resource.type === "vehicule" || resource.type === "grue"
                      ? "bg-warning/20 text-warning"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {rowIdx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate text-foreground">{resource.name}</p>
                    <p className="text-[9px] text-muted-foreground capitalize">{resource.type}</p>
                  </div>
                </div>

                {/* Day cells */}
                {days.map((day, dayIdx) => {
                  // Count items to stack them
                  let stackIdx = 0;
                  const items: React.ReactNode[] = [];

                  // Operations
                  resourceOps.forEach((op: any) => {
                    if (!isOpOnDay(op, day)) return;
                    const loadDay = op.loading_date ? startOfDay(new Date(op.loading_date)) : null;
                    const delivDay = op.delivery_date ? startOfDay(new Date(op.delivery_date)) : loadDay;
                    const isFirst = loadDay && isSameDay(day, loadDay);
                    if (!isFirst && renderedOpIds.has(op.id)) return;
                    if (!isFirst) return; // only render on first day
                    renderedOpIds.add(op.id);
                    let spanEnd = dayIdx;
                    for (let i = dayIdx; i < days.length; i++) {
                      if (isOpOnDay(op, days[i])) spanEnd = i;
                      else break;
                    }
                    const span = spanEnd - dayIdx + 1;
                    const totalDays = loadDay && delivDay ? Math.round((delivDay.getTime() - loadDay.getTime()) / 86400000) + 1 : 1;
                    const color = companyColors[(op.companies as any)?.color] || "bg-primary text-primary-foreground";
                    const myIdx = stackIdx++;
                    items.push(
                      <div
                        key={`op-${op.id}`}
                        className={`absolute left-1 rounded-lg ${color} flex items-center px-3 cursor-pointer hover:opacity-90 transition-opacity shadow-sm`}
                        style={{ width: span > 1 ? `calc(${span * 100}% - 4px)` : "calc(100% - 8px)", zIndex: 5, top: `${4 + myIdx * 28}px`, height: "24px" }}
                        onClick={(e) => { e.stopPropagation(); setEditingOpId(op.id); setOpDialogOpen(true); }}
                      >
                        <div className="flex items-center gap-3 min-w-0 w-full text-[11px] font-medium overflow-hidden">
                          <p className="font-bold truncate">{(op.dossiers as any)?.clients?.name || "—"}</p>
                          <p className="opacity-80 flex items-center gap-0.5 truncate shrink-0">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                            {op.loading_city || "—"} → {op.delivery_city || "—"}
                          </p>
                          {totalDays > 1 && <span className="opacity-70 shrink-0">{totalDays}j</span>}
                        </div>
                      </div>
                    );
                  });

                  // Events
                  resourceEvents.forEach((evt: any) => {
                    const evtStart = startOfDay(new Date(evt.start_time));
                    const evtEnd = startOfDay(new Date(evt.end_time));
                    if (evtStart > day || evtEnd < day) return;
                    const isFirst = isSameDay(evtStart, day);
                    if (!isFirst && renderedEvtIds.has(evt.id)) return;
                    if (!isFirst) return;
                    renderedEvtIds.add(evt.id);
                    let spanEnd = dayIdx;
                    for (let i = dayIdx; i < days.length; i++) {
                      if (evtEnd >= startOfDay(days[i])) spanEnd = i;
                      else break;
                    }
                    const span = spanEnd - dayIdx + 1;
                    const bgColor = evt.color || "#6b7280";
                    const client = (evt.dossiers as any)?.clients?.name;
                    const totalDays = Math.round((evtEnd.getTime() - evtStart.getTime()) / 86400000) + 1;
                    const myIdx = stackIdx++;
                    items.push(
                      <div
                        key={`evt-${evt.id}`}
                        className="absolute left-1 rounded-lg flex items-center px-3 cursor-pointer hover:opacity-90 transition-opacity shadow-sm text-white"
                        style={{ backgroundColor: bgColor, width: span > 1 ? `calc(${span * 100}% - 4px)` : "calc(100% - 8px)", zIndex: 5, top: `${4 + myIdx * 28}px`, height: "24px" }}
                        onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                      >
                        <div className="flex items-center gap-3 min-w-0 w-full text-[11px] font-medium overflow-hidden">
                          <p className="font-bold truncate">{evt.title}</p>
                          {client && <p className="opacity-85 truncate">{client}</p>}
                          {totalDays > 1 && <span className="opacity-70 shrink-0">{totalDays}j</span>}
                        </div>
                      </div>
                    );
                  });

                  return (
                    <div
                      key={day.toISOString()}
                      className={`border-r last:border-r-0 min-h-[64px] relative overflow-visible cursor-pointer transition-colors ${
                        isToday(day) ? "bg-primary/5" : rowIdx % 2 === 0 ? "bg-muted/10" : ""
                      } hover:bg-muted/30`}
                      onClick={(e) => { e.stopPropagation(); openCreate(day, resource.id); }}
                      onTouchEnd={(e) => { e.preventDefault(); openCreate(day, resource.id); }}
                    >
                      {items}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Unassigned events row */}
          {events.some((e: any) => !e.resource_id) && (() => {
            const unassignedEvents = events.filter((e: any) => !e.resource_id);
            // Deduplicate: only render each event once, on its first visible day
            const renderedEventIds = new Set<string>();
            return (
              <div className="grid border-t" style={{ gridTemplateColumns: `160px ${colWidth}` }}>
                <div className="px-3 py-2.5 border-r bg-muted/30 flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Non assigné</span>
                </div>
                {days.map((day, dayIdx) => {
                  const cellEvents = getUnassignedEventsForDay(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`border-r last:border-r-0 min-h-[48px] relative overflow-visible cursor-pointer hover:bg-muted/20 ${isToday(day) ? "bg-primary/5" : ""}`}
                      onClick={(e) => { e.stopPropagation(); openCreate(day); }}
                      onTouchEnd={(e) => { e.preventDefault(); openCreate(day); }}
                    >
                      {cellEvents.map((evt: any, evtIdx: number) => {
                        if (renderedEventIds.has(evt.id)) return null;
                        const evtStart = startOfDay(new Date(evt.start_time));
                        const evtEnd = startOfDay(new Date(evt.end_time));
                        const isFirst = isSameDay(evtStart, day);
                        if (!isFirst) return null;
                        renderedEventIds.add(evt.id);
                        // Calculate span within visible days
                        let spanEnd = dayIdx;
                        for (let i = dayIdx; i < days.length; i++) {
                          if (evtEnd >= startOfDay(days[i])) spanEnd = i;
                          else break;
                        }
                        const span = spanEnd - dayIdx + 1;
                        const bgColor = evt.color || "#6b7280";
                        const client = (evt.dossiers as any)?.clients?.name;
                        const totalDays = Math.round((evtEnd.getTime() - evtStart.getTime()) / 86400000) + 1;
                        return (
                          <div
                            key={evt.id}
                            className="absolute left-1 rounded-lg flex items-center px-3 cursor-pointer hover:opacity-90 transition-opacity shadow-sm text-white"
                            style={{
                              backgroundColor: bgColor,
                              width: span > 1 ? `calc(${span * 100}% - 4px)` : "calc(100% - 8px)",
                              zIndex: 5,
                              top: `${4 + evtIdx * 28}px`,
                              height: "24px",
                            }}
                            onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                          >
                            <div className="flex items-center gap-3 min-w-0 w-full text-[11px] font-medium overflow-hidden">
                              <p className="font-bold truncate">{evt.title}</p>
                              {client && <p className="opacity-85 truncate">{client}</p>}
                              {totalDays > 1 && <span className="opacity-70 shrink-0">{totalDays}j</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {((exploitationMode === "operation" && operations.length === 0) ||
            (exploitationMode !== "operation" && filteredResourceRows.length === 0 && operations.length === 0)) && (
            <div className="px-4 py-16 text-center text-sm text-muted-foreground">
              <Truck className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>
                {exploitationMode === "operation"
                  ? "Aucune opération sur cette période."
                  : exploitationMode === "vehicule"
                  ? "Aucun véhicule configuré. Ajoutez des véhicules dans la section Ressources."
                  : "Aucun personnel configuré. Ajoutez du personnel dans la section Ressources."}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==================== COMMERCIAL VIEW ====================
  const renderCommercialView = () => {
    if (view === "month") return renderMonthView(true);
    const days = displayDays;
    const colWidth = view === "day" ? "1fr" : `repeat(${days.length}, minmax(0, 1fr))`;

    return (
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Visits calendar */}
        <div className="rounded-xl border bg-card overflow-auto">
          <div className={isMobile ? "min-w-[600px]" : ""}>
            {/* Day headers */}
            <div className="grid border-b sticky top-0 bg-card z-10 shadow-sm" style={{ gridTemplateColumns: `120px ${colWidth}` }}>
              <div className="px-3 py-3 border-r bg-muted/50">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Visites</span>
              </div>
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`px-2 py-3 text-center border-r last:border-r-0 cursor-pointer hover:bg-primary/15 transition-colors ${isToday(day) ? "bg-primary/10 border-b-2 border-b-primary" : "bg-muted/30"}`}
                  onClick={() => { setView("day"); setCurrentDate(day); }}
                >
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {format(day, "EEE", { locale: fr })}
                  </span>
                  <p className={`text-xl font-black mt-0.5 leading-none ${isToday(day) ? "text-primary" : "text-foreground"}`}>
                    {format(day, "d")}
                  </p>
                  <span className="text-[10px] text-muted-foreground capitalize">{format(day, "MMM", { locale: fr })}</span>
                </div>
              ))}
            </div>

            {/* Visite cells */}
            <div className="grid" style={{ gridTemplateColumns: `120px ${colWidth}` }}>
              <div className="px-3 py-3 border-r bg-info/5 flex flex-col justify-center">
                <span className="text-[10px] font-bold text-info uppercase tracking-wider">Calendrier</span>
              </div>
              {days.map((day) => {
                const dayVisites = getVisitesForDay(day);
                const dayEvents = getEventsForDay(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`border-r last:border-r-0 p-1.5 space-y-1 min-h-[80px] cursor-pointer hover:bg-muted/20 transition-colors ${isToday(day) ? "bg-primary/5" : ""}`}
                    onClick={() => { setView("day"); setCurrentDate(day); }}
                  >
                    {dayVisites.map((v: any) => (
                      <div
                        key={v.id}
                        className="rounded-md px-2 py-1.5 bg-info text-white text-[10px] cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                        onClick={() => navigate(`/visites/${v.id}`)}
                      >
                        <p className="font-bold truncate">🏠 {(v.clients as any)?.name || "Visite"}</p>
                        {v.scheduled_time && <p className="opacity-80">{v.scheduled_time}</p>}
                        {v.address && <p className="opacity-70 truncate flex items-center gap-0.5"><MapPin className="h-2 w-2 shrink-0" />{v.address}</p>}
                      </div>
                    ))}
                    {dayEvents.map((evt: any) => {
                      const bgColor = evt.color || "#6b7280";
                      const client = (evt.dossiers as any)?.clients?.name;
                      const evtStart = startOfDay(new Date(evt.start_time));
                      const evtEnd = startOfDay(new Date(evt.end_time));
                      const isMultiDay = evtStart.getTime() !== evtEnd.getTime();
                      const isFirst = isSameDay(evtStart, day);
                      const isLast = isSameDay(evtEnd, day);
                      const dayNum = Math.round((startOfDay(day).getTime() - evtStart.getTime()) / 86400000) + 1;
                      const totalDays = Math.round((evtEnd.getTime() - evtStart.getTime()) / 86400000) + 1;
                      return (
                        <div
                          key={evt.id}
                          className={`px-2 py-1.5 text-[10px] text-white font-medium cursor-pointer hover:opacity-90 transition-opacity ${
                            isMultiDay
                              ? isFirst ? "rounded-l-md rounded-r-none -mr-[7px]"
                              : isLast ? "rounded-r-md rounded-l-none -ml-[7px]"
                              : "rounded-none -mx-[7px]"
                              : "rounded-md"
                          }`}
                          style={{ backgroundColor: bgColor }}
                          onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                        >
                          {isFirst ? (
                            <>
                              <p className="font-bold truncate">{evt.title}</p>
                              {client && <p className="opacity-85 truncate">{client}</p>}
                              {isMultiDay && <p className="opacity-70 truncate">J{dayNum}/{totalDays}</p>}
                            </>
                          ) : (
                            <p className="opacity-70 truncate text-center">J{dayNum}/{totalDays}</p>
                          )}
                        </div>
                      );
                    })}
                    {dayVisites.length === 0 && dayEvents.length === 0 && (
                      <p className="text-[10px] text-muted-foreground/40 text-center pt-2">—</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Devis pipeline */}
        <div className="rounded-xl border bg-card p-4 flex-1 overflow-auto">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
            <Briefcase className="h-4 w-4 text-primary" />
            Pipeline Devis en cours
            <span className="ml-auto text-xs font-normal text-muted-foreground">{filteredDevis.length} devis</span>
          </h3>
          {filteredDevis.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Aucun devis en cours</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredDevis.map((d: any) => {
                const statusColors: Record<string, string> = {
                  brouillon: "border-border bg-muted/30",
                  envoye: "border-info/40 bg-info/5",
                  relance: "border-warning/40 bg-warning/5",
                };
                return (
                  <div
                    key={d.id}
                    className={`rounded-lg border p-3 cursor-pointer hover:shadow-md transition-all ${statusColors[d.status] || ""}`}
                    onClick={() => navigate(`/devis/${d.id}`)}
                  >
                    <p className="text-xs font-bold truncate">{d.objet || d.code}</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{(d.clients as any)?.name}</p>
                    {(d.clients as any)?.advisor && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <User className="h-2.5 w-2.5" />{(d.clients as any).advisor}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-black text-foreground">{Number(d.amount).toLocaleString("fr-FR")} €</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        d.status === "brouillon" ? "bg-muted text-muted-foreground" :
                        d.status === "envoye" ? "bg-info/15 text-info" :
                        "bg-warning/15 text-warning"
                      }`}>{d.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==================== MONTH VIEW ====================
  const renderMonthView = (isCommercial: boolean) => (
    <div className="flex-1 rounded-xl border bg-card overflow-auto">
      <div className="grid grid-cols-7 border-b bg-muted/30 sticky top-0 z-10">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} className="text-center text-[10px] text-muted-foreground font-bold py-2.5 border-r last:border-r-0 uppercase tracking-wider">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {paddedMonthDays.map((day, i) => {
          const dayEvents = getEventsForDay(day);
          const dayOps = getOpsForDay(day);
          const dayVisites = isCommercial ? getVisitesForDay(day) : [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const totalItems = dayEvents.length + dayOps.length + dayVisites.length;
          return (
            <div
              key={i}
              className={`border-r border-b last:border-r-0 min-h-[100px] p-1.5 cursor-pointer hover:bg-muted/20 transition-colors ${
                isToday(day) ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""
              } ${!isCurrentMonth ? "opacity-30" : ""}`}
              onClick={(e) => { e.stopPropagation(); setView("day"); setCurrentDate(day); }}
              onTouchEnd={(e) => { e.preventDefault(); setView("day"); setCurrentDate(day); }}
              role="button"
              tabIndex={0}
            >
              <p className={`text-xs font-bold mb-1 ${isToday(day) ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</p>
              {isCommercial && dayVisites.slice(0, 2).map((v: any) => (
                <div key={v.id} className="rounded px-1 py-0.5 text-[9px] truncate mb-0.5 bg-info text-white font-medium">
                  🏠 {(v.clients as any)?.name || "Visite"}
                </div>
              ))}
              {dayEvents.slice(0, isCommercial ? 1 : 3).map((evt: any) => {
                const bgColor = evt.color || "#6b7280";
                return (
                  <div key={evt.id} className="rounded px-1 py-0.5 text-[9px] truncate mb-0.5 font-medium text-white"
                    style={{ backgroundColor: bgColor }}
                    onClick={(e) => { e.stopPropagation(); openEdit(evt); }}>
                    {format(new Date(evt.start_time), "HH:mm")} {evt.title}
                  </div>
                );
              })}
              {!isCommercial && dayOps.slice(0, 2).map((op: any) => {
                const color = companyColors[(op.companies as any)?.color] || "bg-primary text-primary-foreground";
                return (
                  <div key={op.id} className={`rounded px-1 py-0.5 text-[9px] truncate mb-0.5 font-medium ${color}`}>
                    Op.{op.operation_number} {(op.dossiers as any)?.clients?.name || ""}
                  </div>
                );
              })}
              {totalItems > 3 && (
                <p className="text-[9px] text-muted-foreground font-medium">+{totalItems - 3} autres</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`max-w-full mx-auto h-full flex flex-col ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-5"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>Planning</h1>
          <p className={`text-muted-foreground capitalize ${isMobile ? "text-xs" : "text-sm"}`}>{headerLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => openCreate()} className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Événement
          </Button>
          {/* Company filter */}
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

      {/* Controls row */}
      <div className={`flex gap-2 ${isMobile ? "flex-col" : "items-center justify-between flex-wrap"}`}>
        {/* Top row on mobile: tabs + view toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Exploitation / Commercial tabs */}
          <Tabs value={planningType} onValueChange={(v) => setPlanningType(v as PlanningType)}>
            <TabsList className="h-8">
              <TabsTrigger value="exploitation" className="text-xs gap-1">
                <Truck className="h-3 w-3" /> {isMobile ? "Exploit." : "Exploitation"}
              </TabsTrigger>
              <TabsTrigger value="commercial" className="text-xs gap-1">
                <Briefcase className="h-3 w-3" /> Commercial
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => nav(-1)} className="p-1.5 rounded-lg border hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className={`rounded-lg border font-medium hover:bg-muted transition-colors ${isMobile ? "px-2 py-1 text-xs" : "px-4 py-1.5 text-sm"}`}
            >
              Auj.
            </button>
            <button onClick={() => nav(1)} className="p-1.5 rounded-lg border hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border bg-card p-0.5 gap-0.5 ml-auto">
            {(["day", "week", "month"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {v === "day" ? "Jour" : v === "week" ? "Sem." : "Mois"}
              </button>
            ))}
          </div>
        </div>

        {/* Exploitation mode filter */}
        {planningType === "exploitation" && (
          <div className="flex rounded-lg border bg-card p-0.5 gap-0.5 overflow-x-auto scrollbar-none">
            {([
              { value: "operation" as ExploitationMode, label: "Opération", icon: ClipboardList },
              { value: "vehicule" as ExploitationMode, label: "Véhicule", icon: Truck },
              { value: "personnel" as ExploitationMode, label: "Personnel", icon: User },
            ]).map((mode) => (
              <button
                key={mode.value}
                onClick={() => setExploitationMode(mode.value)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                  exploitationMode === mode.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <mode.icon className="h-3 w-3" /> {mode.label}
              </button>
            ))}
          </div>
        )}

        {/* Commercial filter (only in commercial mode) */}
        {planningType === "commercial" && (
          <div className="flex rounded-lg border bg-card p-0.5 gap-0.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setSelectedCommercial("global")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                selectedCommercial === "global" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Globe className="h-3 w-3" /> Global
            </button>
            {commercials.map((advisor) => (
              <button
                key={advisor}
                onClick={() => setSelectedCommercial(advisor)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                  selectedCommercial === advisor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <User className="h-3 w-3" /> {advisor}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <motion.div
        key={`${planningType}-${view}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex-1 flex flex-col min-h-0"
      >
        {planningType === "exploitation" ? renderExploitationView() : renderCommercialView()}
      </motion.div>

      <PlanningEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editingEvent}
        defaultDate={defaultDate}
        defaultResourceId={defaultResourceId}
      />
      <PlanningOperationDialog
        open={opDialogOpen}
        onOpenChange={(v) => { setOpDialogOpen(v); if (!v) setEditingOpId(null); }}
        operationId={editingOpId}
      />
    </div>
  );
};

export default Planning;
