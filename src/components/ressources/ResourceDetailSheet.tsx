import { useState } from "react";
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
  ShieldCheck, Activity, Zap, HardHat, Package
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

const TYPE_ICONS: Record<string, React.ElementType> = {
  employe: HardHat, grue: Wrench, vehicule: Truck, equipement: Package, equipe: User,
};

const STATUS_COLORS: Record<string, string> = {
  disponible: "bg-success/10 text-success border-success/20",
  occupe: "bg-warning/10 text-warning border-warning/20",
  maintenance: "bg-destructive/10 text-destructive border-destructive/20",
  absent: "bg-muted text-muted-foreground",
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
  const Icon = TYPE_ICONS[resource?.type] ?? User;
  const isEquipment = ["grue", "vehicule", "equipement"].includes(resource?.type);
  const isPersonnel = resource?.type === "employe";

  const [newIntervention, setNewIntervention] = useState({
    type: isPersonnel ? "formation" : "entretien",
    title: "", description: "", status: "planifie", priority: "normale",
    scheduled_date: "", completed_date: "", next_due_date: "", cost: "", provider: "", reference: "",
  });
  const [showAddIntervention, setShowAddIntervention] = useState(false);

  // Resource details
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
      const { data, error } = await supabase
        .from("resource_interventions")
        .select("*")
        .eq("resource_id", resource.id)
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Update resource status
  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("resources").update({ status } as any).eq("id", resource.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["resources"] }); toast.success("Statut mis à jour"); },
  });

  // Save equipment data
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

  // Save personnel data
  const [pForm, setPForm] = useState<any>(null);
  const [pEditing, setPEditing] = useState(false);

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

  // Add intervention
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

  if (!resource) return null;

  // Alerts for equipment
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
    const medDays = getDaysUntil(personnel.next_medical_visit);
    if (medDays !== null && medDays < 30) alerts.push(`Visite médicale ${medDays < 0 ? "en retard" : `dans ${medDays}j`}`);
  }

  const upcomingInterventions = interventions.filter((i: any) => i.status === "planifie" || i.status === "en_cours");
  const pastInterventions = interventions.filter((i: any) => i.status === "termine" || i.status === "annule");

  const totalCost = interventions.reduce((s: number, i: any) => s + (i.cost || 0), 0);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {/* Header */}
        <div className="p-6 border-b bg-muted/30">
          <SheetHeader>
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-xl">{resource.name}</SheetTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-muted-foreground capitalize">{resource.type}</span>
                  {resource.companyIds?.map((cid: string) => {
                    const c = companies.find((x: any) => x.id === cid);
                    return c ? <span key={cid} className="text-xs bg-muted px-2 py-0.5 rounded">{c.shortName}</span> : null;
                  })}
                </div>
              </div>
              <Select value={resource.status} onValueChange={(v) => updateStatus.mutate(v)}>
                <SelectTrigger className={`w-auto h-8 text-xs border rounded-full px-3 ${STATUS_COLORS[resource.status] ?? ""}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disponible">Disponible</SelectItem>
                  <SelectItem value="occupe">Occupé</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SheetHeader>

          {/* Alerts */}
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
        <Tabs defaultValue={isEquipment ? "technique" : "rh"} className="flex-1">
          <TabsList className="w-full rounded-none border-b h-auto p-0 bg-transparent justify-start gap-0">
            {isEquipment && (
              <TabsTrigger value="technique" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm">
                <Settings className="h-4 w-4 mr-2" />Technique
              </TabsTrigger>
            )}
            {isPersonnel && (
              <TabsTrigger value="rh" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm">
                <User className="h-4 w-4 mr-2" />Fiche RH
              </TabsTrigger>
            )}
            <TabsTrigger value="interventions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm">
              <Activity className="h-4 w-4 mr-2" />
              {isPersonnel ? "Formations & Absences" : "VGP & Entretiens"}
              {upcomingInterventions.length > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 py-0.5">{upcomingInterventions.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="historique" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm">
              <FileText className="h-4 w-4 mr-2" />Historique
            </TabsTrigger>
          </TabsList>

          {/* ===== TECHNIQUE (Engins/Véhicules) ===== */}
          {isEquipment && (
            <TabsContent value="technique" className="p-4 space-y-4">
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
                  {/* Identification */}
                  <Section title="Identification" icon={<Truck className="h-4 w-4" />}>
                    <InfoGrid items={[
                      { label: "Immatriculation", value: equipment?.registration },
                      { label: "N° de série", value: equipment?.serial_number },
                      { label: "Marque", value: equipment?.brand },
                      { label: "Modèle", value: equipment?.model },
                      { label: "Année", value: equipment?.year_manufacture?.toString() },
                    ]} />
                  </Section>

                  {/* Caractéristiques */}
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

                  {/* Réglementaire */}
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

          {/* ===== RH (Personnel) ===== */}
          {isPersonnel && (
            <TabsContent value="rh" className="p-4 space-y-4">
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
                  <Section title="Informations professionnelles" icon={<User className="h-4 w-4" />}>
                    <InfoGrid items={[
                      { label: "Poste", value: personnel?.job_title },
                      { label: "Matricule", value: personnel?.employee_id },
                      { label: "Contrat", value: personnel?.contract_type },
                      { label: "Entrée", value: personnel?.hire_date ? format(new Date(personnel.hire_date), "dd/MM/yyyy") : null },
                      { label: "Téléphone", value: personnel?.phone },
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

          {/* ===== INTERVENTIONS PLANIFIÉES ===== */}
          <TabsContent value="interventions" className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">
                {upcomingInterventions.length} intervention{upcomingInterventions.length !== 1 ? "s" : ""} à venir
              </h3>
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
          <TabsContent value="historique" className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">{pastInterventions.length} interventions passées</h3>
              {totalCost > 0 && <span className="text-sm font-medium">Total coûts : {totalCost.toLocaleString()} €</span>}
            </div>
            {pastInterventions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                Aucun historique
              </div>
            ) : (
              <div className="space-y-2">
                {pastInterventions.map((item: any) => (
                  <InterventionCard key={item.id} item={item} onDelete={(id) => deleteIntervention.mutate(id)} onStatusChange={(id, s) => updateInterventionStatus.mutate({ id, status: s })} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
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
        <Input className="h-8" value={form.title} onChange={(e) => onChange({ ...form, title: e.target.value })} placeholder="Ex: VGP annuelle, Vidange..." />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Date prévue</Label><Input type="date" className="h-8" value={form.scheduled_date} onChange={(e) => onChange({ ...form, scheduled_date: e.target.value })} /></div>
        <div><Label className="text-xs">Prochaine échéance</Label><Input type="date" className="h-8" value={form.next_due_date} onChange={(e) => onChange({ ...form, next_due_date: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Prestataire</Label><Input className="h-8" value={form.provider} onChange={(e) => onChange({ ...form, provider: e.target.value })} placeholder="Nom du prestataire" /></div>
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
        <div><Label className="text-xs">Téléphone</Label><Input className="h-8" value={form.phone ?? ""} onChange={(e) => onChange({ ...form, phone: e.target.value })} /></div>
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
