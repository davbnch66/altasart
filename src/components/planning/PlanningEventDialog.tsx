import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Calendar as CalendarIcon, Clock, Loader2, MapPin, Palette, Tag, Users, Truck, User, Link2, AlertTriangle, FileText, Trash2, Plus, X, Warehouse, Building2, HardHat, ExternalLink, CheckCircle, ArrowDownToLine } from "lucide-react";
import { MaterielListDisplay } from "@/components/MaterielListDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { useNavigate } from "react-router-dom";
import { AiWriteButton } from "@/components/planning/AiWriteButton";

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
  { value: "demenagement", label: "Déménagement", icon: "🏠" },
  { value: "visite", label: "Visite technique", icon: "🔍" },
  { value: "manutention", label: "Manutention", icon: "📐" },
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
  { value: "normale", label: "Normale", color: "bg-blue-100 text-blue-700" },
  { value: "haute", label: "Haute", color: "bg-orange-100 text-orange-700" },
  { value: "urgente", label: "Urgente", color: "bg-red-100 text-red-700" },
];

const DEPOT_ADDRESS = { address: "12 rue Jean Monnet", postal_code: "95190", city: "Goussainville" };

// ── Address Block extracted as a stable component ──
interface AddressBlockFields {
  address: string; setAddress: (v: string) => void;
  postalCode: string; setPostalCode: (v: string) => void;
  city: string; setCity: (v: string) => void;
  floor: string; setFloor: (v: string) => void;
  access: string; setAccess: (v: string) => void;
  elevator: boolean; setElevator: (v: boolean) => void;
  parkingRequest: boolean; setParkingRequest: (v: boolean) => void;
  portage: string; setPortage: (v: string) => void;
  passageFenetre: boolean; setPassageFenetre: (v: boolean) => void;
  monteMeubles: boolean; setMonteMeubles: (v: boolean) => void;
  transbordement: boolean; setTransbordement: (v: boolean) => void;
  comments: string; setComments: (v: string) => void;
}

interface AddressBlockProps {
  title: string;
  fields: AddressBlockFields;
  clientId?: string;
  onFillClient?: () => void;
  onFillDepot?: () => void;
}

const AddressBlock = ({ title: blockTitle, fields, clientId, onFillClient, onFillDepot }: AddressBlockProps) => {
  const {
    address, setAddress, postalCode, setPostalCode, city, setCity,
    floor, setFloor, access, setAccess, elevator, setElevator,
    parkingRequest, setParkingRequest, portage, setPortage,
    passageFenetre, setPassageFenetre, monteMeubles, setMonteMeubles,
    transbordement, setTransbordement, comments, setComments,
  } = fields;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary">{blockTitle}</h4>
        <div className="flex gap-1">
          {clientId && clientId !== "__none__" && onFillClient && (
            <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={onFillClient}>
              <Building2 className="h-3 w-3" /> Client
            </Button>
          )}
          {onFillDepot && (
            <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={onFillDepot}>
              <Warehouse className="h-3 w-3" /> Dépôt
            </Button>
          )}
        </div>
      </div>

      <div>
        <Label className="text-[10px] text-muted-foreground">Adresse</Label>
        <AddressAutocomplete
          value={address}
          onChange={setAddress}
          onSelect={(s) => {
            setAddress(s.label);
            if (s.postcode) setPostalCode(s.postcode);
            if (s.city) setCity(s.city);
          }}
          placeholder="Adresse"
          className="h-7 text-xs"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-[10px] text-muted-foreground">CP</Label><Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="h-7 text-xs" /></div>
        <div className="col-span-2"><Label className="text-[10px] text-muted-foreground">Ville</Label><Input value={city} onChange={(e) => setCity(e.target.value)} className="h-7 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-[10px] text-muted-foreground">Étage</Label><Input value={floor} onChange={(e) => setFloor(e.target.value)} className="h-7 text-xs" placeholder="RDC, 3e…" /></div>
        <div><Label className="text-[10px] text-muted-foreground">Portage (m)</Label><Input type="number" value={portage} onChange={(e) => setPortage(e.target.value)} className="h-7 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {[
          { checked: elevator, set: setElevator, label: "Ascenseur" },
          { checked: passageFenetre, set: setPassageFenetre, label: "Passage fenêtre" },
          { checked: monteMeubles, set: setMonteMeubles, label: "Monte-meubles" },
          { checked: transbordement, set: setTransbordement, label: "Transbordement" },
          { checked: parkingRequest, set: setParkingRequest, label: "Stationnement" },
        ].map(({ checked, set, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Checkbox checked={checked} onCheckedChange={(v) => set(!!v)} />
            <label className="text-[10px] cursor-pointer">{label}</label>
          </div>
        ))}
      </div>
      <div><Label className="text-[10px] text-muted-foreground">Accès</Label><Input value={access} onChange={(e) => setAccess(e.target.value)} className="h-7 text-xs" placeholder="Digicode, portail…" /></div>
      <div><Label className="text-[10px] text-muted-foreground">Observations</Label><Textarea value={comments} onChange={(e) => setComments(e.target.value)} className="min-h-[40px] text-xs resize-none" /></div>
    </div>
  );
};

