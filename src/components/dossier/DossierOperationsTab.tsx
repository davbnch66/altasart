import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Check, Users, X, Pencil, MessageSquare, Warehouse, FileText, HardHat, Pen, Download } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { MaterielListDisplay } from "@/components/MaterielListDisplay";
import { BTReportPreviewDialog } from "@/components/terrain/BTReportPreviewDialog";

interface Props {
  dossierId: string;
  companyId: string;
}

const DEPOT_ADDRESS = { address: "12 rue Jean Monnet", postal_code: "95190", city: "Goussainville" };

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
};

const OP_TYPES = ["B.T.", "Opérat°", "Livraison", "Enlèvement"];

const emptyForm = () => ({
  type: "B.T.",
  loading_date: "",
  loading_city: "",
  loading_address: "",
  loading_postal_code: "",
  loading_floor: "",
  loading_access: "",
  loading_elevator: false,
  loading_parking_request: false,
  loading_comments: "",
  loading_time_start: "",
  loading_time_end: "",
  loading_portage: "0",
  loading_passage_fenetre: false,
  loading_monte_meubles: false,
  loading_transbordement: false,
  delivery_city: "",
  delivery_address: "",
  delivery_postal_code: "",
  delivery_floor: "",
  delivery_access: "",
  delivery_elevator: false,
  delivery_parking_request: false,
  delivery_comments: "",
  delivery_date: "",
  delivery_time_start: "",
  delivery_time_end: "",
  delivery_portage: "0",
  delivery_passage_fenetre: false,
  delivery_monte_meubles: false,
  delivery_transbordement: false,
  lv_bt_number: "",
  volume: "",
  weight: "",
  notes: "",
  instructions: "",
});

type OpForm = ReturnType<typeof emptyForm>;

