import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, Clock, Plus, Briefcase, Truck } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useNavigate } from "react-router-dom";

type ViewMode = "day" | "week" | "month";
type PlanningType = "exploitation" | "commercial";

const companyColors: Record<string, string> = {
  "company-art": "bg-company-art/80 text-company-art-foreground",
  "company-altigrues": "bg-company-altigrues/80 text-company-altigrues-foreground",
  "company-asdgm": "bg-company-asdgm/80 text-company-asdgm-foreground",
  primary: "bg-primary/80 text-primary-foreground",
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7h-18h

const Planning = () => {
  const { current, setCurrent, companies, dbCompanies } = useCompany();
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [planningType, setPlanningType] = useState<PlanningType>("exploitation");
  const isMobile = useIsMobile();
  const navigate = useNavigate();

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
  const firstDayOfWeek = getDay(monthStart);
  const paddingBefore = (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1);
  const paddedMonthDays = [
    ...Array.from({ length: paddingBefore }, (_, i) => addDays(monthStart, -(paddingBefore - i))),
    ...monthDays,
  ];
  const remaining = 7 - (paddedMonthDays.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      paddedMonthDays.push(addDays(monthEnd, i));
    }
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

  // Fetch visites for commercial planning
  const { data: visites = [] } = useQuery({
    queryKey: ["planning-visites", companyIds, rangeStart.toISOString()],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("visites")
        .select("*, clients(name), companies(color)")
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
    queryKey: ["planning-devis", companyIds, rangeStart.toISOString()],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("devis")
        .select("*, clients(name), companies(color)")
        .in("company_id", companyIds)
        .in("status", ["brouillon", "envoye"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return [];
      return data || [];
    },
    enabled: companyIds.length > 0 && planningType === "commercial",
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

  const getVisitesForDay = (day: Date) => {
    return visites.filter((v: any) =>
      v.scheduled_date && isSameDay(new Date(v.scheduled_date), day)
    );
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

  const openEdit = (evt: any) => {
    setEditingEvent(evt);
    setDialogOpen(true);
  };

  // Render event card for exploitation
  const renderEventCard = (evt: any, compact = false) => {
    const color = companyColors[(evt.companies as any)?.color] || "bg-primary/80 text-primary-foreground";
    const client = (evt.dossiers as any)?.clients?.name;
    const dossierCode = (evt.dossiers as any)?.code;
    return (
      <div
        key={evt.id}
        className={`rounded-md px-2 py-1.5 cursor-pointer hover:opacity-90 transition-opacity ${color} ${compact ? "text-[9px]" : "text-[11px]"}`}
        onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
      >
        <p className="font-semibold truncate">{evt.title}</p>
        {!compact && client && <p className="opacity-80 truncate">{client}{dossierCode ? ` · ${dossierCode}` : ""}</p>}
        <p className="opacity-70 truncate flex items-center gap-1">
          <Clock className="h-2.5 w-2.5 shrink-0" />
          {format(new Date(evt.start_time), "HH:mm")} - {format(new Date(evt.end_time), "HH:mm")}
        </p>
      </div>
    );
  };

  // Render operation card
  const renderOpCard = (op: any, compact = false) => {
    const color = companyColors[(op.companies as any)?.color] || "bg-primary/80 text-primary-foreground";
    return (
      <div key={op.id} className={`rounded-md px-2 py-1.5 ${color} ${compact ? "text-[9px]" : "text-[11px]"}`}>
        <p className="font-semibold truncate">
          {(op.dossiers as any)?.clients?.name || "—"} · Op.{op.operation_number}
        </p>
        {!compact && (
          <p className="opacity-80 truncate flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5 shrink-0" /> {op.loading_city || "—"} → {op.delivery_city || "—"}
          </p>
        )}
        {!compact && op.lv_bt_number && <p className="opacity-70 truncate">LV/BT: {op.lv_bt_number}</p>}
      </div>
    );
  };

  // ==================== COMMERCIAL VIEW ====================
  const renderCommercialView = () => {
    if (view === "month") return renderMonthView(true);

    const days = displayDays;
    const colWidth = view === "day" ? "1fr" : `repeat(${days.length}, 1fr)`;

    return (
      <div className="flex-1 rounded-xl border bg-card overflow-auto">
        {/* Day headers */}
        <div className="grid border-b sticky top-0 bg-card z-10" style={{ gridTemplateColumns: `100px ${colWidth}` }}>
          <div className="px-3 py-3 border-r text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Heure</div>
          {days.map((day) => (
            <div key={day.toISOString()} className={`px-2 py-3 text-center border-r last:border-r-0 ${isToday(day) ? "bg-primary/5" : ""}`}>
              <span className="text-xs font-medium text-muted-foreground uppercase">{format(day, "EEEE", { locale: fr })}</span>
              <p className={`text-lg font-bold mt-0.5 ${isToday(day) ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</p>
              <span className="text-[10px] text-muted-foreground">{format(day, "MMM", { locale: fr })}</span>
            </div>
          ))}
        </div>

        {/* Visites / devis summary row */}
        <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: `100px ${colWidth}` }}>
          <div className="px-3 py-2 border-r flex items-center">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Visites</span>
          </div>
          {days.map((day) => {
            const dayVisites = getVisitesForDay(day);
            const dayEvents = getEventsForDay(day);
            return (
              <div key={day.toISOString()} className={`border-r last:border-r-0 p-1.5 space-y-1 min-h-[60px] ${isToday(day) ? "bg-primary/5" : ""}`}>
                {dayVisites.map((v: any) => (
                  <div key={v.id} className="rounded-md px-2 py-1.5 bg-info/15 text-info text-[11px] cursor-pointer hover:bg-info/25 transition-colors"
                    onClick={() => navigate(`/visites/${v.id}`, { state: { fromPlanning: true } })}>
                    <p className="font-semibold truncate">🏠 {(v.clients as any)?.name || "Visite"}</p>
                    <p className="opacity-80 text-[10px]">{v.scheduled_time || ""}</p>
                  </div>
                ))}
                {dayEvents.map((evt: any) => renderEventCard(evt, true))}
              </div>
            );
          })}
        </div>

        {/* Devis pipeline summary */}
        <div className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Pipeline Devis en cours
          </h3>
          {devisData.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun devis en cours</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {devisData.slice(0, 9).map((d: any) => {
                const statusColors: Record<string, string> = {
                  brouillon: "border-muted-foreground/30 bg-muted/30",
                  envoye: "border-info/30 bg-info/5",
                  relance: "border-warning/30 bg-warning/5",
                };
                return (
                  <div key={d.id} className={`rounded-lg border p-3 cursor-pointer hover:shadow-sm transition-shadow ${statusColors[d.status] || ""}`}
                    onClick={() => navigate(`/devis/${d.id}`)}>
                    <p className="text-xs font-semibold truncate">{d.code || d.objet}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{(d.clients as any)?.name}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs font-bold text-foreground">{Number(d.amount).toLocaleString("fr-FR")} €</span>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                        d.status === "brouillon" ? "bg-muted text-muted-foreground" :
                        d.status === "envoye" ? "bg-info/10 text-info" :
                        "bg-warning/10 text-warning"
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

  // ==================== EXPLOITATION VIEW ====================
  const renderExploitationView = () => {
    if (view === "month") return renderMonthView(false);

    const days = displayDays;
    const colWidth = view === "day" ? "1fr" : `repeat(${days.length}, 1fr)`;

    return (
      <div className="flex-1 rounded-xl border bg-card overflow-auto">
        <div className={isMobile ? "min-w-[600px]" : ""}>
          {/* Day headers - improved visibility */}
          <div className="grid border-b sticky top-0 bg-card z-10" style={{ gridTemplateColumns: `140px ${colWidth}` }}>
            <div className="px-3 py-3 border-r text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ressource</div>
            {days.map((day) => (
              <div key={day.toISOString()} className={`px-2 py-3 text-center border-r last:border-r-0 ${isToday(day) ? "bg-primary/8 border-b-2 border-b-primary" : ""}`}>
                <span className="text-xs font-medium text-muted-foreground uppercase">{format(day, "EEEE", { locale: fr })}</span>
                <p className={`text-lg font-bold mt-0.5 ${isToday(day) ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</p>
                <span className="text-[10px] text-muted-foreground">{format(day, "MMM", { locale: fr })}</span>
              </div>
            ))}
          </div>

          {/* Operations row */}
          {operations.length > 0 && (
            <div className="grid border-b bg-muted/20" style={{ gridTemplateColumns: `140px ${colWidth}` }}>
              <div className="px-3 py-2 border-r flex items-center gap-2">
                <Truck className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">Opérations</span>
              </div>
              {days.map((day) => {
                const dayOps = getOpsForDay(day);
                return (
                  <div key={day.toISOString()} className={`border-r last:border-r-0 p-1.5 space-y-1 ${isToday(day) ? "bg-primary/5" : ""}`}>
                    {dayOps.map((op: any) => renderOpCard(op))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Resource rows */}
          {resourceRows.map((resource: any) => (
            <div key={resource.id} className="grid border-b last:border-b-0 hover:bg-muted/5 transition-colors" style={{ gridTemplateColumns: `140px ${colWidth}` }}>
              <div className="px-3 py-2 border-r flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                  resource.type === "employe" || resource.type === "equipe" ? "bg-info"
                  : resource.type === "vehicule" || resource.type === "grue" ? "bg-warning"
                  : "bg-muted-foreground"
                }`} />
                <span className="text-xs font-medium truncate">{resource.name}</span>
              </div>
              {days.map((day) => {
                const cellEvents = getEventsForCell(resource.id, day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`border-r last:border-r-0 p-1.5 space-y-1 min-h-[56px] cursor-pointer hover:bg-muted/20 transition-colors ${isToday(day) ? "bg-primary/5" : ""}`}
                    onClick={() => openCreate(day, resource.id === "__unassigned__" ? undefined : resource.id)}
                  >
                    {cellEvents.map((evt: any) => renderEventCard(evt))}
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
      </div>
    );
  };

  // ==================== MONTH VIEW (shared) ====================
  const renderMonthView = (isCommercial: boolean) => (
    <div className="flex-1 rounded-xl border bg-card overflow-auto">
      <div className="grid grid-cols-7 border-b bg-card sticky top-0 z-10">
        {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((d) => (
          <div key={d} className="text-center text-[11px] text-muted-foreground font-semibold py-2.5 border-r last:border-r-0 uppercase tracking-wider">{d}</div>
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
              className={`border-r border-b last:border-r-0 min-h-[90px] p-1.5 cursor-pointer hover:bg-muted/20 transition-colors ${
                isToday(day) ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""
              } ${!isCurrentMonth ? "opacity-30" : ""}`}
              onClick={() => { setView("day"); setCurrentDate(day); }}
            >
              <p className={`text-xs font-bold mb-1 ${isToday(day) ? "text-primary" : "text-foreground"}`}>
                {format(day, "d")}
              </p>
              {isCommercial && dayVisites.slice(0, 2).map((v: any) => (
                <div key={v.id} className="rounded px-1 py-0.5 text-[9px] truncate mb-0.5 bg-info/15 text-info font-medium">
                  🏠 {(v.clients as any)?.name || "Visite"}
                </div>
              ))}
              {dayEvents.slice(0, isCommercial ? 1 : 3).map((evt: any) => {
                const color = companyColors[(evt.companies as any)?.color] || "bg-primary/80 text-primary-foreground";
                return (
                  <div key={evt.id} className={`rounded px-1 py-0.5 text-[9px] truncate mb-0.5 font-medium ${color}`}
                    onClick={(e) => { e.stopPropagation(); openEdit(evt); }}>
                    {format(new Date(evt.start_time), "HH:mm")} {evt.title}
                  </div>
                );
              })}
              {!isCommercial && dayOps.slice(0, 2).map((op: any) => {
                const color = companyColors[(op.companies as any)?.color] || "bg-primary/80 text-primary-foreground";
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
        <div className="flex items-center gap-2">
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

      {/* Planning type tabs + Nav + view toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Tabs value={planningType} onValueChange={(v) => setPlanningType(v as PlanningType)}>
            <TabsList className="h-9">
              <TabsTrigger value="exploitation" className="text-xs gap-1.5">
                <Truck className="h-3.5 w-3.5" /> Exploitation
              </TabsTrigger>
              <TabsTrigger value="commercial" className="text-xs gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> Commercial
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1">
            <button onClick={() => nav(-1)} className="p-1.5 rounded-lg border hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className={`rounded-lg border font-medium hover:bg-muted transition-colors ${isMobile ? "px-2.5 py-1 text-xs" : "px-4 py-1.5 text-sm"}`}>
              Aujourd'hui
            </button>
            <button onClick={() => nav(1)} className="p-1.5 rounded-lg border hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
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

      {/* Content */}
      <motion.div key={`${planningType}-${view}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col">
        {planningType === "exploitation" ? renderExploitationView() : renderCommercialView()}
      </motion.div>

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