export const PlanningEventDialog = ({
  open, onOpenChange, event, defaultDate, defaultResourceId,
}: PlanningEventDialogProps) => {
  const { current, dbCompanies } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [creatingBT, setCreatingBT] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [dossierSearch, setDossierSearch] = useState("");

  const companyId = current === "global" ? dbCompanies[0]?.id : current;
  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];

  // ── Form state ──
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
  const [clientId, setClientId] = useState<string>("__none__");
  const [selectedCompanyId, setSelectedCompanyId] = useState(companyId || "");
  const [eventColor, setEventColor] = useState("#3b82f6");
  const [priority, setPriority] = useState("normale");
  const [internalNotes, setInternalNotes] = useState("");

  // Loading address
  const [loadingAddress, setLoadingAddress] = useState("");
  const [loadingPostalCode, setLoadingPostalCode] = useState("");
  const [loadingCity, setLoadingCity] = useState("");
  const [loadingFloor, setLoadingFloor] = useState("");
  const [loadingAccess, setLoadingAccess] = useState("");
  const [loadingElevator, setLoadingElevator] = useState(false);
  const [loadingParkingRequest, setLoadingParkingRequest] = useState(false);
  const [loadingPortage, setLoadingPortage] = useState("0");
  const [loadingPassageFenetre, setLoadingPassageFenetre] = useState(false);
  const [loadingMonteMeubles, setLoadingMonteMeubles] = useState(false);
  const [loadingTransbordement, setLoadingTransbordement] = useState(false);
  const [loadingComments, setLoadingComments] = useState("");

  // Delivery address
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPostalCode, setDeliveryPostalCode] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryFloor, setDeliveryFloor] = useState("");
  const [deliveryAccess, setDeliveryAccess] = useState("");
  const [deliveryElevator, setDeliveryElevator] = useState(false);
  const [deliveryParkingRequest, setDeliveryParkingRequest] = useState(false);
  const [deliveryPortage, setDeliveryPortage] = useState("0");
  const [deliveryPassageFenetre, setDeliveryPassageFenetre] = useState(false);
  const [deliveryMonteMeubles, setDeliveryMonteMeubles] = useState(false);
  const [deliveryTransbordement, setDeliveryTransbordement] = useState(false);
  const [deliveryComments, setDeliveryComments] = useState("");

  // Logistics
  const [volume, setVolume] = useState("");
  const [weight, setWeight] = useState("");
  const [instructions, setInstructions] = useState("");

  // ── Fetch resources ──
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

  // ── Fetch clients ──
  const { data: clients = [] } = useQuery({
    queryKey: ["planning-clients-dialog", companyIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, address, postal_code, city, phone, email")
        .in("company_id", companyIds)
        .order("name")
        .limit(200);
      return data || [];
    },
    enabled: open && companyIds.length > 0,
  });

  // ── Fetch dossiers ──
  const { data: dossiers = [] } = useQuery({
    queryKey: ["planning-dossiers-dialog", companyIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("dossiers")
        .select("id, title, code, client_id, clients(name), loading_address, loading_postal_code, loading_city, delivery_address, delivery_postal_code, delivery_city, volume, weight")
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

  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return differenceInCalendarDays(endDate, startDate) + 1;
  }, [startDate, endDate]);

  // ── Fetch event resources from junction table ──
  const { data: eventResLinks = [] } = useQuery({
    queryKey: ["event-resources-dialog", event?.id],
    queryFn: async () => {
      if (!event?.id) return [];
      const { data } = await supabase
        .from("event_resources")
        .select("resource_id")
        .eq("event_id", event.id);
      return (data || []).map((r: any) => r.resource_id);
    },
    enabled: open && !!event?.id,
  });

  // ── Fetch operations (BT) linked to the same dossier ──
  const { data: dossierOperations = [] } = useQuery({
    queryKey: ["event-dossier-operations", dossierId],
    queryFn: async () => {
      if (!dossierId || dossierId === "__none__") return [];
      const { data } = await supabase
        .from("operations")
        .select("id, operation_number, type, loading_date, delivery_date, completed, lv_bt_number, loading_city, delivery_city")
        .eq("dossier_id", dossierId)
        .order("sort_order");
      return data || [];
    },
    enabled: open && !!dossierId && dossierId !== "__none__",
  });

  // ── Fetch visite & devis instructions linked to the dossier ──
  const { data: dossierSources } = useQuery({
    queryKey: ["event-dossier-sources", dossierId],
    queryFn: async () => {
      if (!dossierId || dossierId === "__none__") return null;
      // Fetch visites with methodologie/instructions
      const { data: visites } = await supabase
        .from("visites")
        .select("id, code, methodologie, instructions, contraintes_acces, contraintes_techniques")
        .eq("dossier_id", dossierId)
        .order("created_at", { ascending: false })
        .limit(5);
      // Fetch devis with notes/custom_content
      const { data: devisData } = await supabase
        .from("devis")
        .select("id, code, notes, custom_content, objet")
        .eq("dossier_id", dossierId)
        .order("created_at", { ascending: false })
        .limit(5);
      return { visites: visites || [], devis: devisData || [] };
    },
    enabled: open && !!dossierId && dossierId !== "__none__",
  });

  // ── Create BT from event ──
  const handleCreateBT = async () => {
    if (!dossierId || dossierId === "__none__") {
      toast.error("Liez un dossier pour créer un bon de travail");
      return;
    }
    setCreatingBT(true);
    try {
      // Get next operation number
      const { data: existing } = await supabase
        .from("operations")
        .select("operation_number")
        .eq("dossier_id", dossierId)
        .order("operation_number", { ascending: false })
        .limit(1);
      const nextNum = (existing?.[0]?.operation_number || 0) + 1;

      const sDateStr = startDate ? format(startDate, "yyyy-MM-dd") : null;
      
      const payload: Record<string, any> = {
        dossier_id: dossierId,
        company_id: selectedCompanyId,
        operation_number: nextNum,
        sort_order: nextNum,
        type: "B.T.",
        loading_date: sDateStr,
        loading_address: loadingAddress || null,
        loading_postal_code: loadingPostalCode || null,
        loading_city: loadingCity || null,
        loading_floor: loadingFloor || null,
        loading_access: loadingAccess || null,
        loading_elevator: loadingElevator,
        loading_parking_request: loadingParkingRequest,
        loading_portage: Number(loadingPortage) || 0,
        loading_passage_fenetre: loadingPassageFenetre,
        loading_monte_meubles: loadingMonteMeubles,
        loading_transbordement: loadingTransbordement,
        loading_comments: loadingComments || null,
        loading_time_start: allDay ? null : startTime || null,
        loading_time_end: allDay ? null : endTime || null,
        delivery_address: deliveryAddress || null,
        delivery_postal_code: deliveryPostalCode || null,
        delivery_city: deliveryCity || null,
        delivery_floor: deliveryFloor || null,
        delivery_access: deliveryAccess || null,
        delivery_elevator: deliveryElevator,
        delivery_parking_request: deliveryParkingRequest,
        delivery_portage: Number(deliveryPortage) || 0,
        delivery_passage_fenetre: deliveryPassageFenetre,
        delivery_monte_meubles: deliveryMonteMeubles,
        delivery_transbordement: deliveryTransbordement,
        delivery_comments: deliveryComments || null,
        volume: volume ? Number(volume) : 0,
        weight: weight ? Number(weight) : 0,
        instructions: instructions || null,
        notes: description || null,
      };

      const { data: newOp, error } = await supabase.from("operations").insert(payload as any).select("id").single();
      if (error) throw error;

      // Copy event resources to operation_resources
      if (resourceIds.length > 0 && newOp) {
        const rows = resourceIds.map((rid) => ({ operation_id: newOp.id, resource_id: rid }));
        await supabase.from("operation_resources").insert(rows as any);
      }

      toast.success(`Bon de travail n°${nextNum} créé`);
      queryClient.invalidateQueries({ queryKey: ["event-dossier-operations"] });
      queryClient.invalidateQueries({ queryKey: ["planning-operations"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-operations"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création du BT");
    } finally {
      setCreatingBT(false);
    }
  };

  // ── Populate on edit / reset on create ──
  const eventId = event?.id;
  const formInitRef = useRef<string | null>(null);
  const eventResLinksKey = JSON.stringify(eventResLinks);

  useEffect(() => {
    if (!open) {
      formInitRef.current = null;
      return;
    }
    // Include linked resources in init key so edit form re-inits when junction data arrives
    const initKey = `${eventId || "new"}-${defaultDate?.toISOString() || ""}-${defaultResourceId || ""}-${eventId ? eventResLinksKey : "new"}`;
    if (formInitRef.current === initKey) return;
    formInitRef.current = initKey;

    if (event) {
      const e = event as any;
      setTitle(e.title || "");
      setDescription(e.description?.replace(/\n\n\[Notes internes\].*$/s, "").replace(/\n\n\[Consignes\].*$/s, "") || "");
      setInternalNotes(e.internal_notes || "");
      setInstructions(e.instructions || "");
      const sDate = new Date(e.start_time);
      const eDate = new Date(e.end_time);
      setStartDate(sDate);
      setEndDate(eDate);
      setStartTime(format(sDate, "HH:mm"));
      setEndTime(format(eDate, "HH:mm"));
      const linkedResourceIds = eventResLinks as string[];
      setResourceIds(linkedResourceIds.length > 0 ? linkedResourceIds : e.resource_id ? [e.resource_id] : []);
      setDossierId(e.dossier_id || "__none__");
      setClientId(e.client_id || "__none__");
      setSelectedCompanyId(e.company_id || companyId || "");
      setEventColor(e.color || "#3b82f6");
      setEventType(e.event_type || "intervention");
      setPriority(e.priority || "normale");
      setAllDay(e.all_day || false);
      setVolume(e.volume != null ? String(e.volume) : "");
      setWeight(e.weight != null ? String(e.weight) : "");
      // Restore addresses
      setLoadingAddress(e.loading_address || "");
      setLoadingPostalCode(e.loading_postal_code || "");
      setLoadingCity(e.loading_city || "");
      setLoadingFloor(e.loading_floor || "");
      setLoadingAccess(e.loading_access || "");
      setLoadingElevator(e.loading_elevator || false);
      setLoadingParkingRequest(e.loading_parking_request || false);
      setLoadingPortage(String(e.loading_portage || 0));
      setLoadingPassageFenetre(e.loading_passage_fenetre || false);
      setLoadingMonteMeubles(e.loading_monte_meubles || false);
      setLoadingTransbordement(e.loading_transbordement || false);
      setLoadingComments(e.loading_comments || "");
      setDeliveryAddress(e.delivery_address || "");
      setDeliveryPostalCode(e.delivery_postal_code || "");
      setDeliveryCity(e.delivery_city || "");
      setDeliveryFloor(e.delivery_floor || "");
      setDeliveryAccess(e.delivery_access || "");
      setDeliveryElevator(e.delivery_elevator || false);
      setDeliveryParkingRequest(e.delivery_parking_request || false);
      setDeliveryPortage(String(e.delivery_portage || 0));
      setDeliveryPassageFenetre(e.delivery_passage_fenetre || false);
      setDeliveryMonteMeubles(e.delivery_monte_meubles || false);
      setDeliveryTransbordement(e.delivery_transbordement || false);
      setDeliveryComments(e.delivery_comments || "");
    } else {
      const d = defaultDate || new Date();
      setTitle("");
      setDescription("");
      setInternalNotes("");
      setStartDate(d);
      setEndDate(d);
      setStartTime("08:00");
      setEndTime("17:00");
      setResourceIds(defaultResourceId ? [defaultResourceId] : []);
      setDossierId("__none__");
      setClientId("__none__");
      setSelectedCompanyId(companyId || "");
      setEventColor("#3b82f6");
      setEventType("intervention");
      setPriority("normale");
      setAllDay(false);
      resetAddresses();
    }
  }, [eventId, defaultDate, defaultResourceId, companyId, open, eventResLinksKey]);

  const resetAddresses = () => {
    setLoadingAddress(""); setLoadingPostalCode(""); setLoadingCity("");
    setLoadingFloor(""); setLoadingAccess(""); setLoadingElevator(false);
    setLoadingParkingRequest(false); setLoadingPortage("0");
    setLoadingPassageFenetre(false); setLoadingMonteMeubles(false);
    setLoadingTransbordement(false); setLoadingComments("");
    setDeliveryAddress(""); setDeliveryPostalCode(""); setDeliveryCity("");
    setDeliveryFloor(""); setDeliveryAccess(""); setDeliveryElevator(false);
    setDeliveryParkingRequest(false); setDeliveryPortage("0");
    setDeliveryPassageFenetre(false); setDeliveryMonteMeubles(false);
    setDeliveryTransbordement(false); setDeliveryComments("");
    setVolume(""); setWeight(""); setInstructions("");
  };

  const fillDepot = (prefix: "loading" | "delivery") => {
    if (prefix === "loading") {
      setLoadingAddress(DEPOT_ADDRESS.address);
      setLoadingPostalCode(DEPOT_ADDRESS.postal_code);
      setLoadingCity(DEPOT_ADDRESS.city);
    } else {
      setDeliveryAddress(DEPOT_ADDRESS.address);
      setDeliveryPostalCode(DEPOT_ADDRESS.postal_code);
      setDeliveryCity(DEPOT_ADDRESS.city);
    }
  };

  const fillFromClient = (prefix: "loading" | "delivery") => {
    const client = clients.find((c: any) => c.id === clientId);
    if (!client) return;
    if (prefix === "loading") {
      setLoadingAddress(client.address || "");
      setLoadingPostalCode(client.postal_code || "");
      setLoadingCity(client.city || "");
    } else {
      setDeliveryAddress(client.address || "");
      setDeliveryPostalCode(client.postal_code || "");
      setDeliveryCity(client.city || "");
    }
  };

  // When dossier is selected, auto-fill addresses & client
  const handleDossierChange = (val: string) => {
    setDossierId(val);
    if (val === "__none__") return;
    const dossier = dossiers.find((d: any) => d.id === val);
    if (!dossier) return;
    if (dossier.client_id) setClientId(dossier.client_id);
    if (dossier.loading_address) {
      setLoadingAddress(dossier.loading_address || "");
      setLoadingPostalCode(dossier.loading_postal_code || "");
      setLoadingCity(dossier.loading_city || "");
    }
    if (dossier.delivery_address) {
      setDeliveryAddress(dossier.delivery_address || "");
      setDeliveryPostalCode(dossier.delivery_postal_code || "");
      setDeliveryCity(dossier.delivery_city || "");
    }
    if (dossier.volume) setVolume(String(dossier.volume));
    if (dossier.weight) setWeight(String(dossier.weight));
  };

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

      // Build a rich description that encodes all extra fields
      const addressInfo = [];
      if (loadingAddress || loadingCity) {
        addressInfo.push(`[Chargement] ${loadingAddress} ${loadingPostalCode} ${loadingCity}`.trim());
        const details: string[] = [];
        if (loadingFloor) details.push(`Étage: ${loadingFloor}`);
        if (loadingElevator) details.push("Ascenseur");
        if (loadingParkingRequest) details.push("Stationnement");
        if (Number(loadingPortage) > 0) details.push(`Portage: ${loadingPortage}m`);
        if (loadingPassageFenetre) details.push("Passage fenêtre");
        if (loadingMonteMeubles) details.push("Monte-meubles");
        if (loadingTransbordement) details.push("Transbordement");
        if (loadingAccess) details.push(`Accès: ${loadingAccess}`);
        if (details.length) addressInfo.push(details.join(" | "));
        if (loadingComments) addressInfo.push(`Obs: ${loadingComments}`);
      }
      if (deliveryAddress || deliveryCity) {
        addressInfo.push(`[Livraison] ${deliveryAddress} ${deliveryPostalCode} ${deliveryCity}`.trim());
        const details: string[] = [];
        if (deliveryFloor) details.push(`Étage: ${deliveryFloor}`);
        if (deliveryElevator) details.push("Ascenseur");
        if (deliveryParkingRequest) details.push("Stationnement");
        if (Number(deliveryPortage) > 0) details.push(`Portage: ${deliveryPortage}m`);
        if (deliveryPassageFenetre) details.push("Passage fenêtre");
        if (deliveryMonteMeubles) details.push("Monte-meubles");
        if (deliveryTransbordement) details.push("Transbordement");
        if (deliveryAccess) details.push(`Accès: ${deliveryAccess}`);
        if (details.length) addressInfo.push(details.join(" | "));
        if (deliveryComments) addressInfo.push(`Obs: ${deliveryComments}`);
      }
      const logistics: string[] = [];
      if (volume) logistics.push(`Volume: ${volume} m³`);
      if (weight) logistics.push(`Poids: ${weight} t`);

      const descParts = [
        description,
        addressInfo.length ? addressInfo.join("\n") : "",
        logistics.length ? logistics.join(" — ") : "",
        instructions ? `[Consignes] ${instructions}` : "",
        internalNotes ? `[Notes internes] ${internalNotes}` : "",
      ].filter(Boolean);

      const payload: Record<string, any> = {
        title: title.trim(),
        description: descParts.join("\n\n").trim() || null,
        start_time: `${sDateStr}T${sT}:00`,
        end_time: `${eDateStr}T${eT}:00`,
        resource_id: resourceIds.length > 0 ? resourceIds[0] : null,
        dossier_id: dossierId === "__none__" ? null : dossierId,
        client_id: clientId === "__none__" ? null : clientId,
        company_id: selectedCompanyId,
        created_by: user?.id || null,
        color: eventColor,
        event_type: eventType,
        priority,
        all_day: allDay,
        internal_notes: internalNotes || null,
        instructions: instructions || null,
        volume: volume ? Number(volume) : null,
        weight: weight ? Number(weight) : null,
        loading_address: loadingAddress || null,
        loading_postal_code: loadingPostalCode || null,
        loading_city: loadingCity || null,
        loading_floor: loadingFloor || null,
        loading_access: loadingAccess || null,
        loading_elevator: loadingElevator,
        loading_parking_request: loadingParkingRequest,
        loading_portage: Number(loadingPortage) || 0,
        loading_passage_fenetre: loadingPassageFenetre,
        loading_monte_meubles: loadingMonteMeubles,
        loading_transbordement: loadingTransbordement,
        loading_comments: loadingComments || null,
        delivery_address: deliveryAddress || null,
        delivery_postal_code: deliveryPostalCode || null,
        delivery_city: deliveryCity || null,
        delivery_floor: deliveryFloor || null,
        delivery_access: deliveryAccess || null,
        delivery_elevator: deliveryElevator,
        delivery_parking_request: deliveryParkingRequest,
        delivery_portage: Number(deliveryPortage) || 0,
        delivery_passage_fenetre: deliveryPassageFenetre,
        delivery_monte_meubles: deliveryMonteMeubles,
        delivery_transbordement: deliveryTransbordement,
        delivery_comments: deliveryComments || null,
      };

      let eventId: string;

      if (event) {
        const { error } = await supabase.from("planning_events").update(payload as any).eq("id", event.id);
        if (error) throw error;
        eventId = event.id;
        toast.success("Événement modifié");
      } else {
        const { data: inserted, error } = await supabase.from("planning_events").insert(payload as any).select("id").single();
        if (error) throw error;
        eventId = inserted.id;
        toast.success("Événement créé");
      }

      // Sync event_resources junction table
      // Delete existing links
      const { error: delErr } = await supabase.from("event_resources").delete().eq("event_id", eventId);
      if (delErr) console.error("[event_resources] delete error:", delErr);
      // Insert new links
      if (resourceIds.length > 0) {
        const rows = resourceIds.map((rid) => ({ event_id: eventId, resource_id: rid }));
        const { error: insErr } = await supabase.from("event_resources").insert(rows);
        if (insErr) {
          console.error("[event_resources] insert error:", insErr);
          toast.error("Erreur sauvegarde ressources : " + insErr.message);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["planning-events"] });
      queryClient.invalidateQueries({ queryKey: ["planning-event-resources"] });
      queryClient.invalidateQueries({ queryKey: ["event-resources-dialog"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!event) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await supabase.from("event_resources").delete().eq("event_id", event.id);
      const { error } = await supabase.from("planning_events").delete().eq("id", event.id);
      if (error) throw error;
      toast.success("Événement supprimé");
      queryClient.invalidateQueries({ queryKey: ["planning-events"] });
      queryClient.invalidateQueries({ queryKey: ["planning-event-resources"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const selectedResources = resources.filter((r: any) => resourceIds.includes(r.id));
  const selectedClient = clients.find((c: any) => c.id === clientId);

  // ── Conflict detection ──
  const { data: conflicts = [] } = useQuery({
    queryKey: ["resource-conflicts", resourceIds, startDate?.toISOString(), endDate?.toISOString(), startTime, endTime, allDay, event?.id],
    queryFn: async () => {
      if (resourceIds.length === 0 || !startDate) return [];
      const sDateStr = format(startDate, "yyyy-MM-dd");
      const eDateStr = endDate ? format(endDate, "yyyy-MM-dd") : sDateStr;
      const sT = allDay ? "00:00" : startTime;
      const eT = allDay ? "23:59" : endTime;
      const rangeStart = `${sDateStr}T${sT}:00`;
      const rangeEnd = `${eDateStr}T${eT}:00`;

      // Find all events overlapping the time range
      const { data: overlapping } = await supabase
        .from("planning_events")
        .select("id, title, start_time, end_time, resource_id")
        .lt("start_time", rangeEnd)
        .gt("end_time", rangeStart);

      if (!overlapping || overlapping.length === 0) return [];

      // Exclude current event being edited
      const otherEvents = overlapping.filter((e: any) => e.id !== event?.id);
      if (otherEvents.length === 0) return [];

      // Get event_resources for these events
      const eventIds = otherEvents.map((e: any) => e.id);
      const { data: erLinks } = await supabase
        .from("event_resources")
        .select("event_id, resource_id")
        .in("event_id", eventIds);

      // Build a map: resourceId -> conflicting events
      const result: { resourceId: string; resourceName: string; eventTitle: string; eventStart: string; eventEnd: string }[] = [];

      for (const rid of resourceIds) {
        // Check legacy resource_id
        const legacyConflicts = otherEvents.filter((e: any) => e.resource_id === rid);
        // Check junction table
        const junctionEventIds = (erLinks || []).filter((l: any) => l.resource_id === rid).map((l: any) => l.event_id);
        const junctionConflicts = otherEvents.filter((e: any) => junctionEventIds.includes(e.id));
        
        const allConflicts = [...legacyConflicts, ...junctionConflicts];
        const seen = new Set<string>();
        for (const c of allConflicts) {
          if (seen.has(c.id)) continue;
          seen.add(c.id);
          const res = resources.find((r: any) => r.id === rid);
          result.push({
            resourceId: rid,
            resourceName: res?.name || "Ressource",
            eventTitle: c.title,
            eventStart: c.start_time,
            eventEnd: c.end_time,
          });
        }
      }
      return result;
    },
    enabled: open && resourceIds.length > 0 && !!startDate,
  });

  // AddressBlock props passed down
  const addressBlockProps = {
    loading: {
      address: loadingAddress, setAddress: setLoadingAddress,
      postalCode: loadingPostalCode, setPostalCode: setLoadingPostalCode,
      city: loadingCity, setCity: setLoadingCity,
      floor: loadingFloor, setFloor: setLoadingFloor,
      access: loadingAccess, setAccess: setLoadingAccess,
      elevator: loadingElevator, setElevator: setLoadingElevator,
      parkingRequest: loadingParkingRequest, setParkingRequest: setLoadingParkingRequest,
      portage: loadingPortage, setPortage: setLoadingPortage,
      passageFenetre: loadingPassageFenetre, setPassageFenetre: setLoadingPassageFenetre,
      monteMeubles: loadingMonteMeubles, setMonteMeubles: setLoadingMonteMeubles,
      transbordement: loadingTransbordement, setTransbordement: setLoadingTransbordement,
      comments: loadingComments, setComments: setLoadingComments,
    },
    delivery: {
      address: deliveryAddress, setAddress: setDeliveryAddress,
      postalCode: deliveryPostalCode, setPostalCode: setDeliveryPostalCode,
      city: deliveryCity, setCity: setDeliveryCity,
      floor: deliveryFloor, setFloor: setDeliveryFloor,
      access: deliveryAccess, setAccess: setDeliveryAccess,
      elevator: deliveryElevator, setElevator: setDeliveryElevator,
      parkingRequest: deliveryParkingRequest, setParkingRequest: setDeliveryParkingRequest,
      portage: deliveryPortage, setPortage: setDeliveryPortage,
      passageFenetre: deliveryPassageFenetre, setPassageFenetre: setDeliveryPassageFenetre,
      monteMeubles: deliveryMonteMeubles, setMonteMeubles: setDeliveryMonteMeubles,
      transbordement: deliveryTransbordement, setTransbordement: setDeliveryTransbordement,
      comments: deliveryComments, setComments: setDeliveryComments,
    },
  };

  // ── Build context string for AI generation ──
  const buildAiContext = useCallback(() => {
    const parts: string[] = [];
    if (title) parts.push(`Titre : ${title}`);
    const typeLabel = EVENT_TYPES.find(t => t.value === eventType)?.label;
    if (typeLabel) parts.push(`Type : ${typeLabel}`);
    const client = clients.find((c: any) => c.id === clientId);
    if (client) parts.push(`Client : ${client.name}`);
    const dossier = dossiers.find((d: any) => d.id === dossierId);
    if (dossier) parts.push(`Dossier : ${dossier.code || ""} ${dossier.title}`);
    if (loadingAddress || loadingCity) parts.push(`Chargement : ${loadingAddress} ${loadingPostalCode} ${loadingCity}`.trim());
    if (loadingFloor) parts.push(`Étage chargement : ${loadingFloor}`);
    if (loadingAccess) parts.push(`Accès chargement : ${loadingAccess}`);
    if (deliveryAddress || deliveryCity) parts.push(`Livraison : ${deliveryAddress} ${deliveryPostalCode} ${deliveryCity}`.trim());
    if (deliveryFloor) parts.push(`Étage livraison : ${deliveryFloor}`);
    if (deliveryAccess) parts.push(`Accès livraison : ${deliveryAccess}`);
    if (volume) parts.push(`Volume : ${volume} m³`);
    if (weight) parts.push(`Poids : ${weight} t`);
    if (loadingElevator) parts.push("Ascenseur au chargement");
    if (deliveryElevator) parts.push("Ascenseur à la livraison");
    if (loadingPassageFenetre || deliveryPassageFenetre) parts.push("Passage fenêtre requis");
    if (loadingMonteMeubles || deliveryMonteMeubles) parts.push("Monte-meubles requis");
    // Include visite/devis sources if available
    if (dossierSources) {
      dossierSources.visites.forEach((v: any) => {
        if (v.methodologie) parts.push(`Méthodologie visite : ${v.methodologie.substring(0, 500)}`);
        if (v.contraintes_techniques) parts.push(`Contraintes techniques : ${v.contraintes_techniques}`);
        if (v.contraintes_acces) parts.push(`Contraintes accès : ${v.contraintes_acces}`);
      });
    }
    const selectedRes = resources.filter((r: any) => resourceIds.includes(r.id));
    if (selectedRes.length > 0) parts.push(`Ressources : ${selectedRes.map((r: any) => r.name).join(", ")}`);
    return parts.join("\n");
  }, [title, eventType, clientId, dossierId, clients, dossiers, loadingAddress, loadingPostalCode, loadingCity, loadingFloor, loadingAccess, deliveryAddress, deliveryPostalCode, deliveryCity, deliveryFloor, deliveryAccess, volume, weight, loadingElevator, deliveryElevator, loadingPassageFenetre, deliveryPassageFenetre, loadingMonteMeubles, deliveryMonteMeubles, dossierSources, resources, resourceIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
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
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de l'événement *"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            name="evt-title-field"
            className="mt-3 text-base font-medium border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
          />
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b px-6 bg-transparent h-auto py-0 gap-0">
            <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-2.5 text-xs">
              Général
            </TabsTrigger>
            <TabsTrigger value="adresses" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-2.5 text-xs">
              Adresses
            </TabsTrigger>
            <TabsTrigger value="ressources" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-2.5 text-xs">
              Ressources {resourceIds.length > 0 && <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">{resourceIds.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-2.5 text-xs">
              Détails
            </TabsTrigger>
            <TabsTrigger value="bt" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-2.5 text-xs">
              <HardHat className="h-3 w-3 mr-1" /> BT {dossierOperations.length > 0 && <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">{dossierOperations.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Général ── */}
          <TabsContent value="general" className="px-6 py-4 space-y-4 mt-0">
            {/* Type + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
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

            {/* Client (searchable) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Client
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-9 text-xs justify-between font-normal">
                    {clientId !== "__none__" ? clients.find((c: any) => c.id === clientId)?.name || "Client" : "Aucun"}
                    <span className="text-muted-foreground ml-1">▾</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <div className="p-2 border-b">
                    <Input
                      placeholder="Rechercher un client…"
                      className="h-8 text-xs"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto p-1">
                    <button
                      type="button"
                      className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors"
                      onClick={() => {
                        const prev = clientId;
                        setClientId("__none__");
                        if (prev !== "__none__" && dossierId !== "__none__") {
                          setDossierId("__none__");
                        }
                        setClientSearch("");
                      }}
                    >
                      Aucun
                    </button>
                    {clients
                      .filter((c: any) => !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase()))
                      .map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors",
                            clientId === c.id && "bg-primary/10 font-medium"
                          )}
                          onClick={() => {
                            setClientId(c.id);
                            if (dossierId !== "__none__") {
                              const currentDossier = dossiers.find((d: any) => d.id === dossierId);
                              if (currentDossier && currentDossier.client_id !== c.id) {
                                setDossierId("__none__");
                              }
                            }
                            setClientSearch("");
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Dossier (searchable) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Dossier lié
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-9 text-xs justify-between font-normal">
                    {dossierId !== "__none__"
                      ? (() => { const d = dossiers.find((d: any) => d.id === dossierId); return d ? `${d.code ? d.code + " — " : ""}${d.title}` : "Dossier"; })()
                      : "Aucun"}
                    <span className="text-muted-foreground ml-1">▾</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[340px] p-0" align="start">
                  <div className="p-2 border-b">
                    <Input
                      placeholder="Rechercher un dossier…"
                      className="h-8 text-xs"
                      value={dossierSearch}
                      onChange={(e) => setDossierSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto p-1">
                    <button
                      type="button"
                      className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors"
                      onClick={() => { setDossierId("__none__"); setDossierSearch(""); }}
                    >
                      Aucun
                    </button>
                    {dossiers
                      .filter((d: any) => clientId === "__none__" || d.client_id === clientId)
                      .filter((d: any) => {
                        if (!dossierSearch) return true;
                        const q = dossierSearch.toLowerCase();
                        return d.title?.toLowerCase().includes(q) || d.code?.toLowerCase().includes(q) || (d.clients as any)?.name?.toLowerCase().includes(q);
                      })
                      .map((d: any) => (
                        <button
                          key={d.id}
                          type="button"
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors",
                            dossierId === d.id && "bg-primary/10 font-medium"
                          )}
                          onClick={() => { handleDossierChange(d.id); setDossierSearch(""); }}
                        >
                          {d.code ? `${d.code} — ` : ""}{d.title} <span className="text-muted-foreground">({(d.clients as any)?.name || "—"})</span>
                        </button>
                      ))}
                  </div>
                </PopoverContent>
              </Popover>
              {dossierId !== "__none__" && (
                <p className="text-[10px] text-muted-foreground">Les adresses et volumes du dossier ont été pré-remplis.</p>
              )}
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-9 text-xs justify-start", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                      {startDate ? format(startDate, "dd MMM yyyy", { locale: fr }) : "Date début"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); if (d && (!endDate || d > endDate)) setEndDate(d); }} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-9 text-xs justify-start", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                      {endDate ? format(endDate, "dd MMM yyyy", { locale: fr }) : "Date fin"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} disabled={(d) => startDate ? d < startDate : false} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
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

            {/* Company selector (global mode) */}
            {current === "global" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Société</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    {dbCompanies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEventColor(c.value); }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── Tab: Adresses ── */}
          <TabsContent value="adresses" className="px-6 py-4 space-y-4 mt-0">
            {/* Liste matériel (depuis la visite liée au dossier) */}
            <MaterielListDisplay dossierId={dossierId !== "__none__" ? dossierId : undefined} />

            {/* Chargement / Livraison side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AddressBlock title="Chargement" fields={addressBlockProps.loading} clientId={clientId} onFillClient={() => fillFromClient("loading")} onFillDepot={() => fillDepot("loading")} />
              <AddressBlock title="Livraison" fields={addressBlockProps.delivery} clientId={clientId} onFillClient={() => fillFromClient("delivery")} onFillDepot={() => fillDepot("delivery")} />
            </div>
          </TabsContent>

          {/* ── Tab: Ressources ── */}
          <TabsContent value="ressources" className="px-6 py-4 space-y-4 mt-0">
            {/* Conflict alerts */}
            {conflicts.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-destructive font-semibold text-xs">
                  <AlertTriangle className="h-4 w-4" />
                  Conflit(s) de planification détecté(s)
                </div>
                {conflicts.map((c, i) => (
                  <p key={i} className="text-[11px] text-destructive/90">
                    <strong>{c.resourceName}</strong> est déjà affecté(e) à « {c.eventTitle} » du{" "}
                    {format(new Date(c.eventStart), "dd/MM HH:mm", { locale: fr })} au{" "}
                    {format(new Date(c.eventEnd), "dd/MM HH:mm", { locale: fr })}
                  </p>
                ))}
              </div>
            )}

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

            {groupedResources.employe?.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Personnel</Label>
                <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto">
                  {groupedResources.employe.map((r: any) => (
                    <button key={r.id} type="button" onClick={() => toggleResource(r.id)}
                      className={cn("flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs transition-colors",
                        resourceIds.includes(r.id) ? "bg-primary/10 border-primary text-primary font-medium" : "bg-card border-border hover:bg-muted/50"
                      )}>
                      <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                        resourceIds.includes(r.id) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>{r.name?.charAt(0)}</div>
                      <div className="min-w-0"><p className="truncate">{r.name}</p>
                        {r.status === "absent" && <p className="text-[9px] text-destructive">Absent</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {groupedResources.vehicule?.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> Véhicules</Label>
                <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto">
                  {groupedResources.vehicule.map((r: any) => (
                    <button key={r.id} type="button" onClick={() => toggleResource(r.id)}
                      className={cn("flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs transition-colors",
                        resourceIds.includes(r.id) ? "bg-amber-500/10 border-amber-500 text-amber-700 font-medium" : "bg-card border-border hover:bg-muted/50"
                      )}>
                      <Truck className={cn("h-4 w-4 shrink-0", resourceIds.includes(r.id) ? "text-amber-500" : "text-muted-foreground")} />
                      <span className="truncate">{r.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {groupedResources.grue?.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">⛽ Grues / Engins</Label>
                <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto">
                  {groupedResources.grue.map((r: any) => (
                    <button key={r.id} type="button" onClick={() => toggleResource(r.id)}
                      className={cn("flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs transition-colors",
                        resourceIds.includes(r.id) ? "bg-cyan-500/10 border-cyan-500 text-cyan-700 font-medium" : "bg-card border-border hover:bg-muted/50"
                      )}>
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
            {/* Sources from visite/devis */}
            {dossierSources && (dossierSources.visites.length > 0 || dossierSources.devis.length > 0) && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <ArrowDownToLine className="h-3 w-3" /> Récupérer depuis les sources
                </h4>
                {dossierSources.visites.map((v: any) => {
                  const hasContent = v.methodologie || v.instructions || v.contraintes_acces || v.contraintes_techniques;
                  if (!hasContent) return null;
                  return (
                    <div key={v.id} className="space-y-1">
                      <p className="text-[10px] font-medium text-primary">Visite {v.code || ""}</p>
                      <div className="flex flex-wrap gap-1">
                        {v.methodologie && (
                          <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2"
                            onClick={() => setInstructions(prev => prev ? `${prev}\n\n${v.methodologie}` : v.methodologie)}>
                            + Méthodologie
                          </Button>
                        )}
                        {v.instructions && (
                          <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2"
                            onClick={() => setInstructions(prev => prev ? `${prev}\n\n${v.instructions}` : v.instructions)}>
                            + Consignes visite
                          </Button>
                        )}
                        {v.contraintes_acces && (
                          <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2"
                            onClick={() => setInstructions(prev => prev ? `${prev}\n\nAccès : ${v.contraintes_acces}` : `Accès : ${v.contraintes_acces}`)}>
                            + Contraintes accès
                          </Button>
                        )}
                        {v.contraintes_techniques && (
                          <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2"
                            onClick={() => setInstructions(prev => prev ? `${prev}\n\n${v.contraintes_techniques}` : v.contraintes_techniques)}>
                            + Contraintes techniques
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {dossierSources.devis.map((d: any) => {
                  if (!d.notes && !d.custom_content) return null;
                  return (
                    <div key={d.id} className="space-y-1">
                      <p className="text-[10px] font-medium text-primary">Devis {d.code || d.objet}</p>
                      <div className="flex flex-wrap gap-1">
                        {d.notes && (
                          <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2"
                            onClick={() => setInternalNotes(prev => prev ? `${prev}\n\n${d.notes}` : d.notes)}>
                            + Notes devis
                          </Button>
                        )}
                        {d.custom_content && (
                          <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2"
                            onClick={() => setDescription(prev => prev ? `${prev}\n\n${d.custom_content}` : d.custom_content)}>
                            + Contenu devis
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Consignes / Mode opératoire</Label>
                <AiWriteButton
                  field="instructions"
                  context={buildAiContext()}
                  currentText={instructions}
                  onGenerated={setInstructions}
                  label="Rédiger avec l'IA"
                />
              </div>
              <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Mode opératoire, consignes de sécurité…" rows={3} className="resize-none text-sm" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <AiWriteButton
                  field="description"
                  context={buildAiContext()}
                  currentText={description}
                  onGenerated={setDescription}
                  label="Rédiger avec l'IA"
                />
              </div>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Détails de l'intervention…" rows={3} className="resize-none text-sm" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Notes internes
                </Label>
                <AiWriteButton
                  field="notes"
                  context={buildAiContext()}
                  currentText={internalNotes}
                  onGenerated={setInternalNotes}
                  label="Rédiger avec l'IA"
                />
              </div>
              <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Notes visibles uniquement en interne…" rows={3} className="resize-none text-sm bg-muted/30" />
            </div>
          </TabsContent>

          {/* ── Tab: Bons de travail ── */}
          <TabsContent value="bt" className="px-6 py-4 space-y-4 mt-0">
            {dossierId === "__none__" ? (
              <div className="text-center py-8 space-y-2">
                <HardHat className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Liez un dossier dans l'onglet « Général » pour voir et créer des bons de travail.</p>
              </div>
            ) : (
              <>
                {/* Existing operations */}
                {dossierOperations.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Bons de travail du dossier ({dossierOperations.length})</Label>
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                      {dossierOperations.map((op: any) => (
                        <div
                          key={op.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => { onOpenChange(false); navigate(`/dossiers/${dossierId}`); }}
                        >
                          <div className={cn(
                            "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                            op.completed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          )}>
                            {op.completed ? <CheckCircle className="h-3.5 w-3.5" /> : <HardHat className="h-3.5 w-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {op.lv_bt_number || `BT n°${op.operation_number}`}
                              <span className="ml-2 text-muted-foreground font-normal">{op.type}</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {[op.loading_date, op.loading_city, op.delivery_city ? `→ ${op.delivery_city}` : ""].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <Badge variant={op.completed ? "default" : "secondary"} className="text-[9px] shrink-0">
                            {op.completed ? "Terminé" : "En cours"}
                          </Badge>
                          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">Aucun bon de travail pour ce dossier</p>
                  </div>
                )}

                {/* Create BT button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleCreateBT}
                  disabled={creatingBT}
                >
                  {creatingBT ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Créer un bon de travail depuis cet événement
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Les adresses, ressources et dates de l'événement seront pré-remplies dans le BT.
                </p>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="flex flex-col gap-2 px-6 py-4 border-t">
          {conflicts.length > 0 && (
            <div className="w-full flex items-center gap-1.5 text-destructive text-[11px] font-medium">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {conflicts.length} conflit(s) — l'événement sera créé mais des ressources se chevauchent
            </div>
          )}
          <div className="flex gap-2 w-full">
            {event && (
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={saving} className="mr-auto gap-1">
                <Trash2 className="h-3.5 w-3.5" /> {confirmDelete ? "Confirmer ?" : "Supprimer"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !title.trim() || !startDate}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {event ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
