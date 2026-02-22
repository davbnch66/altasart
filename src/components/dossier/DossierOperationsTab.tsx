import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Check, Users, X, Pencil, MessageSquare, Warehouse, MapPin, ClipboardList, FileText } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

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
  lv_bt_number: "",
  volume: "",
  weight: "",
  notes: "",
  instructions: "",
});

type OpForm = ReturnType<typeof emptyForm>;

/* ──────────────────────────── Form content (shared between create & edit) ──────────────────────────── */
const OperationFormContent = ({
  form, setForm, fillDepot, isMobile,
}: {
  form: OpForm;
  setForm: (f: OpForm) => void;
  fillDepot: (prefix: "loading" | "delivery") => void;
  isMobile: boolean;
}) => {
  const up = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="w-full flex-wrap h-auto gap-1 justify-start">
        <TabsTrigger value="general" className="text-[11px] gap-1 h-7">
          <FileText className="h-3 w-3" /> Général
        </TabsTrigger>
        <TabsTrigger value="loading" className="text-[11px] gap-1 h-7">
          <MapPin className="h-3 w-3" /> Chargement
        </TabsTrigger>
        <TabsTrigger value="delivery" className="text-[11px] gap-1 h-7">
          <MapPin className="h-3 w-3" /> Livraison
        </TabsTrigger>
        <TabsTrigger value="instructions" className="text-[11px] gap-1 h-7">
          <ClipboardList className="h-3 w-3" /> Consignes
        </TabsTrigger>
      </TabsList>

      {/* ── Général ── */}
      <TabsContent value="general" className="mt-2">
        <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-3"}`}>
          <div>
            <Label className="text-xs">Type</Label>
            <select value={form.type} onChange={(e) => up("type", e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
              {OP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">N° LV/BT</Label>
            <Input value={form.lv_bt_number} onChange={(e) => up("lv_bt_number", e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Volume (m³)</Label>
            <Input type="number" value={form.volume} onChange={(e) => up("volume", e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Poids (t)</Label>
            <Input type="number" value={form.weight} onChange={(e) => up("weight", e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
      </TabsContent>

      {/* ── Chargement ── */}
      <TabsContent value="loading" className="mt-2 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-primary">Chargement</Label>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => fillDepot("loading")}>
            <Warehouse className="h-3 w-3" /> Dépôt
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={form.loading_date} onChange={(e) => up("loading_date", e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Début</Label>
              <Input type="time" value={form.loading_time_start} onChange={(e) => up("loading_time_start", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Fin</Label>
              <Input type="time" value={form.loading_time_end} onChange={(e) => up("loading_time_end", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Adresse</Label>
            <Input value={form.loading_address} onChange={(e) => up("loading_address", e.target.value)} className="h-9 text-sm" placeholder="Adresse de chargement" />
          </div>
          <div>
            <Label className="text-xs">Code postal</Label>
            <Input value={form.loading_postal_code} onChange={(e) => up("loading_postal_code", e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Ville</Label>
            <Input value={form.loading_city} onChange={(e) => up("loading_city", e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Étage</Label>
            <Input value={form.loading_floor} onChange={(e) => up("loading_floor", e.target.value)} className="h-9 text-sm" placeholder="RDC, 3e…" />
          </div>
          <div>
            <Label className="text-xs">Accès</Label>
            <Input value={form.loading_access} onChange={(e) => up("loading_access", e.target.value)} className="h-9 text-sm" placeholder="Digicode, portail…" />
          </div>
          <div className="col-span-2 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Checkbox id="ld-elev" checked={form.loading_elevator} onCheckedChange={(v) => up("loading_elevator", !!v)} />
              <label htmlFor="ld-elev" className="text-xs">Ascenseur</label>
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox id="ld-park" checked={form.loading_parking_request} onCheckedChange={(v) => up("loading_parking_request", !!v)} />
              <label htmlFor="ld-park" className="text-xs">Stationnement</label>
            </div>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Observations</Label>
            <Textarea value={form.loading_comments} onChange={(e) => up("loading_comments", e.target.value)} className="min-h-[50px] text-sm resize-none" placeholder="Contraintes, observations…" />
          </div>
        </div>
      </TabsContent>

      {/* ── Livraison ── */}
      <TabsContent value="delivery" className="mt-2 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-primary">Livraison</Label>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => fillDepot("delivery")}>
            <Warehouse className="h-3 w-3" /> Dépôt
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={form.delivery_date} onChange={(e) => up("delivery_date", e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Début</Label>
              <Input type="time" value={form.delivery_time_start} onChange={(e) => up("delivery_time_start", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Fin</Label>
              <Input type="time" value={form.delivery_time_end} onChange={(e) => up("delivery_time_end", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Adresse</Label>
            <Input value={form.delivery_address} onChange={(e) => up("delivery_address", e.target.value)} className="h-9 text-sm" placeholder="Adresse de livraison" />
          </div>
          <div>
            <Label className="text-xs">Code postal</Label>
            <Input value={form.delivery_postal_code} onChange={(e) => up("delivery_postal_code", e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Ville</Label>
            <Input value={form.delivery_city} onChange={(e) => up("delivery_city", e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Étage</Label>
            <Input value={form.delivery_floor} onChange={(e) => up("delivery_floor", e.target.value)} className="h-9 text-sm" placeholder="RDC, 3e…" />
          </div>
          <div>
            <Label className="text-xs">Accès</Label>
            <Input value={form.delivery_access} onChange={(e) => up("delivery_access", e.target.value)} className="h-9 text-sm" placeholder="Digicode, portail…" />
          </div>
          <div className="col-span-2 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Checkbox id="dl-elev" checked={form.delivery_elevator} onCheckedChange={(v) => up("delivery_elevator", !!v)} />
              <label htmlFor="dl-elev" className="text-xs">Ascenseur</label>
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox id="dl-park" checked={form.delivery_parking_request} onCheckedChange={(v) => up("delivery_parking_request", !!v)} />
              <label htmlFor="dl-park" className="text-xs">Stationnement</label>
            </div>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Observations</Label>
            <Textarea value={form.delivery_comments} onChange={(e) => up("delivery_comments", e.target.value)} className="min-h-[50px] text-sm resize-none" placeholder="Contraintes, observations…" />
          </div>
        </div>
      </TabsContent>

      {/* ── Consignes ── */}
      <TabsContent value="instructions" className="mt-2 space-y-3">
        <div>
          <Label className="text-xs font-medium">Consignes / Mode opératoire</Label>
          <Textarea value={form.instructions} onChange={(e) => up("instructions", e.target.value)} placeholder="Mode opératoire, consignes de sécurité…" className="min-h-[100px] text-sm mt-1 resize-none" />
        </div>
        <div>
          <Label className="text-xs font-medium">Notes internes</Label>
          <Textarea value={form.notes} onChange={(e) => up("notes", e.target.value)} placeholder="Notes internes, rappels…" className="min-h-[60px] text-sm mt-1 resize-none" />
        </div>
      </TabsContent>
    </Tabs>
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Nouvelle opération</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1">
            <OperationFormContent form={form} setForm={setForm} fillDepot={fillDepot} isMobile={isMobile} />
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Modifier Op. {editingOpNum}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1">
            <OperationFormContent form={form} setForm={setForm} fillDepot={fillDepot} isMobile={isMobile} />
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
    </div>
  );
};
