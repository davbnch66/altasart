import { useState, useEffect, useMemo } from "react";
import { Calendar as CalendarIcon, Clock, Loader2, MapPin, Palette, Tag, Users, Truck, User, Link2, AlertTriangle, FileText, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parse, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";

interface PlanningEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: any;
  defaultDate?: Date;
  defaultResourceId?: string;
}

const EVENT_TYPES = [
  { value: "intervention", label: "Intervention", icon: "🔧" },
  { value: "livraison", label: "Livraison", icon: "📦" },
  { value: "visite", label: "Visite technique", icon: "🔍" },
  { value: "reunion", label: "Réunion", icon: "👥" },
  { value: "formation", label: "Formation", icon: "🎓" },
  { value: "maintenance", label: "Maintenance", icon: "⚙️" },
  { value: "conge", label: "Congé / Absence", icon: "🏖️" },
  { value: "autre", label: "Autre", icon: "📌" },
];

const COLOR_OPTIONS = [
  { value: "#3b82f6", label: "Bleu" },
  { value: "#10b981", label: "Vert" },
  { value: "#f59e0b", label: "Orange" },
  { value: "#ef4444", label: "Rouge" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#ec4899", label: "Rose" },
  { value: "#6b7280", label: "Gris" },
];

const PRIORITY_OPTIONS = [
  { value: "basse", label: "Basse", color: "bg-muted text-muted-foreground" },
  { value: "normale", label: "Normale", color: "bg-info/20 text-info" },
  { value: "haute", label: "Haute", color: "bg-warning/20 text-warning" },
  { value: "urgente", label: "Urgente", color: "bg-destructive/20 text-destructive" },
];

export const PlanningEventDialog = ({
  open,
  onOpenChange,
  event,
  defaultDate,
  defaultResourceId,
}: PlanningEventDialogProps) => {
  const { current, dbCompanies } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const companyId = current === "global" ? dbCompanies[0]?.id : current;
  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];

  // Form state
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("intervention");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [allDay, setAllDay] = useState(false);
  const [resourceIds, setResourceIds] = useState<string[]>([]);
  const [dossierId, setDossierId] = useState<string>("__none__");
  const [selectedCompanyId, setSelectedCompanyId] = useState(companyId || "");
  const [eventColor, setEventColor] = useState("#3b82f6");
  const [priority, setPriority] = useState("normale");
  const [location, setLocation] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  // Fetch resources
  const { data: resources = [] } = useQuery({
    queryKey: ["planning-resources-dialog", companyIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("resource_companies")
        .select("resource_id, resources(id, name, type, status)")
        .in("company_id", companyIds);
      const seen = new Set<string>();
      return (data || [])
        .map((rc: any) => rc.resources)
        .filter((r: any) => r && !seen.has(r.id) && seen.add(r.id));
    },
    enabled: open && companyIds.length > 0,
  });

  // Fetch dossiers
  const { data: dossiers = [] } = useQuery({
    queryKey: ["planning-dossiers-dialog", companyIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("dossiers")
        .select("id, title, code, clients(name)")
        .in("company_id", companyIds)
        .not("stage", "in", '("termine","paye")')
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: open && companyIds.length > 0,
  });

  // Grouped resources
  const groupedResources = useMemo(() => {
    const groups: Record<string, any[]> = { employe: [], vehicule: [], grue: [] };
    resources.forEach((r: any) => {
      const type = r.type === "equipe" ? "employe" : r.type === "grue" ? "grue" : r.type === "vehicule" ? "vehicule" : "employe";
      if (!groups[type]) groups[type] = [];
      groups[type].push(r);
    });
    return groups;
  }, [resources]);

  // Duration display
  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return differenceInCalendarDays(endDate, startDate) + 1;
  }, [startDate, endDate]);

  // Populate on edit
  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title || "");
      setDescription(event.description || "");
      const sDate = new Date(event.start_time);
      const eDate = new Date(event.end_time);
      setStartDate(sDate);
      setEndDate(eDate);
      setStartTime(format(sDate, "HH:mm"));
      setEndTime(format(eDate, "HH:mm"));
      setResourceIds(event.resource_id ? [event.resource_id] : []);
      setDossierId(event.dossier_id || "__none__");
      setSelectedCompanyId(event.company_id || companyId || "");
      setEventColor(event.color || "#3b82f6");
      setEventType("intervention");
      setPriority("normale");
      setLocation("");
      setInternalNotes("");
      setAllDay(false);
    } else {
      const d = defaultDate || new Date();
      setTitle("");
      setDescription("");
      setStartDate(d);
      setEndDate(d);
      setStartTime("08:00");
      setEndTime("17:00");
      setResourceIds(defaultResourceId ? [defaultResourceId] : []);
      setDossierId("__none__");
      setSelectedCompanyId(companyId || "");
      setEventColor("#3b82f6");
      setEventType("intervention");
      setPriority("normale");
      setLocation("");
      setInternalNotes("");
      setAllDay(false);
    }
  }, [event, defaultDate, defaultResourceId, companyId, open]);

  const toggleResource = (id: string) => {
    setResourceIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!title.trim() || !startDate) {
      toast.error("Titre et date requis");
      return;
    }
    if (!selectedCompanyId) {
      toast.error("Sélectionnez une société");
      return;
    }

    setSaving(true);
    try {
      const sDateStr = format(startDate, "yyyy-MM-dd");
      const eDateStr = endDate ? format(endDate, "yyyy-MM-dd") : sDateStr;
      const sT = allDay ? "00:00" : startTime;
      const eT = allDay ? "23:59" : endTime;

      const payload = {
        title: title.trim(),
        description: [description, internalNotes ? `[Notes internes] ${internalNotes}` : ""].filter(Boolean).join("\n\n").trim() || null,
        start_time: `${sDateStr}T${sT}:00`,
        end_time: `${eDateStr}T${eT}:00`,
        resource_id: resourceIds.length > 0 ? resourceIds[0] : null,
        dossier_id: dossierId === "__none__" ? null : dossierId,
        company_id: selectedCompanyId,
        created_by: user?.id || null,
        color: eventColor,
      };

      if (event) {
        const { error } = await supabase
          .from("planning_events")
          .update(payload)
          .eq("id", event.id);
        if (error) throw error;
        toast.success("Événement modifié");
      } else {
        const { error } = await supabase
          .from("planning_events")
          .insert(payload);
        if (error) throw error;
        toast.success("Événement créé");
      }

      queryClient.invalidateQueries({ queryKey: ["planning-events"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("planning_events")
        .delete()
        .eq("id", event.id);
      if (error) throw error;
      toast.success("Événement supprimé");
      queryClient.invalidateQueries({ queryKey: ["planning-events"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const selectedResources = resources.filter((r: any) => resourceIds.includes(r.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header with color accent */}
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderBottomColor: eventColor }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: eventColor }} />
              {event ? "Modifier l'événement" : "Nouvel événement"}
              {durationDays > 1 && (
                <Badge variant="secondary" className="ml-2 text-[10px]">{durationDays} jours</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Title input inline in header */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de l'événement *"
            className="mt-3 text-base font-medium border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
          />
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b px-6 bg-transparent h-auto py-0 gap-0">
            <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-2.5 text-xs">
              Général
            </TabsTrigger>
            <TabsTrigger value="ressources" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-2.5 text-xs">
              Ressources {resourceIds.length > 0 && <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">{resourceIds.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-2.5 text-xs">
              Détails
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Général ── */}
          <TabsContent value="general" className="px-6 py-4 space-y-4 mt-0">
            {/* Type + Priority row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">{t.icon} {t.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Priorité</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${p.color.split(" ")[0]}`} />
                          {p.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date range */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Période</Label>
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="rounded" />
                  Journée entière
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Start date */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-9 text-xs justify-start", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                      {startDate ? format(startDate, "dd MMM yyyy", { locale: fr }) : "Date début"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => {
                        setStartDate(d);
                        if (d && (!endDate || d > endDate)) setEndDate(d);
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {/* End date */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-9 text-xs justify-start", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                      {endDate ? format(endDate, "dd MMM yyyy", { locale: fr }) : "Date fin"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(d) => startDate ? d < startDate : false}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {/* Times */}
              {!allDay && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-9 text-xs" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-9 text-xs" />
                  </div>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Lieu</Label>
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Adresse ou lieu" className="h-9 text-xs" />
              </div>
            </div>

            {/* Company selector (global mode) */}
            {current === "global" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Société</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Sélectionner…" />
                  </SelectTrigger>
                  <SelectContent>
                    {dbCompanies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Dossier */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Dossier lié
              </Label>
              <Select value={dossierId} onValueChange={setDossierId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {dossiers.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code ? `${d.code} — ` : ""}{d.title} ({(d.clients as any)?.name || "—"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Palette className="h-3 w-3" /> Couleur
              </Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                      eventColor === c.value ? "border-foreground scale-110 ring-2 ring-offset-2 ring-offset-background" : "border-transparent"
                    )}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setEventColor(c.value)}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── Tab: Ressources ── */}
          <TabsContent value="ressources" className="px-6 py-4 space-y-4 mt-0">
            {/* Selected resources summary */}
            {selectedResources.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Affectés ({selectedResources.length})</Label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedResources.map((r: any) => (
                    <Badge key={r.id} variant="secondary" className="text-[10px] gap-1 pr-1">
                      {r.type === "employe" || r.type === "equipe" ? <User className="h-2.5 w-2.5" /> : <Truck className="h-2.5 w-2.5" />}
                      {r.name}
                      <button onClick={() => toggleResource(r.id)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Personnel section */}
            {groupedResources.employe?.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> Personnel
                </Label>
                <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto">
                  {groupedResources.employe.map((r: any) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleResource(r.id)}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs transition-colors",
                        resourceIds.includes(r.id)
                          ? "bg-primary/10 border-primary text-primary font-medium"
                          : "bg-card border-border hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                        resourceIds.includes(r.id) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {r.name?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate">{r.name}</p>
                        {r.status === "absent" && <p className="text-[9px] text-destructive">Absent</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Véhicules section */}
            {groupedResources.vehicule?.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3" /> Véhicules
                </Label>
                <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto">
                  {groupedResources.vehicule.map((r: any) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleResource(r.id)}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs transition-colors",
                        resourceIds.includes(r.id)
                          ? "bg-warning/10 border-warning text-warning font-medium"
                          : "bg-card border-border hover:bg-muted/50"
                      )}
                    >
                      <Truck className={cn("h-4 w-4 shrink-0", resourceIds.includes(r.id) ? "text-warning" : "text-muted-foreground")} />
                      <span className="truncate">{r.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Grues section */}
            {groupedResources.grue?.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  ⛽ Grues / Engins
                </Label>
                <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto">
                  {groupedResources.grue.map((r: any) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleResource(r.id)}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs transition-colors",
                        resourceIds.includes(r.id)
                          ? "bg-info/10 border-info text-info font-medium"
                          : "bg-card border-border hover:bg-muted/50"
                      )}
                    >
                      <span className="text-sm shrink-0">🏗️</span>
                      <span className="truncate">{r.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Détails ── */}
          <TabsContent value="details" className="px-6 py-4 space-y-4 mt-0">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Instructions, détails de l'intervention…"
                rows={4}
                className="resize-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> Notes internes
              </Label>
              <Textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Notes visibles uniquement en interne…"
                rows={3}
                className="resize-none text-sm bg-muted/30"
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="flex gap-2 px-6 py-4 border-t">
          {event && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={saving} className="mr-auto gap-1">
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !title.trim() || !startDate}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            {event ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