/* ──────── Address Block (Chargement or Livraison) ──────── */
const AddressBlock = ({
  title, prefix, form, setForm, fillDepot,
}: {
  title: string;
  prefix: "loading" | "delivery";
  form: OpForm;
  setForm: (f: OpForm) => void;
  fillDepot: (p: "loading" | "delivery") => void;
}) => {
  const up = (k: string, v: any) => setForm({ ...form, [k]: v });
  const f = (field: string) => (form as any)[`${prefix}_${field}`];

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary">{title}</h4>
        <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => fillDepot(prefix)}>
          <Warehouse className="h-3 w-3" /> Dépôt
        </Button>
      </div>

      {/* Date + Horaires */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Date</Label>
          <Input type="date" value={f("date")} onChange={(e) => up(`${prefix}_date`, e.target.value)} className="h-7 text-xs" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Début</Label>
          <Input type="time" value={f("time_start")} onChange={(e) => up(`${prefix}_time_start`, e.target.value)} className="h-7 text-xs" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Fin</Label>
          <Input type="time" value={f("time_end")} onChange={(e) => up(`${prefix}_time_end`, e.target.value)} className="h-7 text-xs" />
        </div>
      </div>

      {/* Adresse */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Adresse</Label>
        <Input value={f("address")} onChange={(e) => up(`${prefix}_address`, e.target.value)} className="h-7 text-xs" />
      </div>

      {/* CP + Ville */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">CP</Label>
          <Input value={f("postal_code")} onChange={(e) => up(`${prefix}_postal_code`, e.target.value)} className="h-7 text-xs" />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] text-muted-foreground">Ville</Label>
          <Input value={f("city")} onChange={(e) => up(`${prefix}_city`, e.target.value)} className="h-7 text-xs" />
        </div>
      </div>

      {/* Étage + Portage */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Étage</Label>
          <Input value={f("floor")} onChange={(e) => up(`${prefix}_floor`, e.target.value)} className="h-7 text-xs" placeholder="RDC, 3e…" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Portage</Label>
          <Input type="number" value={f("portage")} onChange={(e) => up(`${prefix}_portage`, e.target.value)} className="h-7 text-xs" />
        </div>
      </div>

      {/* Checkboxes */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {[
          { key: "elevator", label: "Ascenseur" },
          { key: "passage_fenetre", label: "Passage fenêtre" },
          { key: "monte_meubles", label: "Monte-meubles" },
          { key: "transbordement", label: "Transbordement" },
          { key: "parking_request", label: "Stationnement" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <Checkbox
              id={`${prefix}-${key}`}
              checked={!!f(key)}
              onCheckedChange={(v) => up(`${prefix}_${key}`, !!v)}
            />
            <label htmlFor={`${prefix}-${key}`} className="text-[10px]">{label}</label>
          </div>
        ))}
      </div>

      {/* Accès */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Accès</Label>
        <Input value={f("access")} onChange={(e) => up(`${prefix}_access`, e.target.value)} className="h-7 text-xs" placeholder="Digicode, portail…" />
      </div>

      {/* Observations */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Observations</Label>
        <Textarea value={f("comments")} onChange={(e) => up(`${prefix}_comments`, e.target.value)} className="min-h-[40px] text-xs resize-none" />
      </div>
    </div>
  );
};

/* ──────── Full Operation Form (Safari GT layout) ──────── */
const OperationFormContent = ({
  form, setForm, fillDepot, isMobile, dossierId,
}: {
  form: OpForm;
  setForm: (f: OpForm) => void;
  fillDepot: (prefix: "loading" | "delivery") => void;
  isMobile: boolean;
  dossierId?: string;
}) => {
  const up = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <div className="space-y-4">
      {/* ── Header row: type, LV/BT, volume, weight ── */}
      <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}>
        <div>
          <Label className="text-[10px] text-muted-foreground">Type</Label>
          <select value={form.type} onChange={(e) => up("type", e.target.value)} className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs">
            {OP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">N° LV/BT</Label>
          <Input value={form.lv_bt_number} onChange={(e) => up("lv_bt_number", e.target.value)} className="h-7 text-xs" />
        </div>
      </div>

      {/* Liste matériel (depuis la visite liée au dossier) */}
      <MaterielListDisplay dossierId={dossierId} compact />

      {/* ── Chargement / Livraison side by side ── */}
      <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
        <AddressBlock title="Chargement" prefix="loading" form={form} setForm={setForm} fillDepot={fillDepot} />
        <AddressBlock title="Livraison" prefix="delivery" form={form} setForm={setForm} fillDepot={fillDepot} />
      </div>

      {/* ── Consignes + Notes ── */}
      <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
        <div>
          <Label className="text-[10px] text-muted-foreground font-medium">Consignes / Mode opératoire</Label>
          <Textarea value={form.instructions} onChange={(e) => up("instructions", e.target.value)} placeholder="Mode opératoire, consignes de sécurité…" className="min-h-[60px] text-xs mt-1 resize-none" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground font-medium">Commentaires de l'opération</Label>
          <Textarea value={form.notes} onChange={(e) => up("notes", e.target.value)} placeholder="Notes internes, rappels…" className="min-h-[60px] text-xs mt-1 resize-none" />
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────── Main component ──────────────────────────── */
export const DossierOperationsTab = ({ dossierId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [editingOpNum, setEditingOpNum] = useState(0);
  const [form, setForm] = useState<OpForm>(emptyForm());
  const [editingResources, setEditingResources] = useState<string | null>(null);
  const [reportBtId, setReportBtId] = useState<string | null>(null);

  const { data: operations = [], isLoading } = useQuery({
    queryKey: ["dossier-operations", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations")
        .select("*, factures(code)")
        .eq("dossier_id", dossierId)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const opIds = operations.map((o: any) => o.id);
  const { data: opResources = [] } = useQuery({
    queryKey: ["operation-resources", dossierId, opIds],
    queryFn: async () => {
      if (opIds.length === 0) return [];
      const { data, error } = await supabase
        .from("operation_resources")
        .select("*, resources!left(id, name, type)")
        .in("operation_id", opIds);
      if (error) throw error;
      return data || [];
    },
    enabled: opIds.length > 0,
  });

  const { data: availableResources = [] } = useQuery({
    queryKey: ["company-resources", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_companies")
        .select("resource_id, resources!inner(id, name, type)")
        .eq("company_id", companyId);
      if (error) throw error;
      return (data || []).map((rc: any) => rc.resources);
    },
    enabled: !!companyId,
  });

  const { data: dossier } = useQuery({
    queryKey: ["dossier-for-ops", dossierId],
    queryFn: async () => {
      const { data } = await supabase.from("dossiers").select("loading_address, loading_postal_code, loading_city, loading_floor, loading_access, loading_elevator, loading_parking_request, loading_comments, delivery_address, delivery_postal_code, delivery_city, delivery_floor, delivery_access, delivery_elevator, delivery_parking_request, delivery_comments").eq("id", dossierId).single();
      return data;
    },
  });

  const formToPayload = (f: OpForm) => ({
    type: f.type,
    loading_date: f.loading_date || null,
    loading_city: f.loading_city?.trim() || null,
    loading_address: f.loading_address?.trim() || null,
    loading_postal_code: f.loading_postal_code?.trim() || null,
    loading_floor: f.loading_floor?.trim() || null,
    loading_access: f.loading_access?.trim() || null,
    loading_elevator: f.loading_elevator || false,
    loading_parking_request: f.loading_parking_request || false,
    loading_comments: f.loading_comments?.trim() || null,
    loading_time_start: f.loading_time_start || null,
    loading_time_end: f.loading_time_end || null,
    loading_portage: f.loading_portage ? Number(f.loading_portage) : 0,
    loading_passage_fenetre: f.loading_passage_fenetre || false,
    loading_monte_meubles: f.loading_monte_meubles || false,
    loading_transbordement: f.loading_transbordement || false,
    delivery_city: f.delivery_city?.trim() || null,
    delivery_address: f.delivery_address?.trim() || null,
    delivery_postal_code: f.delivery_postal_code?.trim() || null,
    delivery_floor: f.delivery_floor?.trim() || null,
    delivery_access: f.delivery_access?.trim() || null,
    delivery_elevator: f.delivery_elevator || false,
    delivery_parking_request: f.delivery_parking_request || false,
    delivery_comments: f.delivery_comments?.trim() || null,
    delivery_date: f.delivery_date || null,
    delivery_time_start: f.delivery_time_start || null,
    delivery_time_end: f.delivery_time_end || null,
    delivery_portage: f.delivery_portage ? Number(f.delivery_portage) : 0,
    delivery_passage_fenetre: f.delivery_passage_fenetre || false,
    delivery_monte_meubles: f.delivery_monte_meubles || false,
    delivery_transbordement: f.delivery_transbordement || false,
    lv_bt_number: f.lv_bt_number?.trim() || null,
    volume: f.volume ? Number(f.volume) : 0,
    weight: f.weight ? Number(f.weight) : 0,
    notes: f.notes?.trim() || null,
    instructions: f.instructions?.trim() || null,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const nextNum = operations.length + 1;
      const payload = {
        ...formToPayload(form),
        dossier_id: dossierId,
        company_id: companyId,
        operation_number: nextNum,
        sort_order: nextNum,
      };
      const { error } = await (supabase.from("operations") as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opération ajoutée");
      queryClient.invalidateQueries({ queryKey: ["dossier-operations"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-operations-count"] });
      setCreateOpen(false);
      setForm(emptyForm());
    },
    onError: () => toast.error("Erreur"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingOpId) return;
      const { error } = await (supabase.from("operations") as any).update(formToPayload(form)).eq("id", editingOpId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opération mise à jour");
      queryClient.invalidateQueries({ queryKey: ["dossier-operations"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-operations-count"] });
      setEditOpen(false);
      setEditingOpId(null);
      setForm(emptyForm());
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("operations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opération supprimée");
      queryClient.invalidateQueries({ queryKey: ["dossier-operations"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-operations-count"] });
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("operations").update({ completed: !completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dossier-operations"] }),
  });

  const addResourceToOp = useMutation({
    mutationFn: async ({ operationId, resourceId }: { operationId: string; resourceId: string }) => {
      const { error } = await supabase.from("operation_resources").insert({ operation_id: operationId, resource_id: resourceId } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operation-resources"] });
      queryClient.invalidateQueries({ queryKey: ["terrain-bts"] });
      toast.success("Ressource affectée");
    },
    onError: (e: any) => toast.error(e.message?.includes("duplicate") ? "Déjà affecté" : "Erreur"),
  });

  const removeResourceFromOp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("operation_resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operation-resources"] });
      queryClient.invalidateQueries({ queryKey: ["terrain-bts"] });
      toast.success("Ressource retirée");
    },
  });

  const getResourcesForOp = (opId: string) => opResources.filter((or: any) => or.operation_id === opId);

  const openCreate = () => {
    const f = emptyForm();
    if (dossier) {
      f.loading_address = dossier.loading_address || "";
      f.loading_postal_code = dossier.loading_postal_code || "";
      f.loading_city = dossier.loading_city || "";
      f.loading_floor = dossier.loading_floor || "";
      f.loading_access = dossier.loading_access || "";
      f.loading_elevator = dossier.loading_elevator || false;
      f.loading_parking_request = dossier.loading_parking_request || false;
      f.loading_comments = dossier.loading_comments || "";
      f.delivery_address = dossier.delivery_address || "";
      f.delivery_postal_code = dossier.delivery_postal_code || "";
      f.delivery_city = dossier.delivery_city || "";
      f.delivery_floor = dossier.delivery_floor || "";
      f.delivery_access = dossier.delivery_access || "";
      f.delivery_elevator = dossier.delivery_elevator || false;
      f.delivery_parking_request = dossier.delivery_parking_request || false;
      f.delivery_comments = dossier.delivery_comments || "";
    }
    setForm(f);
    setCreateOpen(true);
  };

  const openEdit = (op: any) => {
    setEditingOpId(op.id);
    setEditingOpNum(op.operation_number);
    setForm({
      type: op.type || "B.T.",
      loading_date: op.loading_date || "",
      loading_city: op.loading_city || "",
      loading_address: op.loading_address || "",
      loading_postal_code: op.loading_postal_code || "",
      loading_floor: op.loading_floor || "",
      loading_access: op.loading_access || "",
      loading_elevator: op.loading_elevator || false,
      loading_parking_request: op.loading_parking_request || false,
      loading_comments: op.loading_comments || "",
      loading_time_start: op.loading_time_start || "",
      loading_time_end: op.loading_time_end || "",
      loading_portage: String(op.loading_portage ?? 0),
      loading_passage_fenetre: op.loading_passage_fenetre || false,
      loading_monte_meubles: op.loading_monte_meubles || false,
      loading_transbordement: op.loading_transbordement || false,
      delivery_city: op.delivery_city || "",
      delivery_address: op.delivery_address || "",
      delivery_postal_code: op.delivery_postal_code || "",
      delivery_floor: op.delivery_floor || "",
      delivery_access: op.delivery_access || "",
      delivery_elevator: op.delivery_elevator || false,
      delivery_parking_request: op.delivery_parking_request || false,
      delivery_comments: op.delivery_comments || "",
      delivery_date: op.delivery_date || "",
      delivery_time_start: op.delivery_time_start || "",
      delivery_time_end: op.delivery_time_end || "",
      delivery_portage: String(op.delivery_portage ?? 0),
      delivery_passage_fenetre: op.delivery_passage_fenetre || false,
      delivery_monte_meubles: op.delivery_monte_meubles || false,
      delivery_transbordement: op.delivery_transbordement || false,
      lv_bt_number: op.lv_bt_number || "",
      volume: op.volume ?? "",
      weight: op.weight ?? "",
      notes: op.notes || "",
      instructions: op.instructions || "",
    });
    setEditOpen(true);
  };

  const fillDepot = (prefix: "loading" | "delivery") => {
    setForm({
      ...form,
      [`${prefix}_address`]: DEPOT_ADDRESS.address,
      [`${prefix}_postal_code`]: DEPOT_ADDRESS.postal_code,
      [`${prefix}_city`]: DEPOT_ADDRESS.city,
    } as any);
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Chargement…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Opérations ({operations.length})</h3>
        <Button size="sm" variant="outline" onClick={openCreate} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Nouvelle
        </Button>
      </div>

      {/* ══ Create Dialog ══ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Nouvelle opération</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            <OperationFormContent form={form} setForm={setForm} fillDepot={fillDepot} isMobile={isMobile} dossierId={dossierId} />
            {/* Placeholder for resources - only available after creation */}
            <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
              <div className="rounded-lg border border-dashed bg-muted/30 p-3 space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Véhicules réservés</h4>
                <p className="text-[10px] text-muted-foreground italic">Disponible après création de l'opération</p>
              </div>
              <div className="rounded-lg border border-dashed bg-muted/30 p-3 space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Personnel réservé</h4>
                <p className="text-[10px] text-muted-foreground italic">Disponible après création de l'opération</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? "Création…" : "Créer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ Edit Dialog ══ */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { setEditingOpId(null); setForm(emptyForm()); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Modifier Op. {editingOpNum}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            <OperationFormContent form={form} setForm={setForm} fillDepot={fillDepot} isMobile={isMobile} dossierId={dossierId} />

            {/* ── Ressources affectées (Véhicules + Personnel) ── */}
            {editingOpId && (() => {
              const assignedResources = getResourcesForOp(editingOpId);
              const assignedIds = assignedResources.map((ar: any) => ar.resource_id);
              const unassigned = availableResources.filter((r: any) => !assignedIds.includes(r.id));
              const vehicles = assignedResources.filter((ar: any) => ar.resources?.type === "vehicule" || ar.resources?.type === "vehicle");
              const personnel = assignedResources.filter((ar: any) => ar.resources?.type === "personnel" || ar.resources?.type === "person");
              const other = assignedResources.filter((ar: any) => !vehicles.includes(ar) && !personnel.includes(ar));
              const unassignedVehicles = unassigned.filter((r: any) => r.type === "vehicule" || r.type === "vehicle");
              const unassignedPersonnel = unassigned.filter((r: any) => r.type === "personnel" || r.type === "person");
              const unassignedOther = unassigned.filter((r: any) => !unassignedVehicles.includes(r) && !unassignedPersonnel.includes(r));

              return (
                <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                  {/* Véhicules réservés */}
                  <div className="rounded-lg border bg-card p-3 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Véhicules réservés</h4>
                    {vehicles.length === 0 && unassignedVehicles.length === 0 && (
                      <p className="text-[10px] text-muted-foreground">Aucun véhicule disponible</p>
                    )}
                    {vehicles.length > 0 && (
                      <div className="space-y-1">
                        {vehicles.map((ar: any) => (
                          <div key={ar.id} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1">
                            <span className="text-xs font-medium">{ar.resources?.name || "—"}</span>
                            <button onClick={() => removeResourceFromOp.mutate(ar.id)} className="text-muted-foreground hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {unassignedVehicles.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {unassignedVehicles.map((r: any) => (
                          <button key={r.id} onClick={() => addResourceToOp.mutate({ operationId: editingOpId, resourceId: r.id })}
                            className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                            + {r.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Personnel réservé */}
                  <div className="rounded-lg border bg-card p-3 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Personnel réservé</h4>
                    {personnel.length === 0 && unassignedPersonnel.length === 0 && (
                      <p className="text-[10px] text-muted-foreground">Aucun personnel disponible</p>
                    )}
                    {personnel.length > 0 && (
                      <div className="space-y-1">
                        {personnel.map((ar: any) => (
                          <div key={ar.id} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1">
                            <span className="text-xs font-medium">{ar.resources?.name || "—"}</span>
                            <button onClick={() => removeResourceFromOp.mutate(ar.id)} className="text-muted-foreground hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {unassignedPersonnel.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {unassignedPersonnel.map((r: any) => (
                          <button key={r.id} onClick={() => addResourceToOp.mutate({ operationId: editingOpId, resourceId: r.id })}
                            className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                            + {r.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Autres ressources (si type non reconnu) */}
                  {(other.length > 0 || unassignedOther.length > 0) && (
                    <div className="rounded-lg border bg-card p-3 space-y-2 col-span-full">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Autres ressources</h4>
                      {other.map((ar: any) => (
                        <div key={ar.id} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1">
                          <span className="text-xs font-medium">{ar.resources?.name || "—"}</span>
                          <button onClick={() => removeResourceFromOp.mutate(ar.id)} className="text-muted-foreground hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {unassignedOther.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {unassignedOther.map((r: any) => (
                            <button key={r.id} onClick={() => addResourceToOp.mutate({ operationId: editingOpId, resourceId: r.id })}
                              className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                              + {r.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ Operations list ══ */}
      <div className="rounded-xl border bg-card divide-y">
        {operations.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">Aucune opération</div>
        ) : operations.map((op: any) => {
          const assignedResources = getResourcesForOp(op.id);
          const isEditingThis = editingResources === op.id;
          const assignedIds = assignedResources.map((ar: any) => ar.resource_id);
          const unassigned = availableResources.filter((r: any) => !assignedIds.includes(r.id));

          return (
            <div key={op.id} className={`${isMobile ? "px-3 py-2.5" : "px-5 py-3"}`}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleComplete.mutate({ id: op.id, completed: op.completed })}
                  className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    op.completed ? "bg-success border-success text-success-foreground" : "border-muted-foreground/30 hover:border-primary"
                  }`}
                >
                  {op.completed && <Check className="h-3 w-3" />}
                </button>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(op)}>
                  <p className={`font-medium truncate ${isMobile ? "text-xs" : "text-sm"} ${op.completed ? "line-through text-muted-foreground" : ""}`}>
                    Op. {op.operation_number} — {op.type}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(op.loading_date)} · {op.loading_city || "—"} → {op.delivery_city || "—"}
                    {op.lv_bt_number && ` · LV/BT: ${op.lv_bt_number}`}
                    {op.factures?.code && ` · Fact: ${op.factures.code}`}
                  </p>
                </div>
                {/* BT Report button - visible when at least one signature exists */}
                {(op.operator_signature_url || op.start_signature_url || op.end_signature_url) && (
                  <button
                    onClick={() => setReportBtId(op.id)}
                    className="p-1 rounded text-primary hover:bg-primary/10 transition-colors shrink-0"
                    title="Rapport BT signé"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => openEdit(op)} className="p-1 rounded text-muted-foreground hover:text-primary transition-colors shrink-0" title="Modifier">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setEditingResources(isEditingThis ? null : op.id)}
                  className={`p-1 rounded transition-colors shrink-0 ${isEditingThis ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"}`}
                  title="Affecter des ressources"
                >
                  <Users className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => deleteMutation.mutate(op.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Signature status indicators */}
              {(op.operator_signature_url || op.start_signature_url || op.end_signature_url) && (
                <div className="ml-8 mt-1.5 flex flex-wrap gap-2 text-[10px]">
                  <span className={`flex items-center gap-1 ${op.operator_signature_url ? "text-success" : "text-muted-foreground"}`}>
                    <HardHat className="h-3 w-3" />
                    Opérateur: {op.operator_signature_url ? `✓ ${op.operator_signer_name || "Signé"}` : "—"}
                  </span>
                  <span className={`flex items-center gap-1 ${op.start_signature_url ? "text-success" : "text-muted-foreground"}`}>
                    <Pen className="h-3 w-3" />
                    Début: {op.start_signature_url ? `✓ ${op.start_signer_name || "Signé"}` : "—"}
                  </span>
                  <span className={`flex items-center gap-1 ${op.end_signature_url ? "text-success" : "text-muted-foreground"}`}>
                    <Pen className="h-3 w-3" />
                    Fin: {op.end_signature_url ? `✓ ${op.end_signer_name || "Signé"}` : "—"}
                  </span>
                </div>
              )}

              {(op.notes || op.instructions) && (
                <div className="ml-8 mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{op.instructions || op.notes}</span>
                </div>
              )}

              {assignedResources.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 ml-8">
                  {assignedResources.map((ar: any) => (
                    <Badge key={ar.id} variant="secondary" className="text-[10px] gap-1 pr-1">
                      {ar.resources?.name || "—"}
                      {isEditingThis && (
                        <button onClick={() => removeResourceFromOp.mutate(ar.id)} className="ml-0.5 hover:text-destructive">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              )}

              {isEditingThis && unassigned.length > 0 && (
                <div className="ml-8 mt-2 flex flex-wrap gap-1">
                  {unassigned.map((r: any) => (
                    <button
                      key={r.id}
                      onClick={() => addResourceToOp.mutate({ operationId: op.id, resourceId: r.id })}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      + {r.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* BT Report Preview Dialog */}
      {reportBtId && (
        <BTReportPreviewDialog
          open={!!reportBtId}
          onOpenChange={(v) => !v && setReportBtId(null)}
          btId={reportBtId}
          companyIds={[companyId]}
        />
      )}
    </div>
  );
};
