import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { PdfCanvasViewer } from "@/components/visite/PdfCanvasViewer";
import { ARPhotoOverlay } from "@/components/ar/ARPhotoOverlay";
import { CraneLookup } from "@/components/ressources/CraneLookup";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  User, Wrench, Truck, AlertTriangle, CheckCircle2, Clock, Plus, Trash2,
  Shield, Heart, GraduationCap, Settings, FileText, Calendar, Phone,
  ShieldCheck, Activity, Zap, HardHat, Package, Mail, MapPin, Upload,
  Camera, Sparkles, Eye, Download, IdCard, X, Loader2, Receipt
} from "lucide-react";
import { VehicleExpenseDialog } from "@/components/terrain/VehicleExpenseDialog";
import { Model3DViewer, getModelPath } from "@/components/ressources/Model3DViewer";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center, Stage } from "@react-three/drei";
import { format, differenceInDays } from "date-fns";

const TYPE_ICONS: Record<string, React.ElementType> = {
  employe: HardHat, grue: Wrench, vehicule: Truck, equipement: Package, equipe: User,
};

const STATUS_COLORS: Record<string, string> = {
  disponible: "bg-success/10 text-success border-success/20",
  occupe: "bg-warning/10 text-warning border-warning/20",
  en_mission: "bg-info/10 text-info border-info/20",
  maintenance: "bg-destructive/10 text-destructive border-destructive/20",
  hors_service: "bg-destructive/10 text-destructive border-destructive/20",
  absent: "bg-muted text-muted-foreground",
  en_conge: "bg-muted text-muted-foreground",
};

// Statuts selon le type de ressource
const STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  employe: [
    { value: "disponible", label: "Disponible" },
    { value: "occupe", label: "Occupé" },
    { value: "absent", label: "Absent" },
    { value: "en_conge", label: "En congé" },
  ],
  default: [
    { value: "disponible", label: "Disponible" },
    { value: "en_mission", label: "En mission" },
    { value: "maintenance", label: "Maintenance" },
    { value: "hors_service", label: "Hors service" },
  ],
};

const DOC_TYPES: Record<string, { label: string; color: string }> = {
  identite: { label: "Pièce d'identité", color: "bg-blue-500/10 text-blue-600" },
  contrat: { label: "Contrat", color: "bg-green-500/10 text-green-600" },
  diplome: { label: "Diplôme", color: "bg-purple-500/10 text-purple-600" },
  caces: { label: "CACES", color: "bg-orange-500/10 text-orange-600" },
  medical: { label: "Médical", color: "bg-pink-500/10 text-pink-600" },
  autre: { label: "Autre", color: "bg-muted text-muted-foreground" },
};

const EQUIP_DOC_TYPES: Record<string, { label: string; color: string }> = {
  photo: { label: "Photo", color: "bg-blue-500/10 text-blue-600" },
  carte_grise: { label: "Carte grise", color: "bg-green-500/10 text-green-600" },
  vgp: { label: "VGP", color: "bg-purple-500/10 text-purple-600" },
  assurance: { label: "Assurance", color: "bg-orange-500/10 text-orange-600" },
  controle_technique: { label: "Contrôle tech.", color: "bg-yellow-500/10 text-yellow-700" },
  abaque: { label: "Abaque", color: "bg-teal-500/10 text-teal-600" },
  fiche_technique: { label: "Fiche technique", color: "bg-indigo-500/10 text-indigo-600" },
  autre: { label: "Autre", color: "bg-muted text-muted-foreground" },
};

const INTERVENTION_TYPES: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  vgp: { label: "VGP", color: "bg-purple-500/10 text-purple-600 border-purple-200", icon: ShieldCheck },
  entretien: { label: "Entretien", color: "bg-blue-500/10 text-blue-600 border-blue-200", icon: Settings },
  reparation: { label: "Réparation", color: "bg-destructive/10 text-destructive border-destructive/20", icon: Wrench },
  controle: { label: "Contrôle", color: "bg-info/10 text-info border-info/20", icon: Shield },
  nettoyage: { label: "Nettoyage", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
  formation: { label: "Formation", color: "bg-green-500/10 text-green-600 border-green-200", icon: GraduationCap },
  absence: { label: "Absence / Congé", color: "bg-orange-500/10 text-orange-600 border-orange-200", icon: Calendar },
  visite_medicale: { label: "Visite médicale", color: "bg-pink-500/10 text-pink-600 border-pink-200", icon: Heart },
};

const STATUS_INTERVENTION: Record<string, string> = {
  planifie: "Planifié", en_cours: "En cours", termine: "Terminé", annule: "Annulé",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgente: "text-destructive", haute: "text-warning", normale: "text-muted-foreground", basse: "text-muted-foreground/60",
};

function getDaysUntil(date?: string | null): number | null {
  if (!date) return null;
  return differenceInDays(new Date(date), new Date());
}

