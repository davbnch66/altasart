import { motion } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight, MapPin, Plus, Briefcase, Truck, User, Globe, ClipboardList, Clock, ExternalLink, CalendarSync, Copy, Check, Construction, Sparkles, UserMinus } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useState, useMemo, useEffect, useCallback, DragEvent } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlanningEventDialog } from "@/components/planning/PlanningEventDialog";
import { PlanningOperationDialog } from "@/components/planning/PlanningOperationDialog";
import { PlanningMissionPanel } from "@/components/planning/PlanningMissionPanel";
import { PlanningAIAssistant, type AISuggestion } from "@/components/planning/PlanningAIAssistant";
import { toast } from "sonner";
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>(() => {
    return (sessionStorage.getItem("planningView") as ViewMode) || "week";
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();
  const [planningType, setPlanningType] = useState<PlanningType>(() => {
    return (sessionStorage.getItem("planningTab") as PlanningType) || "exploitation";
  });
  const [selectedCommercial, setSelectedCommercial] = useState<string>(() => {
    return sessionStorage.getItem("planningCommercial") || "global";
  });
  const [exploitationMode, setExploitationMode] = useState<ExploitationMode>(() => {
    return (sessionStorage.getItem("exploitationMode") as ExploitationMode) || "vehicule";
  });
  const isMobile = useIsMobile();
  const [icalCopied, setIcalCopied] = useState(false);

  const [icalUrl, setIcalUrl] = useState("");

  const getIcalUrl = useCallback(async () => {
    if (!user) return;
    const companyId = current === "global" ? dbCompanies[0]?.id : current;
    if (!companyId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { toast.error("Session expirée"); return; }
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const url = `${baseUrl}/functions/v1/calendar-feed?token=${session.access_token}&company_id=${companyId}`;
    setIcalUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setIcalCopied(true);
      toast.success("Lien iCal copié !");
      setTimeout(() => setIcalCopied(false), 3000);
    } catch {
      // Clipboard blocked in iframe — show URL instead
      toast.info("Copiez le lien ci-dessous manuellement.");
    }
  }, [user, current, dbCompanies]);

  useEffect(() => {
    sessionStorage.setItem("exploitationMode", exploitationMode);
  }, [exploitationMode]);

  useEffect(() => {
    sessionStorage.setItem("planningTab", planningType);
  }, [planningType]);

  useEffect(() => {
    sessionStorage.setItem("planningCommercial", selectedCommercial);
  }, [selectedCommercial]);

  useEffect(() => {
    sessionStorage.setItem("planningView", view);
  }, [view]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [defaultResourceId, setDefaultResourceId] = useState<string | undefined>();
  const [opDialogOpen, setOpDialogOpen] = useState(false);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [missionPanelOpen, setMissionPanelOpen] = useState(false);
  const [missionDefaultDate, setMissionDefaultDate] = useState<Date | undefined>();
  const [missionDefaultResource, setMissionDefaultResource] = useState<string | undefined>();
  const [editingVisite, setEditingVisite] = useState<any>(null);
  const [visiteDate, setVisiteDate] = useState("");
  const [aiPlannerOpen, setAiPlannerOpen] = useState(false);
  const [aiPreFill, setAiPreFill] = useState<AISuggestion | null>(null);

  const handleAISuggestion = (suggestion: AISuggestion) => {
    setMissionDefaultDate(suggestion.loading_date ? new Date(suggestion.loading_date) : undefined);
    setMissionDefaultResource(undefined);
    setAiPreFill(suggestion);
    setMissionPanelOpen(true);
  };
  const [visiteTime, setVisiteTime] = useState("");
  const [savingVisite, setSavingVisite] = useState(false);

  // ── Drag & Drop state ──
  type DragItem = { kind: "op" | "evt" | "visite"; id: string; durationDays: number; startTime?: string; endTime?: string };
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, item: DragItem) => {
    e.dataTransfer.setData("application/json", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget) {
      e.currentTarget.style.opacity = "0.5";
      setTimeout(() => { e.currentTarget.style.opacity = "1"; }, 0);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, cellKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell(cellKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCell(null);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>, targetDay: Date) => {
    e.preventDefault();
    setDragOverCell(null);
    try {
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      const item: DragItem = JSON.parse(raw);
      const newDate = format(targetDay, "yyyy-MM-dd");

      if (item.kind === "op") {
        const updateData: any = { loading_date: newDate };
        if (item.durationDays > 1) {
          updateData.delivery_date = format(addDays(targetDay, item.durationDays - 1), "yyyy-MM-dd");
        }
        const { error } = await supabase.from("operations").update(updateData).eq("id", item.id);
        if (error) throw error;
        toast.success("Opération déplacée");
      } else if (item.kind === "visite") {
        const { error } = await supabase.from("visites").update({ scheduled_date: newDate }).eq("id", item.id);
        if (error) throw error;
        toast.success("Visite déplacée");
        queryClient.invalidateQueries({ queryKey: ["planning-visites"] });
      } else {
        // Shift preserving time-of-day and duration
        const oldStart = new Date(item.startTime!);
        const oldEnd = new Date(item.endTime!);
        const durationMs = oldEnd.getTime() - oldStart.getTime();
        const newStart = new Date(targetDay);
        newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds());
        const newEnd = new Date(newStart.getTime() + durationMs);
        const { error } = await supabase.from("planning_events").update({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        }).eq("id", item.id);
        if (error) throw error;
        toast.success("Événement déplacé");
      }
      queryClient.invalidateQueries({ queryKey: ["planning-events"] });
      queryClient.invalidateQueries({ queryKey: ["planning-operations"] });
      queryClient.invalidateQueries({ queryKey: ["planning-op-resources"] });
      queryClient.invalidateQueries({ queryKey: ["planning-event-resources"] });
    } catch (err: any) {
      toast.error("Erreur: " + (err.message || "Impossible de déplacer"));
    }
  }, [queryClient]);

  /** Commercial drop: uses Y position to compute target hour */
  const handleCommercialDrop = useCallback(async (e: DragEvent<HTMLDivElement>, targetDay: Date) => {
    e.preventDefault();
    setDragOverCell(null);
    try {
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      const item: DragItem = JSON.parse(raw);
      const newDate = format(targetDay, "yyyy-MM-dd");

      // Calculate target hour from Y position in the column
      const rect = e.currentTarget.getBoundingClientRect();
      const yOffset = e.clientY - rect.top;
      const rawMinutes = (yOffset / HOUR_HEIGHT) * 60;
      // Snap to 15-minute increments
      const snappedMinutes = Math.round(rawMinutes / 15) * 15;
      const targetHour = HOUR_START + Math.floor(snappedMinutes / 60);
      const targetMinute = snappedMinutes % 60;
      const clampedHour = Math.max(HOUR_START, Math.min(HOUR_END - 1, targetHour));

      if (item.kind === "visite") {
        const newTime = `${String(clampedHour).padStart(2, "0")}:${String(targetMinute).padStart(2, "0")}`;
        const { error } = await supabase.from("visites").update({ scheduled_date: newDate, scheduled_time: newTime }).eq("id", item.id);
        if (error) throw error;
        toast.success("Visite déplacée");
        queryClient.invalidateQueries({ queryKey: ["planning-visites"] });
      } else if (item.kind === "evt") {
        const oldStart = new Date(item.startTime!);
        const oldEnd = new Date(item.endTime!);
        const durationMs = oldEnd.getTime() - oldStart.getTime();
        const newStart = new Date(targetDay);
        newStart.setHours(clampedHour, targetMinute, 0, 0);
        const newEnd = new Date(newStart.getTime() + durationMs);
        const { error } = await supabase.from("planning_events").update({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        }).eq("id", item.id);
        if (error) throw error;
        toast.success("Événement déplacé");
        queryClient.invalidateQueries({ queryKey: ["planning-events"] });
      } else if (item.kind === "op") {
        const updateData: any = { loading_date: newDate };
        if (item.durationDays > 1) {
          updateData.delivery_date = format(addDays(targetDay, item.durationDays - 1), "yyyy-MM-dd");
        }
        const { error } = await supabase.from("operations").update(updateData).eq("id", item.id);
        if (error) throw error;
        toast.success("Opération déplacée");
        queryClient.invalidateQueries({ queryKey: ["planning-operations"] });
      }
    } catch (err: any) {
      toast.error("Erreur: " + (err.message || "Impossible de déplacer"));
    }
  }, [queryClient]);

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

  // Fetch operations — include ops that overlap the visible range (loading_date <= rangeEnd AND (delivery_date >= rangeStart OR loading_date >= rangeStart))
  const { data: operations = [] } = useQuery({
    queryKey: ["planning-operations", companyIds, rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const rangeStartStr = format(rangeStart, "yyyy-MM-dd");
      const rangeEndStr = format(addDays(rangeEnd, 1), "yyyy-MM-dd");
      // Fetch ops whose loading_date is before end of range
      const { data, error } = await supabase
        .from("operations")
        .select("*, dossiers(title, code, clients(name)), companies(color)")
        .in("company_id", companyIds)
        .lt("loading_date", rangeEndStr)
        .order("loading_date");
      if (error) throw error;
      // Client-side filter: keep ops that overlap the visible range
      return (data || []).filter((op: any) => {
        const delivDate = op.delivery_date || op.loading_date;
        return delivDate >= rangeStartStr;
      });
    },
    enabled: companyIds.length > 0,
  });

  // Fetch operation_resources to link operations to resources
  const { data: opResources = [] } = useQuery({
    queryKey: ["planning-op-resources", companyIds, rangeStart.toISOString(), rangeEnd.toISOString()],
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

  // Fetch event_resources to link events to multiple resources
  const { data: evtResources = [] } = useQuery({
    queryKey: ["planning-event-resources", companyIds, rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      if (companyIds.length === 0 || events.length === 0) return [];
      const evtIds = events.map((e: any) => e.id);
      const { data, error } = await supabase
        .from("event_resources")
        .select("event_id, resource_id")
        .in("event_id", evtIds);
      if (error) throw error;
      return data || [];
    },
    enabled: companyIds.length > 0 && events.length > 0 && planningType === "exploitation",
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

  // Fetch voirie status for operations' dossiers
  const dossierIds = useMemo(() => operations.map((op: any) => op.dossier_id).filter(Boolean), [operations]);
  const { data: voirieByDossier = {} } = useQuery({
    queryKey: ["planning-voirie", dossierIds],
    queryFn: async () => {
      if (dossierIds.length === 0) return {};
      const { data, error } = await supabase
        .from("visites")
        .select("dossier_id, voirie_status, needs_voirie, loading_date")
        .in("dossier_id", dossierIds)
        .eq("needs_voirie", true);
      if (error) return {};
      const map: Record<string, string> = {};
      (data || []).forEach((v: any) => { if (v.dossier_id) map[v.dossier_id] = v.voirie_status; });
      return map;
    },
    enabled: dossierIds.length > 0 && planningType === "exploitation" && exploitationMode === "operation",
  });

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

  // ── Conflict detection: find resources assigned to overlapping events/ops ──
  const resourceConflicts = useMemo(() => {
    // Build a list of all assignments: { resourceId, start, end, label, id }
    type Assignment = { resourceId: string; start: Date; end: Date; label: string; id: string };
    const assignments: Assignment[] = [];

    // From events (junction table + legacy)
    events.forEach((evt: any) => {
      const s = new Date(evt.start_time);
      const e = new Date(evt.end_time);
      // Junction resources
      const junctionRids = evtResources.filter((er: any) => er.event_id === evt.id).map((er: any) => er.resource_id);
      const rids = new Set([...junctionRids, ...(evt.resource_id ? [evt.resource_id] : [])]);
      rids.forEach((rid) => assignments.push({ resourceId: rid, start: s, end: e, label: evt.title, id: `evt-${evt.id}` }));
    });

    // From operations
    operations.forEach((op: any) => {
      if (!op.loading_date) return;
      const s = startOfDay(new Date(op.loading_date));
      const e = op.delivery_date ? new Date(new Date(op.delivery_date).getTime() + 86400000 - 1) : new Date(s.getTime() + 86400000 - 1);
      const label = (op.dossiers as any)?.clients?.name || `Op ${op.operation_number}`;
      const rids = opResources.filter((or: any) => or.operation_id === op.id).map((or: any) => or.resource_id);
      rids.forEach((rid: string) => assignments.push({ resourceId: rid, start: s, end: e, label, id: `op-${op.id}` }));
    });

    // For each resource, check pairwise overlaps
    const conflicts = new Map<string, { with: string; label: string }[]>();
    const byResource = new Map<string, Assignment[]>();
    assignments.forEach((a) => {
      if (!byResource.has(a.resourceId)) byResource.set(a.resourceId, []);
      byResource.get(a.resourceId)!.push(a);
    });

    byResource.forEach((items, rid) => {
      if (items.length < 2) return;
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          // Check overlap
          if (items[i].start < items[j].end && items[j].start < items[i].end) {
            if (!conflicts.has(rid)) conflicts.set(rid, []);
            conflicts.get(rid)!.push({ with: items[j].id, label: items[j].label });
            conflicts.get(rid)!.push({ with: items[i].id, label: items[i].label });
          }
        }
      }
    });

    return conflicts;
  }, [events, operations, evtResources, opResources]);

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
    const resEvtIds = evtResources
      .filter((er: any) => er.resource_id === resourceId)
      .map((er: any) => er.event_id);
    return events.filter((e: any) => {
      const eStart = startOfDay(new Date(e.start_time));
      const eEnd = startOfDay(new Date(e.end_time));
      const matchDay = eStart <= day && eEnd >= day;
      return matchDay && (resEvtIds.includes(e.id) || e.resource_id === resourceId);
    });
  };

  const getUnassignedEventsForDay = (day: Date) => {
    // Events that have no resource via junction table AND no legacy resource_id
    const assignedEvtIds = new Set(evtResources.map((er: any) => er.event_id));
    return events.filter((e: any) => {
      const eStart = startOfDay(new Date(e.start_time));
      const eEnd = startOfDay(new Date(e.end_time));
      return eStart <= day && eEnd >= day && !e.resource_id && !assignedEvtIds.has(e.id);
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

  const getEventsForDay = (day: Date, filterType?: "commercial" | "exploitation") => {
    return events.filter((e: any) => {
      const eStart = startOfDay(new Date(e.start_time));
      const eEnd = startOfDay(new Date(e.end_time));
      if (!(eStart <= day && eEnd >= day)) return false;
      if (filterType === "commercial") return ["visite", "congé", "absence", "conge"].includes(e.event_type);
      if (filterType === "exploitation") return e.event_type !== "visite";
      return true;
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
  const openEdit = (evt: any) => {
    setDefaultDate(undefined);
    setDefaultResourceId(undefined);
    setEditingEvent(evt);
    setDialogOpen(true);
  };

  // ── Conflict summary for banner ──
  const conflictSummary = useMemo(() => {
    const entries: { resourceName: string; items: string[] }[] = [];
    resourceConflicts.forEach((conflicts, rid) => {
      const res = resources.find((r: any) => r.id === rid);
      const uniqueLabels = [...new Set(conflicts.map((c) => c.label))];
      entries.push({ resourceName: res?.name || "Ressource", items: uniqueLabels });
    });
    return entries;
  }, [resourceConflicts, resources]);

  // ── isDayConflict: checks if a specific resource has conflicts on a specific day ──
  const isDayConflict = (resourceId: string, day: Date): boolean => {
    if (!resourceConflicts.has(resourceId)) return false;
    const dayOps = getOpsForResourceDay(resourceId, day);
    const dayEvts = getEventsForResource(resourceId, day);
    return (dayOps.length + dayEvts.length) > 1;
  };

  // ==================== EXPLOITATION VIEW ====================
  const renderExploitationView = () => {
    if (view === "month") return renderMonthView(false);
    const days = displayDays;
    const colWidth = view === "day" ? "1fr" : `repeat(${days.length}, minmax(0, 1fr))`;

    return (
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        {/* Conflict banner — compact */}
        {conflictSummary.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-xs text-destructive">
              <strong>{conflictSummary.length} conflit{conflictSummary.length > 1 ? "s" : ""}</strong> — {conflictSummary.map(c => c.resourceName).join(", ")}
            </p>
          </div>
        )}
        <div className="flex-1 rounded-xl border bg-card overflow-auto min-h-0">
        <div className={isMobile ? "min-w-[700px]" : ""}>
          {/* Day headers */}
          <div className="grid border-b-2 border-border sticky top-0 bg-card z-10 shadow-sm" style={{ gridTemplateColumns: `180px ${colWidth}` }}>
            <div className="px-3 py-3 border-r-2 border-border bg-muted/50 flex items-end">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {exploitationMode === "vehicule" ? "Véhicule" : exploitationMode === "personnel" ? "Personnel" : "Opération"}
              </span>
            </div>
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={`px-2 py-3 text-center border-r border-border last:border-r-0 cursor-pointer hover:bg-primary/15 transition-colors ${isToday(day) ? "bg-primary/10 border-b-2 border-b-primary" : "bg-muted/30"}`}
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
                  <div key={op.id} className="grid border-b border-border" style={{ gridTemplateColumns: `180px ${colWidth}` }}>
                    <div
                      className="px-3 py-2.5 border-r-2 border-border bg-muted/10 flex items-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
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
                    {days.map((day, dayIdx) => {
                      const cellKey = `op-${op.id}-${dayIdx}`;
                      // Voirie urgency: if voirie not obtained and loading_date within 2 days
                      const voirieStatus = (voirieByDossier as Record<string, string>)[op.dossier_id];
                      const voirieUrgent = voirieStatus && voirieStatus !== "obtenu" && op.loading_date && (() => {
                        const loadDate = new Date(op.loading_date);
                        const now = new Date();
                        const diffDays = (loadDate.getTime() - now.getTime()) / 86400000;
                        return diffDays <= 2 && diffDays >= 0;
                      })();
                      return (
                      <div
                        key={day.toISOString()}
                        className={`border-r border-border last:border-r-0 min-h-[72px] relative overflow-visible ${isToday(day) ? "bg-primary/5" : ""} ${voirieUrgent ? "bg-warning/10" : ""} ${dragOverCell === cellKey ? "bg-primary/20" : ""}`}
                        onDragOver={(e) => handleDragOver(e, cellKey)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, day)}
                      >
                        {dayIdx === firstIdx && span > 0 && (
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, { kind: "op", id: op.id, durationDays: totalDays })}
                            className={`absolute inset-y-1 left-1 rounded-lg ${color} flex items-center px-3 cursor-grab hover:opacity-90 transition-opacity shadow-sm`}
                            style={{ width: span > 1 ? `calc(${span * 100}% - 4px)` : "calc(100% - 8px)", zIndex: 5 }}
                            onClick={() => { setEditingOpId(op.id); setOpDialogOpen(true); }}
                          >
                            <div className="flex items-center gap-2 min-w-0 w-full text-[11px] font-medium overflow-hidden">
                              {/* Voirie badge */}
                              {(() => {
                                const vs = (voirieByDossier as Record<string, string>)[op.dossier_id];
                                if (!vs) return null;
                                const icon = vs === "obtenu" ? "🟢" : vs === "refuse" ? "🔴" : "🟡";
                                return <span className="shrink-0" title={`Voirie: ${vs}`}>{icon}</span>;
                              })()}
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
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {/* Events rows in operation mode */}
          {exploitationMode === "operation" && events.filter((e: any) => e.event_type !== "visite").length > 0 && (() => {
            const renderedEvtIds = new Set<string>();
            return events.filter((e: any) => e.event_type !== "visite").map((evt: any, evtIdx: number) => {
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
                <div key={evt.id} className="grid border-b border-border" style={{ gridTemplateColumns: `180px ${colWidth}` }}>
                  <div
                    className="px-3 py-2.5 border-r-2 border-border bg-muted/10 flex items-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
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
                  {days.map((day, dayIdx) => {
                    const cellKey = `evt-row-${evt.id}-${dayIdx}`;
                    return (
                    <div
                      key={day.toISOString()}
                      className={`border-r border-border last:border-r-0 min-h-[72px] relative overflow-visible ${isToday(day) ? "bg-primary/5" : ""} ${dragOverCell === cellKey ? "bg-primary/20" : ""}`}
                      onDragOver={(e) => handleDragOver(e, cellKey)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day)}
                    >
                      {dayIdx === firstIdx && span > 0 && (
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, { kind: "evt", id: evt.id, durationDays: totalDays, startTime: evt.start_time, endTime: evt.end_time })}
                          className="absolute inset-y-1 left-1 rounded-lg flex items-center px-3 cursor-grab hover:opacity-90 transition-opacity shadow-sm text-white"
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
                    );
                  })}
                </div>
              );
            });
          })()}

          {/* Resource rows (vehicule / personnel modes) */}
          {exploitationMode !== "operation" && filteredResourceRows.map((resource: any, rowIdx: number) => {
            // Pre-compute ops and events for this resource
            const resOpIds = opResources
              .filter((or: any) => or.resource_id === resource.id)
              .map((or: any) => or.operation_id);
            const resourceOps = operations.filter((op: any) => resOpIds.includes(op.id));
            const resEvtIds = evtResources
              .filter((er: any) => er.resource_id === resource.id)
              .map((er: any) => er.event_id);
            const resourceEvents = events.filter((e: any) => 
              (resEvtIds.includes(e.id) || e.resource_id === resource.id) && e.event_type !== "visite"
            );

            // Build lane items with day index ranges
            type LaneItem = { id: string; kind: "op" | "evt"; firstIdx: number; lastIdx: number; data: any };
            const laneItems: LaneItem[] = [];

            resourceOps.forEach((op: any) => {
              let firstIdx = -1, lastIdx = -1;
              days.forEach((d, i) => {
                if (isOpOnDay(op, d)) { if (firstIdx === -1) firstIdx = i; lastIdx = i; }
              });
              if (firstIdx >= 0) laneItems.push({ id: `op-${op.id}`, kind: "op", firstIdx, lastIdx, data: op });
            });

            resourceEvents.forEach((evt: any) => {
              const evtStart = startOfDay(new Date(evt.start_time));
              const evtEnd = startOfDay(new Date(evt.end_time));
              let firstIdx = -1, lastIdx = -1;
              days.forEach((d, i) => {
                if (evtStart <= d && evtEnd >= d) { if (firstIdx === -1) firstIdx = i; lastIdx = i; }
              });
              if (firstIdx >= 0) laneItems.push({ id: `evt-${evt.id}`, kind: "evt", firstIdx, lastIdx, data: evt });
            });

            // Assign lanes: greedy algorithm - for each item, find the lowest lane not occupied on its day range
            const itemLanes = new Map<string, number>();
            // Sort by firstIdx so earlier items get lower lanes
            laneItems.sort((a, b) => a.firstIdx - b.firstIdx || a.lastIdx - b.lastIdx);
            // lanes[lane] = max lastIdx occupied
            const lanesEnd: number[] = [];
            laneItems.forEach((item) => {
              let assignedLane = -1;
              for (let l = 0; l < lanesEnd.length; l++) {
                if (lanesEnd[l] < item.firstIdx) { assignedLane = l; break; }
              }
              if (assignedLane === -1) { assignedLane = lanesEnd.length; lanesEnd.push(-1); }
              lanesEnd[assignedLane] = item.lastIdx;
              itemLanes.set(item.id, assignedLane);
            });

            const maxLanes = Math.max(1, lanesEnd.length);
            const rowMinHeight = Math.max(64, 8 + maxLanes * 28);

            return (
              <div
                key={resource.id}
                className={`grid border-b border-border last:border-b-0 transition-colors hover:brightness-95`}
                style={{ gridTemplateColumns: `180px ${colWidth}` }}
              >
                {/* Resource label */}
                <div className={`px-3 py-2.5 border-r-2 border-border flex items-center gap-2.5 ${rowIdx % 2 === 0 ? "bg-muted/20" : "bg-muted/5"} ${resourceConflicts.has(resource.id) ? "bg-destructive/10" : ""}`}>
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    resourceConflicts.has(resource.id)
                      ? "bg-destructive/20 text-destructive"
                      : resource.type === "employe" || resource.type === "equipe"
                      ? "bg-info/20 text-info"
                      : resource.type === "vehicule" || resource.type === "grue"
                      ? "bg-warning/20 text-warning"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {resourceConflicts.has(resource.id) ? <AlertTriangle className="h-3.5 w-3.5" /> : rowIdx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate text-foreground">{resource.name}</p>
                    {resourceConflicts.has(resource.id) ? (
                      <p className="text-[9px] text-destructive font-medium truncate">⚠ Conflit horaire</p>
                    ) : (
                      <p className="text-[9px] text-muted-foreground capitalize">{resource.type}</p>
                    )}
                    {/* Barre de charge hebdomadaire */}
                    {(() => {
                      const totalDays = days.length;
                      const occupiedDays = days.filter(day =>
                        getOpsForResourceDay(resource.id, day).length > 0 ||
                        getEventsForResource(resource.id, day).length > 0
                      ).length;
                      const rate = totalDays > 0 ? Math.round((occupiedDays / totalDays) * 100) : 0;
                      const barColor = rate >= 90 ? "bg-destructive" : rate >= 60 ? "bg-warning" : "bg-success";
                      return (
                        <div className="mt-1.5 w-full">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[8px] text-muted-foreground">Charge</span>
                            <span className={`text-[8px] font-bold ${rate >= 90 ? "text-destructive" : rate >= 60 ? "text-warning" : "text-success"}`}>{rate}%</span>
                          </div>
                          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${rate}%` }} />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Day cells - render items only on their first visible day */}
                {days.map((day, dayIdx) => {
                  const cellItems: React.ReactNode[] = [];

                  laneItems.forEach((item) => {
                    if (item.firstIdx !== dayIdx) return;
                    const lane = itemLanes.get(item.id) || 0;
                    const span = item.lastIdx - item.firstIdx + 1;

                    if (item.kind === "op") {
                      const op = item.data;
                      const loadDay = op.loading_date ? startOfDay(new Date(op.loading_date)) : null;
                      const delivDay = op.delivery_date ? startOfDay(new Date(op.delivery_date)) : loadDay;
                      const totalDays = loadDay && delivDay ? Math.round((delivDay.getTime() - loadDay.getTime()) / 86400000) + 1 : 1;
                      const color = companyColors[(op.companies as any)?.color] || "bg-primary text-primary-foreground";
                      cellItems.push(
                        <div
                          key={item.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, { kind: "op", id: op.id, durationDays: totalDays })}
                          className={`absolute left-1 rounded-lg ${color} flex items-center px-3 cursor-grab hover:opacity-90 transition-opacity shadow-sm`}
                          style={{ width: span > 1 ? `calc(${span * 100}% - 4px)` : "calc(100% - 8px)", zIndex: 5, top: `${4 + lane * 28}px`, height: "24px" }}
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
                    } else {
                      const evt = item.data;
                      const bgColor = evt.color || "#6b7280";
                      const client = (evt.dossiers as any)?.clients?.name;
                      const evtStart = startOfDay(new Date(evt.start_time));
                      const evtEnd = startOfDay(new Date(evt.end_time));
                      const totalDays = Math.round((evtEnd.getTime() - evtStart.getTime()) / 86400000) + 1;
                      cellItems.push(
                        <div
                          key={item.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, { kind: "evt", id: evt.id, durationDays: totalDays, startTime: evt.start_time, endTime: evt.end_time })}
                          className="absolute left-1 rounded-lg flex items-center px-3 cursor-grab hover:opacity-90 transition-opacity shadow-sm text-white"
                          style={{ backgroundColor: bgColor, width: span > 1 ? `calc(${span * 100}% - 4px)` : "calc(100% - 8px)", zIndex: 5, top: `${4 + lane * 28}px`, height: "24px" }}
                          onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                        >
                          <div className="flex items-center gap-3 min-w-0 w-full text-[11px] font-medium overflow-hidden">
                            <p className="font-bold truncate">{evt.title}</p>
                            {client && <p className="opacity-85 truncate">{client}</p>}
                            {totalDays > 1 && <span className="opacity-70 shrink-0">{totalDays}j</span>}
                          </div>
                        </div>
                      );
                    }
                  });

                  const cellKey = `res-${resource.id}-${dayIdx}`;
                    const hasItems = cellItems.length > 0;
                    const cellConflict = isDayConflict(resource.id, day);
                    return (
                     <div
                       key={day.toISOString()}
                       className={`group/cell border-r border-border last:border-r-0 relative overflow-visible cursor-pointer transition-colors ${
                         isToday(day) ? "bg-primary/5" : rowIdx % 2 === 0 ? "bg-muted/10" : ""
                       } hover:bg-muted/30 ${dragOverCell === cellKey ? "bg-primary/20" : ""} ${cellConflict ? "border-2 border-destructive/60" : ""}`}
                       style={{ minHeight: `${rowMinHeight}px` }}
                       onDragOver={(e) => handleDragOver(e, cellKey)}
                       onDragLeave={handleDragLeave}
                       onDrop={(e) => handleDrop(e, day)}
                       onClick={(e) => { e.stopPropagation(); openCreate(day, resource.id); }}
                       onTouchEnd={(e) => { e.preventDefault(); openCreate(day, resource.id); }}
                     >
                       {cellConflict && (
                         <div className="absolute top-1 right-1 z-20 h-4 w-4 rounded-full bg-destructive flex items-center justify-center" title="Conflit de planification">
                           <AlertTriangle className="h-2.5 w-2.5 text-white" />
                         </div>
                       )}
                       {cellItems}
                       {hasItems && !cellConflict && (
                         <button
                           className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 shadow-sm hover:scale-110"
                           onClick={(e) => { e.stopPropagation(); openCreate(day, resource.id); }}
                           title="Ajouter un événement"
                         >
                           <Plus className="h-3 w-3" />
                         </button>
                       )}
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
              <div className="grid border-t-2 border-border" style={{ gridTemplateColumns: `180px ${colWidth}` }}>
                <div className="px-3 py-2.5 border-r-2 border-border bg-muted/30 flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Non assigné</span>
                </div>
                {days.map((day, dayIdx) => {
                  const cellEvents = getUnassignedEventsForDay(day);
                    const cellKey = `unassigned-${dayIdx}`;
                    return (
                    <div
                      key={day.toISOString()}
                      className={`border-r border-border last:border-r-0 min-h-[56px] relative overflow-visible cursor-pointer hover:bg-muted/20 ${isToday(day) ? "bg-primary/5" : ""} ${dragOverCell === cellKey ? "bg-primary/20" : ""}`}
                      onDragOver={(e) => handleDragOver(e, cellKey)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day)}
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
                            draggable
                            onDragStart={(e) => handleDragStart(e, { kind: "evt", id: evt.id, durationDays: totalDays, startTime: evt.start_time, endTime: evt.end_time })}
                            className="absolute left-1 rounded-lg flex items-center px-3 cursor-grab hover:opacity-90 transition-opacity shadow-sm text-white"
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
      </div>
    );
  };

  // ==================== COMMERCIAL VIEW ====================
  const HOUR_START = 7;
  const HOUR_END = 19;
  const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  const HOUR_HEIGHT = 60; // px per hour

  const getEventTopAndHeight = (evt: any, day: Date) => {
    const evtStart = new Date(evt.start_time);
    const evtEnd = new Date(evt.end_time);
    // Clamp to the day boundaries
    const dayStart = new Date(day);
    dayStart.setHours(HOUR_START, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(HOUR_END, 0, 0, 0);
    const start = evtStart < dayStart ? dayStart : evtStart;
    const end = evtEnd > dayEnd ? dayEnd : evtEnd;
    const topMinutes = (start.getHours() - HOUR_START) * 60 + start.getMinutes();
    const durationMinutes = Math.max((end.getTime() - start.getTime()) / 60000, 30); // min 30min display
    return {
      top: (topMinutes / 60) * HOUR_HEIGHT,
      height: (durationMinutes / 60) * HOUR_HEIGHT,
    };
  };

  const openVisiteEdit = (v: any) => {
    setEditingVisite(v);
    setVisiteDate(v.scheduled_date || "");
    setVisiteTime(v.scheduled_time || "");
  };

  const saveVisiteTime = async () => {
    if (!editingVisite) return;
    setSavingVisite(true);
    const { error } = await supabase
      .from("visites")
      .update({ scheduled_date: visiteDate || null, scheduled_time: visiteTime || null })
      .eq("id", editingVisite.id);
    setSavingVisite(false);
    if (error) {
      toast.error("Erreur lors de la mise à jour");
      return;
    }
    toast.success("Horaire mis à jour");
    setEditingVisite(null);
    queryClient.invalidateQueries({ queryKey: ["planning-visites"] });
  };

  const getVisiteTopAndHeight = (v: any) => {
    if (!v.scheduled_time) return { top: 0, height: HOUR_HEIGHT };
    const [hh, mm] = v.scheduled_time.split(":").map(Number);
    const topMinutes = ((hh || 0) - HOUR_START) * 60 + (mm || 0);
    return {
      top: Math.max(0, (topMinutes / 60) * HOUR_HEIGHT),
      height: HOUR_HEIGHT, // default 1h for visites
    };
  };

  const renderCommercialView = () => {
    if (view === "month") return renderMonthView(true);
    const days = displayDays;
    const colWidth = view === "day" ? "1fr" : `repeat(${days.length}, minmax(0, 1fr))`;
    const totalHeight = HOURS.length * HOUR_HEIGHT;

    return (
      <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-auto">
        <div className="rounded-xl border bg-card overflow-auto" style={{ minHeight: 420 }}>
          <div className={isMobile ? "min-w-[700px]" : ""}>
            {/* Day headers */}
            <div className="grid border-b sticky top-0 bg-card z-20 shadow-sm" style={{ gridTemplateColumns: `60px ${colWidth}` }}>
              <div className="px-1 py-3 border-r bg-muted/50" />
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`px-2 py-2 text-center border-r last:border-r-0 cursor-pointer hover:bg-primary/15 transition-colors ${isToday(day) ? "bg-primary/10 border-b-2 border-b-primary" : "bg-muted/30"}`}
                  onClick={() => { setView("day"); setCurrentDate(day); }}
                >
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {format(day, "EEE", { locale: fr })}
                  </span>
                  <p className={`text-lg font-black leading-none mt-0.5 ${isToday(day) ? "text-primary" : "text-foreground"}`}>
                    {format(day, "d")}
                  </p>
                  <span className="text-[9px] text-muted-foreground capitalize">{format(day, "MMM yyyy", { locale: fr })}</span>
                </div>
              ))}
            </div>

            {/* Time grid body */}
            <div className="grid" style={{ gridTemplateColumns: `60px ${colWidth}` }}>
              {/* Hour labels column */}
              <div className="border-r relative" style={{ height: totalHeight }}>
                {HOURS.map((h, i) => (
                  <div
                    key={h}
                    className="absolute right-0 left-0 flex items-start justify-end border-t border-border/40 pr-2"
                    style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  >
                    <span className="text-[10px] font-medium text-muted-foreground -mt-0.5">{String(h).padStart(2, "0")}:00</span>
                  </div>
                ))}
              </div>

              {/* Day columns with events */}
              {days.map((day) => {
                const dayVisites = getVisitesForDay(day);
                const dayEvents = getEventsForDay(day, "commercial");

                return (
                  <div
                    key={day.toISOString()}
                    className={`border-r last:border-r-0 relative ${isToday(day) ? "bg-primary/[0.03]" : ""} ${dragOverCell === `comm-${format(day, "yyyy-MM-dd")}` ? "bg-primary/10" : ""}`}
                    style={{ height: totalHeight }}
                    onDragOver={(e) => handleDragOver(e, `comm-${format(day, "yyyy-MM-dd")}`)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleCommercialDrop(e, day)}
                    onClick={() => { setView("day"); setCurrentDate(day); }}
                  >
                    {/* Hour grid lines */}
                    {HOURS.map((h, i) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-t border-border/30"
                        style={{ top: i * HOUR_HEIGHT }}
                      />
                    ))}

                    {/* Visites */}
                    {dayVisites.map((v: any) => {
                      const { top, height } = getVisiteTopAndHeight(v);
                      return (
                        <div
                          key={v.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, { kind: "visite" as any, id: v.id, durationDays: 1, startTime: v.scheduled_date, endTime: v.scheduled_time })}
                          className="absolute left-1 right-1 rounded-md px-2 py-1 bg-info text-white text-[10px] cursor-grab hover:opacity-90 transition-opacity shadow-sm overflow-hidden z-10 border-l-[3px] border-l-[hsl(354,70%,54%)]"
                          style={{ top, height: Math.max(height, 28) }}
                          onClick={(e) => { e.stopPropagation(); navigate(`/visites/${v.id}`); }}
                        >
                          <p className="font-bold truncate">{(v.clients as any)?.name || "Visite"}</p>
                          {v.scheduled_time && <p className="opacity-80 text-[9px]">{v.scheduled_time}</p>}
                          {v.address && <p className="opacity-70 truncate text-[9px] flex items-center gap-0.5"><MapPin className="h-2 w-2 shrink-0" />{v.address}</p>}
                        </div>
                      );
                    })}

                    {/* Events (congés, absences, etc.) */}
                    {dayEvents.map((evt: any) => {
                      const { top, height } = getEventTopAndHeight(evt, day);
                      const bgColor = evt.color || "#ef4444";
                      const client = (evt.dossiers as any)?.clients?.name;
                      const eStart = startOfDay(new Date(evt.start_time));
                      const eEnd = startOfDay(new Date(evt.end_time));
                      const isMultiDay = eStart.getTime() !== eEnd.getTime();
                      const totalEvtDays = Math.round((eEnd.getTime() - eStart.getTime()) / 86400000) + 1;
                      return (
                        <div
                          key={evt.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, { kind: "evt", id: evt.id, durationDays: totalEvtDays, startTime: evt.start_time, endTime: evt.end_time })}
                          className="absolute left-0.5 right-0.5 rounded-md px-2 py-1 text-white text-[10px] font-medium cursor-grab hover:opacity-90 transition-opacity shadow-sm overflow-hidden z-10"
                          style={{
                            backgroundColor: bgColor,
                            top: isMultiDay ? 0 : top,
                            height: isMultiDay ? totalHeight : Math.max(height, 28),
                          }}
                          onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                        >
                          <p className="font-bold truncate">{evt.title}</p>
                          {client && <p className="opacity-85 truncate">{client}</p>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Devis pipeline */}
        <div className="rounded-xl border bg-card p-4 overflow-auto">
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
          const dayEvents = getEventsForDay(day, isCommercial ? "commercial" : "exploitation");
          const dayOps = getOpsForDay(day);
          const dayVisites = isCommercial ? getVisitesForDay(day) : [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const totalItems = dayEvents.length + dayOps.length + dayVisites.length;
          const cellKey = `month-${i}`;
          return (
            <div
              key={i}
              className={`border-r border-b last:border-r-0 min-h-[100px] p-1.5 cursor-pointer hover:bg-muted/20 transition-colors ${
                isToday(day) ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""
              } ${!isCurrentMonth ? "opacity-30" : ""} ${dragOverCell === cellKey ? "bg-primary/15" : ""}`}
              onClick={(e) => { e.stopPropagation(); setView("day"); setCurrentDate(day); }}
              onTouchEnd={(e) => { e.preventDefault(); setView("day"); setCurrentDate(day); }}
              onDragOver={(e) => handleDragOver(e, cellKey)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, day)}
              role="button"
              tabIndex={0}
            >
              <p className={`text-xs font-bold mb-1 ${isToday(day) ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</p>
              {isCommercial && dayVisites.slice(0, 2).map((v: any) => (
                <div key={v.id} draggable
                  onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, { kind: "visite", id: v.id, durationDays: 1, startTime: v.scheduled_date, endTime: v.scheduled_time }); }}
                  className="rounded px-1 py-0.5 text-[9px] truncate mb-0.5 bg-info text-white font-medium cursor-grab">
                  🏠 {(v.clients as any)?.name || "Visite"}
                </div>
              ))}
              {dayEvents.slice(0, isCommercial ? 1 : 3).map((evt: any) => {
                const bgColor = evt.color || "#6b7280";
                const eStart = startOfDay(new Date(evt.start_time));
                const eEnd = startOfDay(new Date(evt.end_time));
                const totalEvtDays = Math.round((eEnd.getTime() - eStart.getTime()) / 86400000) + 1;
                return (
                  <div key={evt.id} draggable
                    onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, { kind: "evt", id: evt.id, durationDays: totalEvtDays, startTime: evt.start_time, endTime: evt.end_time }); }}
                    className="rounded px-1 py-0.5 text-[9px] truncate mb-0.5 font-medium text-white cursor-grab"
                    style={{ backgroundColor: bgColor }}
                    onClick={(e) => { e.stopPropagation(); openEdit(evt); }}>
                    {format(new Date(evt.start_time), "HH:mm")} {evt.title}
                  </div>
                );
              })}
              {!isCommercial && dayOps.slice(0, 2).map((op: any) => {
                const color = companyColors[(op.companies as any)?.color] || "bg-primary text-primary-foreground";
                const loadDay = op.loading_date ? startOfDay(new Date(op.loading_date)) : null;
                const delivDay = op.delivery_date ? startOfDay(new Date(op.delivery_date)) : loadDay;
                const totalDays = loadDay && delivDay ? Math.round((delivDay.getTime() - loadDay.getTime()) / 86400000) + 1 : 1;
                return (
                  <div key={op.id} draggable
                    onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, { kind: "op", id: op.id, durationDays: totalDays }); }}
                    className={`rounded px-1 py-0.5 text-[9px] truncate mb-0.5 font-medium cursor-grab ${color}`}>
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
    <div className={`max-w-full mx-auto flex flex-col ${isMobile ? "p-3 pb-20 space-y-3 min-h-full" : "p-6 lg:p-8 space-y-4 h-[calc(100vh-1rem)]"}`}>
      {/* Header — modern & dense */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-black tracking-tight">Planning</h1>
            <p className="text-xs text-muted-foreground capitalize">{headerLabel}</p>
          </div>
          {/* Navigation intégrée dans le header */}
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => nav(-1)} className="p-1.5 rounded-lg border hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors">
              Aujourd'hui
            </button>
            <button onClick={() => nav(1)} className="p-1.5 rounded-lg border hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Bouton IA */}
          <Button variant="outline" size="sm" onClick={() => setAiPlannerOpen(true)} className="gap-1.5 text-xs border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950 btn-primary-glow">
            <Sparkles className="h-3.5 w-3.5" />
            {isMobile ? "IA" : "Planifier avec l'IA"}
          </Button>
          {/* Bouton Nouvelle mission — vert prominent */}
          <Button onClick={() => { setMissionDefaultDate(undefined); setMissionDefaultResource(undefined); setAiPreFill(null); setMissionPanelOpen(true); }} className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs btn-primary-glow">
            <Plus className="h-3.5 w-3.5" /> {isMobile ? "Mission" : "Nouvelle mission"}
          </Button>
          {/* Bouton Événement — secondaire */}
          <Button variant="outline" size="sm" onClick={() => openCreate()} className="text-xs gap-1">
            <Plus className="h-3 w-3" /> Événement
          </Button>
          {/* Filtre entreprises */}
          <div className={`flex rounded-lg border bg-card p-0.5 gap-0.5 ${isMobile ? "hidden" : ""}`}>
            {companies.map((c) => (
              <button key={c.id} onClick={() => setCurrent(c.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${current === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                {c.shortName}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Mobile company filter */}
      {isMobile && (
        <div className="flex rounded-lg border bg-card p-0.5 gap-0.5 overflow-x-auto scrollbar-none">
          {companies.map((c) => (
            <button key={c.id} onClick={() => setCurrent(c.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${current === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {c.shortName}
            </button>
          ))}
        </div>
      )}

      {/* Controls bar — single compact line */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none border rounded-xl bg-card px-3 py-2">
        {/* Tabs Exploitation / Commercial */}
        <Tabs value={planningType} onValueChange={(v) => setPlanningType(v as PlanningType)}>
          <TabsList className="h-7">
            <TabsTrigger value="exploitation" className="text-xs gap-1 h-6">
              <Truck className="h-3 w-3" /> {isMobile ? "Exploit." : "Exploitation"}
            </TabsTrigger>
            <TabsTrigger value="commercial" className="text-xs gap-1 h-6">
              <Briefcase className="h-3 w-3" /> Commercial
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="w-px h-4 bg-border shrink-0" />

        {/* Mode exploitation */}
        {planningType === "exploitation" && (
          <div className="flex gap-0.5">
            {([
              { value: "operation" as ExploitationMode, label: "Opérations", icon: ClipboardList },
              { value: "vehicule" as ExploitationMode, label: "Véhicules", icon: Truck },
              { value: "personnel" as ExploitationMode, label: "Personnel", icon: User },
            ]).map((mode) => (
              <button key={mode.value} onClick={() => setExploitationMode(mode.value)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${exploitationMode === mode.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <mode.icon className="h-3 w-3" /> {mode.label}
              </button>
            ))}
          </div>
        )}

        {/* Filtre commercial */}
        {planningType === "commercial" && (
          <div className="flex gap-0.5">
            <button onClick={() => setSelectedCommercial("global")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${selectedCommercial === "global" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              <Globe className="h-3 w-3" /> Global
            </button>
            {commercials.map((advisor) => (
              <button key={advisor} onClick={() => setSelectedCommercial(advisor)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${selectedCommercial === advisor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <User className="h-3 w-3" /> {advisor}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/* Vue Jour/Sem/Mois */}
          <div className="flex rounded-lg border bg-muted/30 p-0.5 gap-0.5">
            {(["day", "week", "month"] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>
          {/* iCal */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="p-1.5 rounded-lg border hover:bg-muted transition-colors" title="Synchroniser avec un calendrier externe">
                <CalendarSync className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4 space-y-3" align="end">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Sync calendrier</p>
                <p className="text-xs text-muted-foreground">
                  Copiez le lien iCal et ajoutez-le dans Google Calendar, Outlook ou Apple Calendar pour synchroniser automatiquement vos événements.
                </p>
              </div>
              <Button size="sm" className="w-full text-xs gap-1.5" onClick={getIcalUrl}>
                {icalCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {icalCopied ? "Lien copié !" : "Copier le lien iCal"}
              </Button>
              {icalUrl && !icalCopied && (
                <Input value={icalUrl} readOnly className="text-[10px] h-7" onFocus={(e) => e.target.select()} />
              )}
              <p className="text-[10px] text-muted-foreground">
                Google Calendar : Autres agendas → À partir de l'URL
              </p>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Content — no framer-motion wrapper */}
      <div className={isMobile ? "flex flex-col" : "flex-1 flex flex-col min-h-0"}>
        {planningType === "exploitation" ? renderExploitationView() : renderCommercialView()}
      </div>

      <PlanningEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editingEvent}
        defaultDate={defaultDate}
        defaultResourceId={defaultResourceId}
        onOpenOperation={(opId) => { setEditingOpId(opId); setOpDialogOpen(true); }}
      />
      <PlanningOperationDialog
        open={opDialogOpen}
        onOpenChange={(v) => { setOpDialogOpen(v); if (!v) setEditingOpId(null); }}
        operationId={editingOpId}
      />
      <PlanningMissionPanel
        open={missionPanelOpen}
        onOpenChange={(v) => { setMissionPanelOpen(v); if (!v) setAiPreFill(null); }}
        defaultDate={missionDefaultDate}
        defaultResourceId={missionDefaultResource}
        onOpenFullDialog={() => { setEditingOpId(null); setOpDialogOpen(true); }}
        preFill={aiPreFill}
      />
      <PlanningAIAssistant
        open={aiPlannerOpen}
        onOpenChange={setAiPlannerOpen}
        onApply={handleAISuggestion}
      />
    </div>
  );
};

export default Planning;