function AlertBadge({ days, label }: { days: number | null; label: string }) {
  if (days === null) return null;
  const expired = days < 0;
  const soon = days >= 0 && days < 30;
  if (!expired && !soon) return null;
  return (
    <div className={`flex items-center gap-1.5 text-xs rounded-md px-2 py-1 ${expired ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
      <AlertTriangle className="h-3 w-3" />
      {expired ? `${label} expirée il y a ${Math.abs(days)}j` : `${label} expire dans ${days}j`}
    </div>
  );
}

interface Props {
  resource: any;
  open: boolean;
  onClose: () => void;
  companies: any[];
}

export function ResourceDetailSheet({ resource, open, onClose, companies }: Props) {
  const qc = useQueryClient();
  const [localType, setLocalType] = useState(resource?.type);
  const Icon = TYPE_ICONS[localType] ?? User;
  const isEquipment = ["grue", "vehicule", "equipement"].includes(localType);
  const isPersonnel = localType === "employe";

  const [newIntervention, setNewIntervention] = useState({
    type: isPersonnel ? "formation" : "entretien",
    title: "", description: "", status: "planifie", priority: "normale",
    scheduled_date: "", completed_date: "", next_due_date: "", cost: "", provider: "", reference: "",
  });
  const [showAddIntervention, setShowAddIntervention] = useState(false);

  // ---- Queries ----
  const { data: equipment, refetch: refetchEquipment } = useQuery({
    queryKey: ["resource-equipment", resource?.id],
    enabled: !!resource?.id && isEquipment,
    queryFn: async () => {
      const { data } = await supabase.from("resource_equipment").select("*").eq("resource_id", resource.id).maybeSingle();
      return data;
    },
  });

  const { data: personnel, refetch: refetchPersonnel } = useQuery({
    queryKey: ["resource-personnel", resource?.id],
    enabled: !!resource?.id && isPersonnel,
    queryFn: async () => {
      const { data } = await supabase.from("resource_personnel").select("*").eq("resource_id", resource.id).maybeSingle();
      return data;
    },
  });

  const { data: interventions = [] } = useQuery({
    queryKey: ["resource-interventions", resource?.id],
    enabled: !!resource?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("resource_interventions").select("*").eq("resource_id", resource.id).order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: documents = [], refetch: refetchDocs } = useQuery({
    queryKey: ["resource-documents", resource?.id],
    enabled: !!resource?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("resource_documents").select("*").eq("resource_id", resource.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- Local status state (avoids stale prop) ----
  const [localStatus, setLocalStatus] = useState(resource.status);

  // ---- Mutations ----
  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("resources").update({ status } as any).eq("id", resource.id);
      if (error) throw error;
    },
    onSuccess: (_data, status) => {
      setLocalStatus(status);
      qc.invalidateQueries({ queryKey: ["resources"] });
      toast.success("Statut mis à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour du statut"),
  });

  const updateType = useMutation({
    mutationFn: async (type: string) => {
      const { error } = await supabase.from("resources").update({ type } as any).eq("id", resource.id);
      if (error) throw error;
    },
    onSuccess: (_data, type) => {
      setLocalType(type);
      qc.invalidateQueries({ queryKey: ["resources"] });
      qc.invalidateQueries({ queryKey: ["fleet-resources"] });
      toast.success("Type mis à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour du type"),
  });

  const [eqForm, setEqForm] = useState<any>(null);
  const [eqEditing, setEqEditing] = useState(false);

  const saveEquipment = useMutation({
    mutationFn: async (payload: any) => {
      if (equipment?.id) {
        const { error } = await supabase.from("resource_equipment").update(payload).eq("id", equipment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("resource_equipment").insert({ ...payload, resource_id: resource.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { refetchEquipment(); setEqEditing(false); toast.success("Fiche technique mise à jour"); },
  });

  const [pForm, setPForm] = useState<any>(null);
  const [pEditing, setPEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(isEquipment ? "technique" : "rh");

  const savePersonnel = useMutation({
    mutationFn: async (payload: any) => {
      if (personnel?.id) {
        const { error } = await supabase.from("resource_personnel").update(payload).eq("id", personnel.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("resource_personnel").insert({ ...payload, resource_id: resource.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { refetchPersonnel(); setPEditing(false); toast.success("Fiche RH mise à jour"); },
  });

  const addIntervention = useMutation({
    mutationFn: async () => {
      if (!newIntervention.title.trim()) throw new Error("Titre requis");
      const { error } = await supabase.from("resource_interventions").insert({
        resource_id: resource.id,
        type: newIntervention.type,
        title: newIntervention.title.trim(),
        description: newIntervention.description || null,
        status: newIntervention.status,
        priority: newIntervention.priority,
        scheduled_date: newIntervention.scheduled_date || null,
        completed_date: newIntervention.completed_date || null,
        next_due_date: newIntervention.next_due_date || null,
        cost: newIntervention.cost ? parseFloat(newIntervention.cost) : 0,
        provider: newIntervention.provider || null,
        reference: newIntervention.reference || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resource-interventions", resource?.id] });
      setNewIntervention({ type: isPersonnel ? "formation" : "entretien", title: "", description: "", status: "planifie", priority: "normale", scheduled_date: "", completed_date: "", next_due_date: "", cost: "", provider: "", reference: "" });
      setShowAddIntervention(false);
      toast.success("Intervention ajoutée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteIntervention = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resource_interventions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["resource-interventions", resource?.id] }); toast.success("Supprimé"); },
  });

  const updateInterventionStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const payload: any = { status };
      if (status === "termine") payload.completed_date = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("resource_interventions").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["resource-interventions", resource?.id] }); },
  });

  const deleteDocument = useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      await supabase.storage.from("resource-documents").remove([storagePath]);
      const { error } = await supabase.from("resource_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetchDocs(); toast.success("Document supprimé"); },
  });

  if (!resource) return null;

  // Alerts
  const alerts: string[] = [];
  if (equipment) {
    const vgpDays = getDaysUntil(equipment.vgp_expiry);
    const ctDays = getDaysUntil(equipment.technical_control_expiry);
    const insDays = getDaysUntil(equipment.insurance_expiry);
    const maintDays = getDaysUntil(equipment.next_maintenance_date);
    if (vgpDays !== null && vgpDays < 30) alerts.push(`VGP expire ${vgpDays < 0 ? `il y a ${Math.abs(vgpDays)}j` : `dans ${vgpDays}j`}`);
    if (ctDays !== null && ctDays < 30) alerts.push(`CT expire ${ctDays < 0 ? `il y a ${Math.abs(ctDays)}j` : `dans ${ctDays}j`}`);
    if (insDays !== null && insDays < 30) alerts.push(`Assurance expire ${insDays < 0 ? `il y a ${Math.abs(insDays)}j` : `dans ${insDays}j`}`);
    if (maintDays !== null && maintDays < 14) alerts.push(`Maintenance ${maintDays < 0 ? "en retard" : `dans ${maintDays}j`}`);
  }
  if (personnel) {
    const medDays = getDaysUntil((personnel as any).next_medical_visit);
    if (medDays !== null && medDays < 30) alerts.push(`Visite médicale ${medDays < 0 ? "en retard" : `dans ${medDays}j`}`);
    const idDays = getDaysUntil((personnel as any).id_expiry);
    if (idDays !== null && idDays < 60) alerts.push(`Pièce d'identité ${idDays < 0 ? "expirée" : `expire dans ${idDays}j`}`);
  }

  const upcomingInterventions = interventions.filter((i: any) => i.status === "planifie" || i.status === "en_cours");
  const pastInterventions = interventions.filter((i: any) => i.status === "termine" || i.status === "annule");
  const totalCost = interventions.reduce((s: number, i: any) => s + (i.cost || 0), 0);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-muted/30">
          <SheetHeader>
            <div className="flex items-start gap-4">
              {/* Avatar / Photo */}
              {isPersonnel ? (
                <PersonnelAvatar personnel={personnel} resourceId={resource.id} onRefresh={refetchPersonnel} />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-xl">{resource.name}</SheetTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Select value={localType} onValueChange={(v) => updateType.mutate(v)}>
                    <SelectTrigger className="h-7 w-auto text-xs border rounded-full px-2.5 gap-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employe">Employé</SelectItem>
                      <SelectItem value="grue">Grue</SelectItem>
                      <SelectItem value="vehicule">Véhicule</SelectItem>
                      <SelectItem value="equipement">Équipement</SelectItem>
                      <SelectItem value="equipe">Équipe</SelectItem>
                    </SelectContent>
                  </Select>
                  {resource.companyIds?.map((cid: string) => {
                    const c = companies.find((x: any) => x.id === cid);
                    return c ? <span key={cid} className="text-xs bg-muted px-2 py-0.5 rounded">{c.shortName}</span> : null;
                  })}
                </div>
                {/* Quick contact info */}
                {isPersonnel && (personnel as any)?.phone && (
                  <div className="flex items-center gap-3 mt-1">
                    <a href={`tel:${(personnel as any).phone}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                      <Phone className="h-3 w-3" />{(personnel as any).phone}
                    </a>
                    {(personnel as any)?.email && (
                      <a href={`mailto:${(personnel as any).email}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                        <Mail className="h-3 w-3" />{(personnel as any).email}
                      </a>
                    )}
                  </div>
                )}
              </div>
              <Select value={localStatus} onValueChange={(v) => updateStatus.mutate(v)}>
                <SelectTrigger className={`w-auto h-8 text-xs border rounded-full px-3 ${STATUS_COLORS[localStatus] ?? ""}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(STATUS_OPTIONS[resource.type] ?? STATUS_OPTIONS.default).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SheetHeader>

          {alerts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs bg-destructive/10 text-destructive rounded-md px-2 py-1">
                  <AlertTriangle className="h-3 w-3" />{a}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0">
          <TabsList className="w-full rounded-none border-b h-auto p-0 bg-transparent justify-start gap-0 overflow-x-auto">
            {isEquipment && (
              <TabsTrigger value="technique" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm whitespace-nowrap">
                <Settings className="h-4 w-4 mr-2" />Technique
              </TabsTrigger>
            )}
            {isEquipment && (
              <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm whitespace-nowrap">
                <FileText className="h-4 w-4 mr-2" />Photos & Docs
                {(documents as any[]).length > 0 && (
                  <span className="ml-1.5 bg-muted text-muted-foreground text-[10px] rounded-full px-1.5 py-0.5">{(documents as any[]).length}</span>
                )}
              </TabsTrigger>
            )}
            {isPersonnel && (
              <>
                <TabsTrigger value="rh" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm whitespace-nowrap">
                  <User className="h-4 w-4 mr-2" />Fiche RH
                </TabsTrigger>
                <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm whitespace-nowrap">
                  <FileText className="h-4 w-4 mr-2" />Documents
                  {(documents as any[]).length > 0 && (
                    <span className="ml-1.5 bg-muted text-muted-foreground text-[10px] rounded-full px-1.5 py-0.5">{(documents as any[]).length}</span>
                  )}
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="interventions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm whitespace-nowrap">
              <Activity className="h-4 w-4 mr-2" />
              {isPersonnel ? "Formations" : "VGP & Entretiens"}
              {upcomingInterventions.length > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 py-0.5">{upcomingInterventions.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="historique" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm whitespace-nowrap">
              <Clock className="h-4 w-4 mr-2" />Historique
            </TabsTrigger>
            {isEquipment && (
              <TabsTrigger value="depenses" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm whitespace-nowrap">
                <Receipt className="h-4 w-4 mr-2" />Dépenses
              </TabsTrigger>
            )}
            {isEquipment && (
              <TabsTrigger value="3d" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm whitespace-nowrap">
                <Eye className="h-4 w-4 mr-2" />3D
              </TabsTrigger>
            )}
          </TabsList>

          {/* ===== TECHNIQUE ===== */}
          {isEquipment && (
            <TabsContent value="technique" className="p-4 pb-8 space-y-4">
              {/* AI Crane Lookup — only for grue type */}
              {localType === "grue" && (
                <CraneLookup
                  currentBrand={equipment?.brand ?? ""}
                  currentModel={equipment?.model ?? ""}
                  resourceId={resource.id}
                  companyId={resource.companyIds?.[0] ?? ""}
                  onSpecsFetched={(data) => {
                    setEqForm((prev: any) => ({ ...(equipment ?? {}), ...(prev ?? {}), ...data }));
                    setEqEditing(true);
                    toast.success("Données pré-remplies — vérifiez et enregistrez ✨");
                  }}
                  onDocumentSaved={() => {
                    qc.invalidateQueries({ queryKey: ["resource-documents", resource.id] });
                  }}
                />
              )}

              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Fiche technique</h3>
                <Button size="sm" variant="outline" onClick={() => { setEqForm(equipment ?? {}); setEqEditing(true); }}>
                  Modifier
                </Button>
              </div>
              {eqEditing ? (
                <EquipmentForm form={eqForm ?? {}} onChange={setEqForm} onSave={() => saveEquipment.mutate(eqForm)} onCancel={() => setEqEditing(false)} isPending={saveEquipment.isPending} />
              ) : (
                <div className="space-y-4">
                  <Section title="Identification" icon={<Truck className="h-4 w-4" />}>
                    <InfoGrid items={[
                      { label: "Immatriculation", value: equipment?.registration },
                      { label: "N° de série", value: equipment?.serial_number },
                      { label: "Marque", value: equipment?.brand },
                      { label: "Modèle", value: equipment?.model },
                      { label: "Année", value: equipment?.year_manufacture?.toString() },
                    ]} />
                  </Section>
                  <Section title="Caractéristiques" icon={<Zap className="h-4 w-4" />}>
                    <InfoGrid items={[
                      { label: "Capacité", value: equipment?.capacity_tons ? `${equipment.capacity_tons} T` : null },
                      { label: "Portée", value: equipment?.reach_meters ? `${equipment.reach_meters} m` : null },
                      { label: "Hauteur", value: equipment?.height_meters ? `${equipment.height_meters} m` : null },
                      { label: "Poids", value: equipment?.weight_tons ? `${equipment.weight_tons} T` : null },
                      { label: "Kilométrage", value: equipment?.current_km ? `${equipment.current_km.toLocaleString()} km` : null },
                      { label: "Tarif/jour", value: equipment?.daily_rate ? `${equipment.daily_rate} €` : null },
                    ]} />
                  </Section>
                  <Section title="Réglementaire & Échéances" icon={<ShieldCheck className="h-4 w-4" />}>
                    <div className="space-y-2">
                      <AlertBadge days={getDaysUntil(equipment?.vgp_expiry)} label="VGP" />
                      <AlertBadge days={getDaysUntil(equipment?.technical_control_expiry)} label="CT" />
                      <AlertBadge days={getDaysUntil(equipment?.insurance_expiry)} label="Assurance" />
                      <AlertBadge days={getDaysUntil(equipment?.next_maintenance_date)} label="Maintenance" />
                    </div>
                    <InfoGrid items={[
                      { label: "VGP expiration", value: equipment?.vgp_expiry ? format(new Date(equipment.vgp_expiry), "dd/MM/yyyy") : null },
                      { label: "Fréquence VGP", value: equipment?.vgp_frequency_months ? `Tous les ${equipment.vgp_frequency_months} mois` : null },
                      { label: "Contrôle technique", value: equipment?.technical_control_expiry ? format(new Date(equipment.technical_control_expiry), "dd/MM/yyyy") : null },
                      { label: "Assurance", value: equipment?.insurance_expiry ? format(new Date(equipment.insurance_expiry), "dd/MM/yyyy") : null },
                      { label: "Police assurance", value: equipment?.insurance_policy },
                      { label: "Prochain entretien", value: equipment?.next_maintenance_date ? format(new Date(equipment.next_maintenance_date), "dd/MM/yyyy") : null },
                    ]} />
                  </Section>
                  {!equipment && (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <Settings className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Aucune fiche technique</p>
                      <Button size="sm" className="mt-2" onClick={() => { setEqForm({}); setEqEditing(true); }}>Créer la fiche</Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          )}

          {/* ===== PHOTOS & DOCS ÉQUIPEMENT ===== */}
          {isEquipment && (
            <TabsContent value="documents" className="p-4 pb-8">
              <EquipmentPhotosDocsTab
                resourceId={resource.id}
                companyId={resource.companyIds?.[0] ?? ""}
                documents={documents as any[]}
                onRefresh={() => qc.invalidateQueries({ queryKey: ["resource-documents", resource.id] })}
                onDeleteDoc={async (id: string, path: string) => {
                  await supabase.storage.from("resource-documents").remove([path]);
                  await supabase.from("resource_documents").delete().eq("id", id);
                  qc.invalidateQueries({ queryKey: ["resource-documents", resource.id] });
                  toast.success("Document supprimé");
                }}
                onAiExtracted={(data: any) => {
                  setEqForm((prev: any) => ({ ...(equipment ?? {}), ...(prev ?? {}), ...data }));
                  setEqEditing(true);
                  setActiveTab("technique");
                  toast.success("Fiche technique pré-remplie par l'IA ✨");
                }}
              />
            </TabsContent>
          )}

          {/* ===== FICHE RH ===== */}
          {isPersonnel && (
            <TabsContent value="rh" className="p-4 pb-8 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Fiche employé</h3>
                <Button size="sm" variant="outline" onClick={() => { setPForm(personnel ?? {}); setPEditing(true); }}>
                  Modifier
                </Button>
              </div>
              {pEditing ? (
                <PersonnelForm form={pForm ?? {}} onChange={setPForm} onSave={() => savePersonnel.mutate(pForm)} onCancel={() => setPEditing(false)} isPending={savePersonnel.isPending} />
              ) : (
                <div className="space-y-4">
                  <Section title="Contact & Coordonnées" icon={<Phone className="h-4 w-4" />}>
                    <InfoGrid items={[
                      { label: "Téléphone", value: (personnel as any)?.phone },
                      { label: "Email", value: (personnel as any)?.email },
                      { label: "Adresse", value: (personnel as any)?.address },
                    ]} />
                  </Section>

                  <Section title="Informations professionnelles" icon={<User className="h-4 w-4" />}>
                    <InfoGrid items={[
                      { label: "Poste", value: personnel?.job_title },
                      { label: "Matricule", value: personnel?.employee_id },
                      { label: "Contrat", value: personnel?.contract_type },
                      { label: "Entrée", value: personnel?.hire_date ? format(new Date(personnel.hire_date), "dd/MM/yyyy") : null },
                    ]} />
                  </Section>

                  <Section title="Pièce d'identité" icon={<IdCard className="h-4 w-4" />}>
                    <AlertBadge days={getDaysUntil((personnel as any)?.id_expiry)} label="Pièce d'identité" />
                    <InfoGrid items={[
                      { label: "Date de naissance", value: (personnel as any)?.birth_date ? format(new Date((personnel as any).birth_date), "dd/MM/yyyy") : null },
                      { label: "Nationalité", value: (personnel as any)?.nationality },
                      { label: "N° document", value: (personnel as any)?.id_number },
                      { label: "Expiration", value: (personnel as any)?.id_expiry ? format(new Date((personnel as any).id_expiry), "dd/MM/yyyy") : null },
                      { label: "N° sécurité sociale", value: (personnel as any)?.social_security },
                    ]} />
                  </Section>

                  <Section title="Habilitations & CACES" icon={<ShieldCheck className="h-4 w-4" />}>
                    {personnel?.caces?.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {personnel.caces.map((c: string) => (
                          <span key={c} className="bg-primary/10 text-primary text-xs rounded px-2 py-0.5 font-medium">CACES {c}</span>
                        ))}
                      </div>
                    ) : <p className="text-xs text-muted-foreground">Aucun CACES enregistré</p>}
                    {personnel?.habilitations_elec?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {personnel.habilitations_elec.map((h: string) => (
                          <span key={h} className="bg-warning/10 text-warning text-xs rounded px-2 py-0.5 font-medium">{h}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-3 mt-2">
                      {personnel?.aipr && <span className="bg-primary/10 text-primary text-xs rounded px-2 py-0.5">AIPR</span>}
                      {personnel?.sst && <span className="bg-success/10 text-success text-xs rounded px-2 py-0.5">SST</span>}
                    </div>
                  </Section>

                  <Section title="Suivi médical" icon={<Heart className="h-4 w-4" />}>
                    <AlertBadge days={getDaysUntil(personnel?.next_medical_visit)} label="Visite médicale" />
                    <InfoGrid items={[
                      { label: "Aptitude", value: personnel?.medical_aptitude },
                      { label: "Dernière visite", value: personnel?.last_medical_visit ? format(new Date(personnel.last_medical_visit), "dd/MM/yyyy") : null },
                      { label: "Prochaine visite", value: personnel?.next_medical_visit ? format(new Date(personnel.next_medical_visit), "dd/MM/yyyy") : null },
                    ]} />
                  </Section>

                  <Section title="Contact d'urgence" icon={<Phone className="h-4 w-4" />}>
                    <InfoGrid items={[
                      { label: "Contact", value: personnel?.emergency_contact },
                      { label: "Téléphone", value: personnel?.emergency_phone },
                    ]} />
                  </Section>

                  {!personnel && (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Aucune fiche RH</p>
                      <Button size="sm" className="mt-2" onClick={() => { setPForm({}); setPEditing(true); }}>Créer la fiche</Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          )}

          {/* ===== DOCUMENTS ===== */}
          {isPersonnel && (
            <TabsContent value="documents" className="p-4 space-y-4">
              <DocumentsTab
                resourceId={resource.id}
                companyId={resource.companyIds?.[0]}
                documents={documents as any[]}
                onRefresh={refetchDocs}
                onDeleteDoc={(id, path) => deleteDocument.mutate({ id, storagePath: path })}
                onAiExtracted={(data) => {
                  // Apply AI extracted data to personnel form and switch to RH tab
                  const merged = { ...(personnel ?? {}), ...data };
                  setPForm(merged);
                  setPEditing(true);
                  setActiveTab("rh");
                  toast.success("✅ Données extraites par l'IA ! Vérifiez et enregistrez.", { duration: 6000 });
                }}
              />
            </TabsContent>
          )}

          {/* ===== INTERVENTIONS ===== */}
          <TabsContent value="interventions" className="p-4 pb-8 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">{upcomingInterventions.length} à venir</h3>
              <Button size="sm" onClick={() => setShowAddIntervention(!showAddIntervention)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Ajouter
              </Button>
            </div>
            {showAddIntervention && (
              <InterventionForm
                form={newIntervention}
                onChange={setNewIntervention}
                isPersonnel={isPersonnel}
                onSave={() => addIntervention.mutate()}
                onCancel={() => setShowAddIntervention(false)}
                isPending={addIntervention.isPending}
              />
            )}
            {upcomingInterventions.length === 0 && !showAddIntervention && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                Aucune intervention planifiée
              </div>
            )}
            <div className="space-y-2">
              {upcomingInterventions.map((item: any) => (
                <InterventionCard key={item.id} item={item} onDelete={(id) => deleteIntervention.mutate(id)} onStatusChange={(id, s) => updateInterventionStatus.mutate({ id, status: s })} />
              ))}
            </div>
          </TabsContent>

          {/* ===== HISTORIQUE ===== */}
          <TabsContent value="historique" className="p-4 pb-8 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">{pastInterventions.length} interventions passées</h3>
              {totalCost > 0 && <span className="text-sm font-medium">Total : {totalCost.toLocaleString()} €</span>}
            </div>
            {pastInterventions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />Aucun historique
              </div>
            ) : (
              <div className="space-y-2">
                {pastInterventions.map((item: any) => (
                  <InterventionCard key={item.id} item={item} onDelete={(id) => deleteIntervention.mutate(id)} onStatusChange={(id, s) => updateInterventionStatus.mutate({ id, status: s })} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== DÉPENSES VÉHICULE ===== */}
          {isEquipment && (
            <TabsContent value="depenses" className="p-4 pb-8 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Dépenses véhicule</h3>
                <VehicleExpenseDialog
                  resourceId={resource.id}
                  companyId={resource.companyIds?.[0] || companies[0]?.id}
                />
              </div>
              <ResourceExpensesList resourceId={resource.id} companyIds={resource.companyIds || companies.map((c: any) => c.id)} />
            </TabsContent>
           )}

          {/* ===== MODÈLE 3D ===== */}
          {isEquipment && (
            <TabsContent value="3d" className="p-4 pb-8 space-y-4">
              <Custom3DTab
                resourceId={resource.id}
                resourceName={resource.name}
                companyId={resource.companyIds?.[0] ?? ""}
                documents={documents as any[]}
                onRefresh={() => qc.invalidateQueries({ queryKey: ["resource-documents", resource.id] })}
              />
            </TabsContent>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// ===== Custom 3D Tab with upload =====
function Custom3DTab({ resourceId, resourceName, companyId, documents, onRefresh }: { resourceId: string; resourceName: string; companyId: string; documents: any[]; onRefresh: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [customModelUrl, setCustomModelUrl] = useState<string | null>(null);

  const hasBuiltinModel = !!getModelPath(resourceName);
  const customDoc = documents.find((d: any) => d.document_type === "model_3d");

  // Load custom model blob URL
  useEffect(() => {
    if (!customDoc) { setCustomModelUrl(null); return; }
    let objectUrl: string;
    supabase.storage.from("resource-documents").download(customDoc.storage_path).then(({ data }) => {
      if (data) { objectUrl = URL.createObjectURL(data); setCustomModelUrl(objectUrl); }
    });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [customDoc?.id]);

  const uploadModel = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "glb";
      const path = `models/${resourceId}.${ext}`;
      const { error: upErr } = await supabase.storage.from("resource-documents").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      // Remove old record if exists
      if (customDoc) {
        await supabase.from("resource_documents").delete().eq("id", customDoc.id);
      }
      await supabase.from("resource_documents").insert({
        resource_id: resourceId,
        company_id: companyId,
        document_type: "model_3d",
        name: file.name,
        file_name: file.name,
        storage_path: path,
      });
      onRefresh();
      toast.success("Modèle 3D importé");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteModel = async () => {
    if (!customDoc) return;
    await supabase.storage.from("resource-documents").remove([customDoc.storage_path]);
    await supabase.from("resource_documents").delete().eq("id", customDoc.id);
    onRefresh();
    toast.success("Modèle supprimé");
  };

  const showBuiltin = hasBuiltinModel && !customModelUrl;
  const showCustom = !!customModelUrl;

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Modèle 3D</h3>
        <div className="flex items-center gap-2">
          {hasBuiltinModel && <ARButton resourceName={resourceName} />}
          <input ref={fileRef} type="file" accept=".glb,.gltf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadModel(f); e.target.value = ""; }} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            Importer .glb
          </Button>
          {customDoc && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={deleteModel}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {showBuiltin && <Model3DViewer resourceName={resourceName} className="h-[400px]" />}

      {showCustom && (
        <div className="rounded-xl border bg-card overflow-hidden relative h-[400px]">
          <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-muted/50"><div className="text-sm text-muted-foreground animate-pulse">Chargement du modèle 3D…</div></div>}>
            <Canvas camera={{ position: [8, 5, 8], fov: 45 }} style={{ width: "100%", height: "100%" }}>
              <OrbitControls enablePan enableZoom enableRotate maxPolarAngle={Math.PI / 2} minDistance={2} maxDistance={50} />
              <CustomModelScene url={customModelUrl!} />
            </Canvas>
          </Suspense>
          <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[10px] text-muted-foreground border">
            🖱️ Tourner · Molette: zoom
          </div>
        </div>
      )}

      {!showBuiltin && !showCustom && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-3">
          <Eye className="h-10 w-10 opacity-20" />
          <p>Aucun modèle 3D disponible</p>
          <p className="text-xs">Importez un fichier .glb pour visualiser cet engin en 3D</p>
        </div>
      )}
    </>
  );
}

function CustomModelScene({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <Stage environment="city" intensity={0.5} adjustCamera>
      <Center>
        <primitive object={scene} />
      </Center>
    </Stage>
  );
}

// ===== Personnel Avatar with photo upload =====
function PersonnelAvatar({ personnel, resourceId, onRefresh }: { personnel: any; resourceId: string; onRefresh: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${resourceId}.${ext}`;
      const { error: upErr } = await supabase.storage.from("resource-documents").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("resource-documents").getPublicUrl(path);
      // Store in personnel photo_url
      if (personnel?.id) {
        await supabase.from("resource_personnel").update({ photo_url: urlData.publicUrl } as any).eq("id", personnel.id);
      } else {
        await supabase.from("resource_personnel").insert({ resource_id: resourceId, photo_url: urlData.publicUrl } as any);
      }
      onRefresh();
      toast.success("Photo mise à jour");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const photoUrl = (personnel as any)?.photo_url;

  return (
    <div className="relative group flex-shrink-0">
      <div
        className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden cursor-pointer border-2 border-transparent group-hover:border-primary transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {photoUrl ? (
          <img src={photoUrl} alt="Photo" className="h-full w-full object-cover" />
        ) : (
          <HardHat className="h-7 w-7 text-muted-foreground" />
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
            <Loader2 className="h-4 w-4 text-white animate-spin" />
          </div>
        )}
      </div>
      <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => fileRef.current?.click()}>
        <Camera className="h-3 w-3 text-primary-foreground" />
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadPhoto(e.target.files[0]); }} />
    </div>
  );
}

// ===== Documents Tab =====
function DocumentsTab({ resourceId, companyId, documents, onRefresh, onDeleteDoc, onAiExtracted }: {
  resourceId: string;
  companyId: string;
  documents: any[];
  onRefresh: () => void;
  onDeleteDoc: (id: string, path: string) => void;
  onAiExtracted: (data: any) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [newDocType, setNewDocType] = useState("identite");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPendingFile(f);
  };

  const uploadDocument = async (withAI: boolean) => {
    if (!pendingFile) return;
    setUploading(true);
    if (withAI) setAnalyzing(true);

    try {
      const ext = pendingFile.name.split(".").pop();
      const path = `docs/${resourceId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("resource-documents").upload(path, pendingFile);
      if (upErr) throw upErr;

      // Save document record
      const { data: docData, error: docErr } = await supabase.from("resource_documents").insert({
        resource_id: resourceId,
        company_id: companyId,
        document_type: newDocType,
        name: `${DOC_TYPES[newDocType]?.label ?? "Document"} — ${pendingFile.name}`,
        storage_path: path,
        file_name: pendingFile.name,
        mime_type: pendingFile.type,
        ai_extracted: withAI,
      } as any).select().single();

      if (docErr) throw docErr;

      // IA analysis if requested
      if (withAI && (pendingFile.type.startsWith("image/") || pendingFile.type === "application/pdf")) {
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = (ev) => {
              const result = ev.target?.result as string;
              resolve(result.split(",")[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(pendingFile);
          });

          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-hr-document`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ imageBase64: base64, mimeType: pendingFile.type, documentType: newDocType }),
          });

          const json = await res.json();
          if (res.ok && json.data) {
            // Map AI fields to personnel fields
            const aiData: any = {};
            const d = json.data;
            if (d.birth_date) aiData.birth_date = d.birth_date;
            if (d.nationality) aiData.nationality = d.nationality;
            if (d.id_number) aiData.id_number = d.id_number;
            if (d.id_expiry) aiData.id_expiry = d.id_expiry;
            if (d.address) aiData.address = d.address;
            if (d.job_title) aiData.job_title = d.job_title;
            if (d.hire_date) aiData.hire_date = d.hire_date;
            if (d.contract_type) aiData.contract_type = d.contract_type;
            if (d.employee_id) aiData.employee_id = d.employee_id;
            if (d.caces?.length > 0) aiData.caces = d.caces;
            if (d.medical_aptitude) aiData.medical_aptitude = d.medical_aptitude;
            if (d.last_medical_visit) aiData.last_medical_visit = d.last_medical_visit;
            if (d.next_medical_visit) aiData.next_medical_visit = d.next_medical_visit;

            // Update document expiry if found
            if (d.document_expires_at && docData?.id) {
              await supabase.from("resource_documents").update({ expires_at: d.document_expires_at, name: d.document_name ?? docData.name } as any).eq("id", docData.id);
            }

            onAiExtracted(aiData);
          } else if (!res.ok) {
            toast.error(json.error ?? "Erreur lors de l'analyse IA");
          }
        } catch (aiErr: any) {
          console.error("AI analysis error:", aiErr);
          toast.warning("Document importé, mais l'analyse IA a échoué.");
        }
      }

      onRefresh();
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success(withAI ? "Document importé et analysé !" : "Document importé");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Upload className="h-4 w-4 text-primary" />
          Importer un document
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select value={newDocType} onValueChange={setNewDocType}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DOC_TYPES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="h-3.5 w-3.5 mr-1" />Choisir un fichier
          </Button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf,.doc,.docx" className="hidden" onChange={handleFileSelect} />
        </div>

        {pendingFile && (
          <div className="rounded-md bg-background border p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate font-medium">{pendingFile.name}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPendingFile(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => uploadDocument(true)}
                disabled={uploading}
              >
                {analyzing ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analyse IA...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Importer + Analyser avec l'IA</>
                )}
              </Button>
              <Button size="sm" variant="outline" onClick={() => uploadDocument(false)} disabled={uploading}>
                {uploading && !analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Importer"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              L'IA analysera le document et pré-remplira automatiquement les champs de la fiche RH.
            </p>
          </div>
        )}
      </div>

      {/* Documents list */}
      {documents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p>Aucun document importé</p>
          <p className="text-xs mt-1">Importez pièces d'identité, contrats, diplômes, certificats médicaux...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc: any) => (
            <DocumentCard key={doc.id} doc={doc} onDelete={() => onDeleteDoc(doc.id, doc.storage_path)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Equipment Photos & Documents Tab =====

function EquipmentPhotosDocsTab({ resourceId, companyId, documents, onRefresh, onDeleteDoc, onAiExtracted }: {
  resourceId: string;
  companyId: string;
  documents: any[];
  onRefresh: () => void;
  onDeleteDoc: (id: string, path: string) => void;
  onAiExtracted: (data: any) => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [newDocType, setNewDocType] = useState("carte_grise");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Separate photos from docs
  const photos = documents.filter((d) => d.document_type === "photo" && (d.mime_type?.startsWith("image/") || d.file_name?.match(/\.(jpg|jpeg|png|webp|gif)$/i)));
  const docs = documents.filter((d) => d.document_type !== "photo");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPendingFile(f);
  };

  // Upload a photo (direct, no AI)
  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `photos/${resourceId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("resource-documents").upload(path, file);
      if (upErr) throw upErr;
      const { error: docErr } = await supabase.from("resource_documents").insert({
        resource_id: resourceId,
        company_id: companyId,
        document_type: "photo",
        name: file.name,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
      } as any);
      if (docErr) throw docErr;
      onRefresh();
      qc.invalidateQueries({ queryKey: ["fleet-photos-map"] });
      toast.success("Photo ajoutée");
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); if (photoRef.current) photoRef.current.value = ""; }
  };

  const uploadDocument = async (withAI: boolean) => {
    if (!pendingFile) return;
    setUploading(true);
    if (withAI) setAnalyzing(true);
    try {
      const ext = pendingFile.name.split(".").pop();
      const path = `docs/${resourceId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("resource-documents").upload(path, pendingFile);
      if (upErr) throw upErr;
      const { data: docData, error: docErr } = await supabase.from("resource_documents").insert({
        resource_id: resourceId,
        company_id: companyId,
        document_type: newDocType,
        name: `${EQUIP_DOC_TYPES[newDocType]?.label ?? "Document"} — ${pendingFile.name}`,
        storage_path: path,
        file_name: pendingFile.name,
        mime_type: pendingFile.type,
        ai_extracted: withAI,
      } as any).select().single();
      if (docErr) throw docErr;

      if (withAI && newDocType !== "photo" && (pendingFile.type.startsWith("image/") || pendingFile.type === "application/pdf")) {
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = (ev) => { resolve((ev.target?.result as string).split(",")[1]); };
            reader.onerror = reject;
            reader.readAsDataURL(pendingFile);
          });
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-equipment-document`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
            body: JSON.stringify({ imageBase64: base64, mimeType: pendingFile.type, documentType: newDocType }),
          });
          const json = await res.json();
          if (res.ok && json.data) {
            const d = json.data;
            const mapped: any = {};
            if (d.registration) mapped.registration = d.registration;
            if (d.brand) mapped.brand = d.brand;
            if (d.model) mapped.model = d.model;
            if (d.serial_number) mapped.serial_number = d.serial_number;
            if (d.year_manufacture) mapped.year_manufacture = d.year_manufacture;
            if (d.capacity_tons) mapped.capacity_tons = d.capacity_tons;
            if (d.reach_meters) mapped.reach_meters = d.reach_meters;
            if (d.height_meters) mapped.height_meters = d.height_meters;
            if (d.weight_tons) mapped.weight_tons = d.weight_tons;
            if (d.insurance_expiry) mapped.insurance_expiry = d.insurance_expiry;
            if (d.insurance_policy) mapped.insurance_policy = d.insurance_policy;
            if (d.technical_control_expiry) mapped.technical_control_expiry = d.technical_control_expiry;
            if (d.vgp_expiry) mapped.vgp_expiry = d.vgp_expiry;
            if (d.vgp_frequency_months) mapped.vgp_frequency_months = d.vgp_frequency_months;
            if (d.next_maintenance_date) mapped.next_maintenance_date = d.next_maintenance_date;
            if (d.document_expires_at && docData?.id) {
              await supabase.from("resource_documents").update({ expires_at: d.document_expires_at, name: d.document_name ?? (docData as any).name } as any).eq("id", docData.id);
            }
            onAiExtracted(mapped);
          } else if (!res.ok) {
            toast.error(json.error ?? "Erreur lors de l'analyse IA");
          }
        } catch (aiErr: any) {
          console.error("AI error:", aiErr);
          toast.warning("Document importé, analyse IA échouée.");
        }
      }
      onRefresh();
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success(withAI ? "Document importé et analysé !" : "Document importé");
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); setAnalyzing(false); }
  };

  return (
    <div className="space-y-5">
      {/* === PHOTO GALLERY === */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Camera className="h-4 w-4" />Photos de l'engin</h3>
          <Button size="sm" variant="outline" onClick={() => photoRef.current?.click()} disabled={uploading}>
            <Plus className="h-3.5 w-3.5 mr-1" />Ajouter une photo
          </Button>
          <input ref={photoRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { Array.from(e.target.files ?? []).forEach(uploadPhoto); }} />
        </div>
        {photos.length === 0 ? (
          <div
            onClick={() => photoRef.current?.click()}
            className="rounded-lg border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center py-8 gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <Camera className="h-8 w-8 opacity-30" />
            <p className="text-xs text-muted-foreground">Cliquez pour ajouter des photos</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p: any) => (
              <EquipmentPhotoThumb key={p.id} photo={p} onDelete={() => onDeleteDoc(p.id, p.storage_path)} onView={setLightboxUrl} />
            ))}
            <div
              onClick={() => photoRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-border bg-muted/30 flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Plus className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* === DOCUMENTS === */}
      <div>
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><FileText className="h-4 w-4" />Documents techniques</h3>
        {/* Upload zone */}
        <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-4 space-y-3 mb-3">
          <div className="flex gap-2 flex-wrap">
            <Select value={newDocType} onValueChange={setNewDocType}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EQUIP_DOC_TYPES).filter(([k]) => k !== "photo").map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="h-3.5 w-3.5 mr-1" />Choisir
            </Button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf,.doc,.docx" className="hidden" onChange={handleFileSelect} />
          </div>
          {pendingFile && (
            <div className="rounded-md bg-background border p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate font-medium">{pendingFile.name}</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPendingFile(null)}><X className="h-3 w-3" /></Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => uploadDocument(true)} disabled={uploading}>
                  {analyzing ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analyse IA...</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Importer + Analyser IA</>}
                </Button>
                <Button size="sm" variant="outline" onClick={() => uploadDocument(false)} disabled={uploading}>
                  {uploading && !analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Importer"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">L'IA extraira immatriculation, dates d'échéance, caractéristiques et pré-remplira la fiche technique.</p>
            </div>
          )}
        </div>
        {docs.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p>Aucun document</p>
            <p className="text-xs mt-1">Carte grise, VGP, assurance, abaques...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc: any) => (
              <EquipmentDocCard key={doc.id} doc={doc} onDelete={() => onDeleteDoc(doc.id, doc.storage_path)} />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col">
          <div className="flex items-center justify-end p-3 shrink-0">
            <Button size="icon" variant="ghost" className="text-white" onClick={() => setLightboxUrl(null)}><X className="h-5 w-5" /></Button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-4">
            <img src={lightboxUrl} alt="Aperçu" className="max-w-full max-h-full object-contain rounded shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}

// Photo thumbnail for equipment
function EquipmentPhotoThumb({ photo, onDelete, onView }: { photo: any; onDelete: () => void; onView: (url: string) => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let url: string;
    supabase.storage.from("resource-documents").download(photo.storage_path).then(({ data }) => {
      if (data) { url = URL.createObjectURL(data); setBlobUrl(url); }
      setLoading(false);
    });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [photo.storage_path]);

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden border bg-muted group cursor-pointer" onClick={() => blobUrl && onView(blobUrl)}>
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : blobUrl ? (
        <img src={blobUrl} alt={photo.name} className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center"><Camera className="h-6 w-6 text-muted-foreground opacity-30" /></div>
      )}
      <button
        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// Document card for equipment
function EquipmentDocCard({ doc, onDelete }: { doc: any; onDelete: () => void }) {
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [blobCache, setBlobCache] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const docType = EQUIP_DOC_TYPES[doc.document_type] ?? EQUIP_DOC_TYPES.autre;
  const expireDays = getDaysUntil(doc.expires_at);
  const isPdf = doc.mime_type === "application/pdf" || doc.file_name?.toLowerCase().endsWith(".pdf");
  const isText = doc.mime_type === "text/plain" || doc.file_name?.toLowerCase().endsWith(".txt");
  const isImage = !isPdf && !isText && (doc.mime_type?.startsWith("image/") || /\.(jpe?g|png|gif|webp|svg)$/i.test(doc.file_name ?? ""));

  const fetchBlob = async () => {
    if (blobCache) return blobCache;
    const { data: blob } = await supabase.storage.from("resource-documents").download(doc.storage_path);
    if (blob) setBlobCache(blob);
    return blob ?? null;
  };

  const viewDoc = async () => {
    setLoading(true);
    try {
      const blob = await fetchBlob();
      if (!blob) { toast.error("Impossible d'ouvrir le document"); return; }
      if (isPdf) { setPdfData(await blob.arrayBuffer()); }
      else if (isText) { setTextContent(await blob.text()); }
      else { setImgUrl(URL.createObjectURL(blob)); }
      setPreviewOpen(true);
    } finally { setLoading(false); }

  const downloadDoc = async () => {
    setLoading(true);
    try {
      const blob = await fetchBlob();
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = doc.file_name ?? doc.name;
      a.click();
    } finally { setLoading(false); }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
      <div className={`flex-shrink-0 h-8 w-8 rounded-md flex items-center justify-center text-xs font-bold ${docType.color}`}>
        {isPdf ? "PDF" : <FileText className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium truncate">{doc.name}</span>
          <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${docType.color}`}>{docType.label}</span>
          {doc.ai_extracted && <span className="flex items-center gap-0.5 text-[10px] text-primary"><Sparkles className="h-2.5 w-2.5" />IA</span>}
        </div>
        {expireDays !== null && expireDays < 60 && (
          <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${expireDays < 0 ? "text-destructive" : "text-warning"}`}>
            <AlertTriangle className="h-2.5 w-2.5" />
            {expireDays < 0 ? `Expiré il y a ${Math.abs(expireDays)}j` : `Expire dans ${expireDays}j`}
          </div>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={viewDoc} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={downloadDoc} disabled={loading}>
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-card border-b shrink-0">
            <span className="text-sm font-medium truncate">{doc.name}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={downloadDoc}><Download className="h-4 w-4 mr-1" />Télécharger</Button>
              <Button size="icon" variant="ghost" onClick={() => { setPreviewOpen(false); setImgUrl(null); setPdfData(null); setTextContent(null); }}><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {isPdf && pdfData ? <PdfCanvasViewer data={pdfData} /> : textContent ? (
              <div className="max-w-4xl mx-auto p-6">
                <pre className="whitespace-pre-wrap text-sm font-mono text-foreground bg-card rounded-lg p-6 shadow-xl border leading-relaxed">{textContent}</pre>
              </div>
            ) : isImage && imgUrl ? (
              <div className="flex items-center justify-center h-full p-4">
                <img src={imgUrl} alt={doc.name} className="max-w-full max-h-full object-contain rounded shadow-xl" />
              </div>
            ) : <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}
          </div>
        </div>
      )}
    </div>
  );
}


function DocumentCard({ doc, onDelete }: { doc: any; onDelete: () => void }) {
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [blobCache, setBlobCache] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const docType = DOC_TYPES[doc.document_type] ?? DOC_TYPES.autre;
  const expireDays = getDaysUntil(doc.expires_at);
  const isPdf = doc.mime_type === "application/pdf" || doc.file_name?.toLowerCase().endsWith(".pdf");
  const isText = doc.mime_type === "text/plain" || doc.file_name?.toLowerCase().endsWith(".txt");

  const fetchBlobCached = async (): Promise<Blob | null> => {
    if (blobCache) return blobCache;
    const { data: blob, error } = await supabase.storage
      .from("resource-documents")
      .download(doc.storage_path);
    if (error || !blob) {
      console.error("Storage download error:", error);
      return null;
    }
    setBlobCache(blob);
    return blob;
  };

  const viewDoc = async () => {
    setLoading(true);
    try {
      const blob = await fetchBlobCached();
      if (!blob) { toast.error("Impossible d'ouvrir le document"); return; }
      if (isPdf) {
        setPdfData(await blob.arrayBuffer());
      } else if (isText) {
        setTextContent(await blob.text());
      } else {
        setImgUrl(URL.createObjectURL(blob));
      }
      setPreviewOpen(true);
    } catch (e) {
      console.error(e);
      toast.error("Impossible d'ouvrir le document");
    } finally {
      setLoading(false);
    }
  };

  const downloadDoc = async () => {
    setLoading(true);
    try {
      const blob = await fetchBlobCached();
      if (!blob) { toast.error("Impossible de télécharger"); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name || doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error(e);
      toast.error("Impossible de télécharger le document");
    } finally {
      setLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    if (imgUrl) { URL.revokeObjectURL(imgUrl); setImgUrl(null); }
    setTextContent(null);
  };

  return (
    <div className="rounded-lg border bg-card p-3 flex items-start gap-3">
      <div className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${docType.color}`}>
        {docType.label}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.name}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
          {doc.file_name && <span className="truncate">{doc.file_name}</span>}
          {doc.expires_at && (
            <span className={expireDays !== null && expireDays < 30 ? "text-destructive font-medium" : ""}>
              Exp. {format(new Date(doc.expires_at), "dd/MM/yyyy")}
            </span>
          )}
          {doc.ai_extracted && (
            <span className="flex items-center gap-0.5 text-primary"><Sparkles className="h-2.5 w-2.5" />IA</span>
          )}
        </div>
        {expireDays !== null && expireDays < 30 && (
          <div className={`text-[10px] mt-1 flex items-center gap-1 ${expireDays < 0 ? "text-destructive" : "text-warning"}`}>
            <AlertTriangle className="h-2.5 w-2.5" />
            {expireDays < 0 ? `Expiré il y a ${Math.abs(expireDays)} jours` : `Expire dans ${expireDays} jours`}
          </div>
        )}
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={viewDoc} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={downloadDoc} disabled={loading}>
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-card border-b shrink-0">
            <span className="text-sm font-medium truncate">{doc.name}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={downloadDoc}>
                <Download className="h-4 w-4 mr-1" /> Télécharger
              </Button>
              <Button size="icon" variant="ghost" onClick={closePreview}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {isPdf && pdfData ? (
              <PdfCanvasViewer data={pdfData} />
            ) : textContent ? (
              <div className="max-w-4xl mx-auto p-6">
                <pre className="whitespace-pre-wrap text-sm font-mono text-foreground bg-card rounded-lg p-6 shadow-xl border leading-relaxed">{textContent}</pre>
              </div>
            ) : imgUrl ? (
              <div className="flex items-center justify-center h-full p-4">
                <img src={imgUrl} alt={doc.name} className="max-w-full max-h-full object-contain rounded shadow-xl" />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Sub-components =====

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}{title}
      </div>
      {children}
    </div>
  );
}

function InfoGrid({ items }: { items: { label: string; value?: string | null }[] }) {
  const filtered = items.filter((i) => i.value);
  if (filtered.length === 0) return <p className="text-xs text-muted-foreground">Aucune information</p>;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
      {filtered.map((item) => (
        <div key={item.label}>
          <dt className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</dt>
          <dd className="text-sm font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function InterventionCard({ item, onDelete, onStatusChange }: { item: any; onDelete: (id: string) => void; onStatusChange: (id: string, s: string) => void }) {
  const meta = INTERVENTION_TYPES[item.type] ?? { label: item.type, color: "bg-muted text-muted-foreground", icon: Settings };
  const Icon = meta.icon;
  const done = item.status === "termine";
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${done ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-2">
        <span className={`text-[10px] rounded px-1.5 py-0.5 border font-medium whitespace-nowrap ${meta.color}`}>
          <Icon className="h-3 w-3 inline mr-1" />{meta.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">{item.title}</p>
          {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
        </div>
        <span className={`text-xs ${PRIORITY_COLORS[item.priority]}`}>●</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {item.scheduled_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(item.scheduled_date), "dd/MM/yyyy")}</span>}
        {item.provider && <span>{item.provider}</span>}
        {item.cost > 0 && <span className="font-medium text-foreground">{item.cost} €</span>}
        {item.reference && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Réf: {item.reference}</span>}
      </div>
      <div className="flex gap-1.5 pt-1 border-t">
        {item.status !== "termine" && (
          <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={() => onStatusChange(item.id, "termine")}>
            <CheckCircle2 className="h-3 w-3 mr-1" />Terminer
          </Button>
        )}
        {item.status === "planifie" && (
          <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={() => onStatusChange(item.id, "en_cours")}>
            <Clock className="h-3 w-3 mr-1" />En cours
          </Button>
        )}
        <Select value={item.status} onValueChange={(v) => onStatusChange(item.id, v)}>
          <SelectTrigger className="h-6 text-[11px] w-auto px-2"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_INTERVENTION).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="h-6 ml-auto text-destructive" onClick={() => onDelete(item.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function InterventionForm({ form, onChange, isPersonnel, onSave, onCancel, isPending }: any) {
  const types = isPersonnel
    ? ["formation", "visite_medicale", "absence", "entretien"]
    : ["vgp", "entretien", "reparation", "controle", "nettoyage"];

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Type *</Label>
          <Select value={form.type} onValueChange={(v) => onChange({ ...form, type: v })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {types.map((t) => <SelectItem key={t} value={t}>{INTERVENTION_TYPES[t]?.label ?? t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Priorité</Label>
          <Select value={form.priority} onValueChange={(v) => onChange({ ...form, priority: v })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="urgente">🔴 Urgente</SelectItem>
              <SelectItem value="haute">🟠 Haute</SelectItem>
              <SelectItem value="normale">🟡 Normale</SelectItem>
              <SelectItem value="basse">🟢 Basse</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Titre *</Label>
        <Input className="h-8" value={form.title} onChange={(e) => onChange({ ...form, title: e.target.value })} placeholder="Ex: Formation grue, Visite médicale..." />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Date prévue</Label><Input type="date" className="h-8" value={form.scheduled_date} onChange={(e) => onChange({ ...form, scheduled_date: e.target.value })} /></div>
        <div><Label className="text-xs">Prochaine échéance</Label><Input type="date" className="h-8" value={form.next_due_date} onChange={(e) => onChange({ ...form, next_due_date: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Prestataire</Label><Input className="h-8" value={form.provider} onChange={(e) => onChange({ ...form, provider: e.target.value })} /></div>
        <div><Label className="text-xs">Coût (€)</Label><Input type="number" className="h-8" value={form.cost} onChange={(e) => onChange({ ...form, cost: e.target.value })} /></div>
      </div>
      <div><Label className="text-xs">Description</Label><Textarea className="min-h-[60px] text-sm" value={form.description} onChange={(e) => onChange({ ...form, description: e.target.value })} /></div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={isPending || !form.title.trim()}>Ajouter</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Annuler</Button>
      </div>
    </div>
  );
}

function EquipmentForm({ form, onChange, onSave, onCancel, isPending }: any) {
  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Immatriculation</Label><Input className="h-8" value={form.registration ?? ""} onChange={(e) => onChange({ ...form, registration: e.target.value })} /></div>
        <div><Label className="text-xs">N° de série</Label><Input className="h-8" value={form.serial_number ?? ""} onChange={(e) => onChange({ ...form, serial_number: e.target.value })} /></div>
        <div><Label className="text-xs">Marque</Label><Input className="h-8" value={form.brand ?? ""} onChange={(e) => onChange({ ...form, brand: e.target.value })} /></div>
        <div><Label className="text-xs">Modèle</Label><Input className="h-8" value={form.model ?? ""} onChange={(e) => onChange({ ...form, model: e.target.value })} /></div>
        <div><Label className="text-xs">Année</Label><Input type="number" className="h-8" value={form.year_manufacture ?? ""} onChange={(e) => onChange({ ...form, year_manufacture: parseInt(e.target.value) || null })} /></div>
        <div><Label className="text-xs">Kilométrage actuel</Label><Input type="number" className="h-8" value={form.current_km ?? ""} onChange={(e) => onChange({ ...form, current_km: parseInt(e.target.value) || null })} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">Capacité (T)</Label><Input type="number" className="h-8" value={form.capacity_tons ?? ""} onChange={(e) => onChange({ ...form, capacity_tons: parseFloat(e.target.value) || null })} /></div>
        <div><Label className="text-xs">Portée (m)</Label><Input type="number" className="h-8" value={form.reach_meters ?? ""} onChange={(e) => onChange({ ...form, reach_meters: parseFloat(e.target.value) || null })} /></div>
        <div><Label className="text-xs">Hauteur (m)</Label><Input type="number" className="h-8" value={form.height_meters ?? ""} onChange={(e) => onChange({ ...form, height_meters: parseFloat(e.target.value) || null })} /></div>
      </div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Réglementaire</p>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">VGP expiration</Label><Input type="date" className="h-8" value={form.vgp_expiry ?? ""} onChange={(e) => onChange({ ...form, vgp_expiry: e.target.value || null })} /></div>
        <div><Label className="text-xs">Fréquence VGP (mois)</Label><Input type="number" className="h-8" value={form.vgp_frequency_months ?? 12} onChange={(e) => onChange({ ...form, vgp_frequency_months: parseInt(e.target.value) || 12 })} /></div>
        <div><Label className="text-xs">Contrôle technique</Label><Input type="date" className="h-8" value={form.technical_control_expiry ?? ""} onChange={(e) => onChange({ ...form, technical_control_expiry: e.target.value || null })} /></div>
        <div><Label className="text-xs">Assurance</Label><Input type="date" className="h-8" value={form.insurance_expiry ?? ""} onChange={(e) => onChange({ ...form, insurance_expiry: e.target.value || null })} /></div>
        <div><Label className="text-xs">Police assurance</Label><Input className="h-8" value={form.insurance_policy ?? ""} onChange={(e) => onChange({ ...form, insurance_policy: e.target.value })} /></div>
        <div><Label className="text-xs">Prochain entretien</Label><Input type="date" className="h-8" value={form.next_maintenance_date ?? ""} onChange={(e) => onChange({ ...form, next_maintenance_date: e.target.value || null })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Tarif journalier (€)</Label><Input type="number" className="h-8" value={form.daily_rate ?? ""} onChange={(e) => onChange({ ...form, daily_rate: parseFloat(e.target.value) || null })} /></div>
        <div><Label className="text-xs">Prix d'achat (€)</Label><Input type="number" className="h-8" value={form.purchase_price ?? ""} onChange={(e) => onChange({ ...form, purchase_price: parseFloat(e.target.value) || null })} /></div>
      </div>
      <div><Label className="text-xs">Notes</Label><Textarea className="min-h-[60px] text-sm" value={form.notes ?? ""} onChange={(e) => onChange({ ...form, notes: e.target.value })} /></div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={isPending}>Enregistrer</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Annuler</Button>
      </div>
    </div>
  );
}

function PersonnelForm({ form, onChange, onSave, onCancel, isPending }: any) {
  const [cacesInput, setCacesInput] = useState("");
  const [habInput, setHabInput] = useState("");

  const addCaces = () => {
    if (!cacesInput.trim()) return;
    onChange({ ...form, caces: [...(form.caces ?? []), cacesInput.trim()] });
    setCacesInput("");
  };

  const addHab = () => {
    if (!habInput.trim()) return;
    onChange({ ...form, habilitations_elec: [...(form.habilitations_elec ?? []), habInput.trim()] });
    setHabInput("");
  };

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact & Coordonnées</p>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Téléphone</Label><Input className="h-8" value={form.phone ?? ""} onChange={(e) => onChange({ ...form, phone: e.target.value })} placeholder="06 xx xx xx xx" /></div>
        <div><Label className="text-xs">Email</Label><Input type="email" className="h-8" value={form.email ?? ""} onChange={(e) => onChange({ ...form, email: e.target.value })} placeholder="prenom.nom@..." /></div>
        <div className="col-span-2"><Label className="text-xs">Adresse</Label><Input className="h-8" value={form.address ?? ""} onChange={(e) => onChange({ ...form, address: e.target.value })} placeholder="Rue, code postal, ville" /></div>
      </div>

      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Informations professionnelles</p>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Poste / Fonction</Label><Input className="h-8" value={form.job_title ?? ""} onChange={(e) => onChange({ ...form, job_title: e.target.value })} /></div>
        <div><Label className="text-xs">Matricule</Label><Input className="h-8" value={form.employee_id ?? ""} onChange={(e) => onChange({ ...form, employee_id: e.target.value })} /></div>
        <div>
          <Label className="text-xs">Type de contrat</Label>
          <Select value={form.contract_type ?? "CDI"} onValueChange={(v) => onChange({ ...form, contract_type: v })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CDI">CDI</SelectItem>
              <SelectItem value="CDD">CDD</SelectItem>
              <SelectItem value="interim">Intérim</SelectItem>
              <SelectItem value="apprentissage">Apprentissage</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Date d'embauche</Label><Input type="date" className="h-8" value={form.hire_date ?? ""} onChange={(e) => onChange({ ...form, hire_date: e.target.value || null })} /></div>
      </div>

      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Pièce d'identité</p>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Date de naissance</Label><Input type="date" className="h-8" value={form.birth_date ?? ""} onChange={(e) => onChange({ ...form, birth_date: e.target.value || null })} /></div>
        <div><Label className="text-xs">Nationalité</Label><Input className="h-8" value={form.nationality ?? ""} onChange={(e) => onChange({ ...form, nationality: e.target.value })} /></div>
        <div><Label className="text-xs">N° document</Label><Input className="h-8" value={form.id_number ?? ""} onChange={(e) => onChange({ ...form, id_number: e.target.value })} /></div>
        <div><Label className="text-xs">Expiration document</Label><Input type="date" className="h-8" value={form.id_expiry ?? ""} onChange={(e) => onChange({ ...form, id_expiry: e.target.value || null })} /></div>
        <div className="col-span-2"><Label className="text-xs">N° Sécurité sociale</Label><Input className="h-8" value={form.social_security ?? ""} onChange={(e) => onChange({ ...form, social_security: e.target.value })} /></div>
      </div>

      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">CACES</p>
      <div className="flex gap-2">
        <Input className="h-8 flex-1" placeholder="ex: R489 cat.3" value={cacesInput} onChange={(e) => setCacesInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCaces()} />
        <Button size="sm" variant="outline" onClick={addCaces}>+</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(form.caces ?? []).map((c: string) => (
          <span key={c} className="bg-primary/10 text-primary text-xs rounded px-2 py-0.5 cursor-pointer" onClick={() => onChange({ ...form, caces: (form.caces ?? []).filter((x: string) => x !== c) })}>
            CACES {c} ✕
          </span>
        ))}
      </div>

      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Habilitations électriques</p>
      <div className="flex gap-2">
        <Input className="h-8 flex-1" placeholder="ex: B0, H0, BR..." value={habInput} onChange={(e) => setHabInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHab()} />
        <Button size="sm" variant="outline" onClick={addHab}>+</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(form.habilitations_elec ?? []).map((h: string) => (
          <span key={h} className="bg-warning/10 text-warning text-xs rounded px-2 py-0.5 cursor-pointer" onClick={() => onChange({ ...form, habilitations_elec: (form.habilitations_elec ?? []).filter((x: string) => x !== h) })}>
            {h} ✕
          </span>
        ))}
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.aipr ?? false} onChange={(e) => onChange({ ...form, aipr: e.target.checked })} />AIPR
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.sst ?? false} onChange={(e) => onChange({ ...form, sst: e.target.checked })} />SST
        </label>
      </div>

      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Suivi médical</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Aptitude</Label>
          <Select value={form.medical_aptitude ?? "apte"} onValueChange={(v) => onChange({ ...form, medical_aptitude: v })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="apte">✅ Apte</SelectItem>
              <SelectItem value="apte_restrictions">⚠️ Apte avec restrictions</SelectItem>
              <SelectItem value="inapte">❌ Inapte</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Dernière visite</Label><Input type="date" className="h-8" value={form.last_medical_visit ?? ""} onChange={(e) => onChange({ ...form, last_medical_visit: e.target.value || null })} /></div>
        <div><Label className="text-xs">Prochaine visite</Label><Input type="date" className="h-8" value={form.next_medical_visit ?? ""} onChange={(e) => onChange({ ...form, next_medical_visit: e.target.value || null })} /></div>
      </div>

      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Contact d'urgence</p>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Nom</Label><Input className="h-8" value={form.emergency_contact ?? ""} onChange={(e) => onChange({ ...form, emergency_contact: e.target.value })} /></div>
        <div><Label className="text-xs">Téléphone</Label><Input className="h-8" value={form.emergency_phone ?? ""} onChange={(e) => onChange({ ...form, emergency_phone: e.target.value })} /></div>
      </div>

      <div><Label className="text-xs">Notes</Label><Textarea className="min-h-[60px] text-sm" value={form.notes ?? ""} onChange={(e) => onChange({ ...form, notes: e.target.value })} /></div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={isPending}>Enregistrer</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Annuler</Button>
      </div>
    </div>
  );
}

// ===== Resource Expenses List =====
function ResourceExpensesList({ resourceId, companyIds }: { resourceId: string; companyIds: string[] }) {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["vehicle-expenses", resourceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_expenses")
        .select("*")
        .eq("resource_id", resourceId)
        .order("expense_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const exp = expenses.find((e: any) => e.id === id);
      if (exp?.photo_url) await supabase.storage.from("vehicle-expenses").remove([exp.photo_url]);
      const { error } = await supabase.from("vehicle_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dépense supprimée");
      qc.invalidateQueries({ queryKey: ["vehicle-expenses"] });
      setDeleteId(null);
    },
  });

  const EXPENSE_TYPE_LABELS: Record<string, string> = {
    gasoil: "Gasoil", entretien: "Entretien", reparation: "Réparation",
    peage: "Péage", lavage: "Lavage", amende: "Amende", autre: "Autre",
  };

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
  const total = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

  if (isLoading) return <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />)}</div>;
  if (expenses.length === 0) return <div className="text-center py-8 text-muted-foreground text-sm"><Receipt className="h-8 w-8 mx-auto mb-2 opacity-20" />Aucune dépense</div>;

  return (
    <>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{expenses.length} dépense(s)</span>
        <span className="font-semibold">Total : {fmt(total)}</span>
      </div>
      <div className="space-y-2">
        {expenses.map((exp: any) => (
          <div key={exp.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{EXPENSE_TYPE_LABELS[exp.expense_type] || exp.expense_type}</span>
                <span className="font-semibold">{fmt(Number(exp.amount))}</span>
                {exp.ai_extracted && <Sparkles className="h-3 w-3 text-primary" />}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(exp.expense_date), "d MMM yyyy", { locale: undefined })}
                {exp.vendor && ` · ${exp.vendor}`}
                {exp.liters && ` · ${exp.liters}L`}
                {exp.mileage_km && ` · ${exp.mileage_km.toLocaleString()} km`}
              </div>
              {exp.description && <p className="text-xs text-muted-foreground truncate">{exp.description}</p>}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setDeleteId(exp.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteId(null)}>
          <div className="bg-card rounded-xl p-6 shadow-xl max-w-sm mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold">Supprimer cette dépense ?</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Annuler</Button>
              <Button variant="destructive" size="sm" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Supprimer</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ===== AR Button =====
function ARButton({ resourceName }: { resourceName: string }) {
  const [showAR, setShowAR] = useState(false);
  const modelKey = resourceName.toLowerCase().includes("k1000") ? "k1000"
    : resourceName.toLowerCase().includes("k1003") ? "k1003"
    : resourceName.toLowerCase().includes("mk73") && resourceName.toLowerCase().includes("patin") ? "mk73-patin"
    : resourceName.toLowerCase().includes("mk73") ? "mk73-ouverte"
    : resourceName.toLowerCase().includes("cbdg") ? "cbdg"
    : undefined;

  if (!modelKey) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setShowAR(true)} className="gap-1.5">
        <Camera className="h-3.5 w-3.5" />Projeter sur photo
      </Button>
      <ARPhotoOverlay open={showAR} onClose={() => setShowAR(false)} initialModel={modelKey} />
    </>
  );
}
