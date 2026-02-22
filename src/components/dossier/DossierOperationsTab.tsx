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
import { Plus, Trash2, Check, Users, X, Pencil, Save, MessageSquare, Warehouse, MapPin, ClipboardList, FileText } from "lucide-react";
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

export const DossierOperationsTab = ({ dossierId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    type: "B.T.",
    loading_date: "",
    loading_city: "",
    delivery_city: "",
    lv_bt_number: "",
    volume: "",
  });
  const [editingResources, setEditingResources] = useState<string | null>(null);
  const [editingOp, setEditingOp] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

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

  // Fetch dossier data for pre-filling
  const { data: dossier } = useQuery({
    queryKey: ["dossier-for-ops", dossierId],
    queryFn: async () => {
      const { data } = await supabase.from("dossiers").select("loading_address, loading_postal_code, loading_city, loading_floor, loading_access, loading_elevator, loading_parking_request, loading_comments, delivery_address, delivery_postal_code, delivery_city, delivery_floor, delivery_access, delivery_elevator, delivery_parking_request, delivery_comments").eq("id", dossierId).single();
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const nextNum = operations.length + 1;
      const insertData: Record<string, any> = {
        dossier_id: dossierId,
        company_id: companyId,
        operation_number: nextNum,
        type: form.type,
        loading_date: form.loading_date || null,
        loading_city: form.loading_city || null,
        delivery_city: form.delivery_city || null,
        lv_bt_number: form.lv_bt_number || null,
        volume: form.volume ? Number(form.volume) : 0,
        sort_order: nextNum,
      };
      // Pre-fill from dossier
      if (dossier) {
        insertData.loading_address = dossier.loading_address || null;
        insertData.loading_postal_code = dossier.loading_postal_code || null;
        if (!form.loading_city && dossier.loading_city) insertData.loading_city = dossier.loading_city;
        insertData.loading_floor = dossier.loading_floor || null;
        insertData.loading_access = dossier.loading_access || null;
        insertData.loading_elevator = dossier.loading_elevator || false;
        insertData.loading_parking_request = dossier.loading_parking_request || false;
        insertData.loading_comments = dossier.loading_comments || null;
        insertData.delivery_address = dossier.delivery_address || null;
        insertData.delivery_postal_code = dossier.delivery_postal_code || null;
        if (!form.delivery_city && dossier.delivery_city) insertData.delivery_city = dossier.delivery_city;
        insertData.delivery_floor = dossier.delivery_floor || null;
        insertData.delivery_access = dossier.delivery_access || null;
        insertData.delivery_elevator = dossier.delivery_elevator || false;
        insertData.delivery_parking_request = dossier.delivery_parking_request || false;
        insertData.delivery_comments = dossier.delivery_comments || null;
      }
      const { error } = await (supabase.from("operations") as any).insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opération ajoutée");
      queryClient.invalidateQueries({ queryKey: ["dossier-operations"] });
      setAdding(false);
      setForm({ type: "B.T.", loading_date: "", loading_city: "", delivery_city: "", lv_bt_number: "", volume: "" });
    },
    onError: () => toast.error("Erreur"),
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const { error } = await (supabase.from("operations") as any).update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opération mise à jour");
      queryClient.invalidateQueries({ queryKey: ["dossier-operations"] });
      setEditingOp(null);
      setEditForm({});
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const addResourceToOp = useMutation({
    mutationFn: async ({ operationId, resourceId }: { operationId: string; resourceId: string }) => {
      const { error } = await supabase.from("operation_resources").insert({
        operation_id: operationId,
        resource_id: resourceId,
      } as any);
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

  const getResourcesForOp = (opId: string) =>
    opResources.filter((or: any) => or.operation_id === opId);

  const startEditing = (op: any) => {
    setEditingOp(op.id);
    setEditForm({
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
  };

  const saveEdit = () => {
    if (!editingOp) return;
    updateMutation.mutate({
      id: editingOp,
      data: {
        type: editForm.type,
        loading_date: editForm.loading_date || null,
        loading_city: editForm.loading_city?.trim() || null,
        loading_address: editForm.loading_address?.trim() || null,
        loading_postal_code: editForm.loading_postal_code?.trim() || null,
        loading_floor: editForm.loading_floor?.trim() || null,
        loading_access: editForm.loading_access?.trim() || null,
        loading_elevator: editForm.loading_elevator || false,
        loading_parking_request: editForm.loading_parking_request || false,
        loading_comments: editForm.loading_comments?.trim() || null,
        loading_time_start: editForm.loading_time_start || null,
        loading_time_end: editForm.loading_time_end || null,
        delivery_city: editForm.delivery_city?.trim() || null,
        delivery_address: editForm.delivery_address?.trim() || null,
        delivery_postal_code: editForm.delivery_postal_code?.trim() || null,
        delivery_floor: editForm.delivery_floor?.trim() || null,
        delivery_access: editForm.delivery_access?.trim() || null,
        delivery_elevator: editForm.delivery_elevator || false,
        delivery_parking_request: editForm.delivery_parking_request || false,
        delivery_comments: editForm.delivery_comments?.trim() || null,
        delivery_date: editForm.delivery_date || null,
        delivery_time_start: editForm.delivery_time_start || null,
        delivery_time_end: editForm.delivery_time_end || null,
        lv_bt_number: editForm.lv_bt_number?.trim() || null,
        volume: editForm.volume ? Number(editForm.volume) : 0,
        weight: editForm.weight ? Number(editForm.weight) : 0,
        notes: editForm.notes?.trim() || null,
        instructions: editForm.instructions?.trim() || null,
      },
    });
  };

  const fillDepot = (prefix: "loading" | "delivery") => {
    setEditForm({
      ...editForm,
      [`${prefix}_address`]: DEPOT_ADDRESS.address,
      [`${prefix}_postal_code`]: DEPOT_ADDRESS.postal_code,
      [`${prefix}_city`]: DEPOT_ADDRESS.city,
    });
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Chargement…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Opérations ({operations.length})</h3>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Nouvelle
        </Button>
      </div>

      {adding && (
        <div className={`rounded-xl border bg-card p-3 space-y-2 ${isMobile ? "" : "p-4"}`}>
          <div className={`grid gap-2 ${isMobile ? "grid-cols-2" : "grid-cols-3"}`}>
            <div>
              <label className="text-[10px] text-muted-foreground">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
              >
                {OP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Date chargement</label>
              <Input type="date" value={form.loading_date} onChange={(e) => setForm({ ...form, loading_date: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Ville chargement</label>
              <Input value={form.loading_city} onChange={(e) => setForm({ ...form, loading_city: e.target.value })} placeholder="NANTERRE" className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Ville livraison</label>
              <Input value={form.delivery_city} onChange={(e) => setForm({ ...form, delivery_city: e.target.value })} placeholder="BOIS D'ARCY" className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">N° LV/BT</label>
              <Input value={form.lv_bt_number} onChange={(e) => setForm({ ...form, lv_bt_number: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Volume (m³)</label>
              <Input type="number" value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Les adresses du dossier seront pré-remplies automatiquement.</p>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="text-xs">Annuler</Button>
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending} className="text-xs">Ajouter</Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card divide-y">
        {operations.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">Aucune opération</div>
        ) : operations.map((op: any) => {
          const assignedResources = getResourcesForOp(op.id);
          const isEditingThis = editingResources === op.id;
          const isEditMode = editingOp === op.id;
          const assignedIds = assignedResources.map((ar: any) => ar.resource_id);
          const unassigned = availableResources.filter((r: any) => !assignedIds.includes(r.id));

          return (
            <div key={op.id} className={`${isMobile ? "px-3 py-2.5" : "px-5 py-3"}`}>
              {/* View mode */}
              {!isEditMode && (
                <>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleComplete.mutate({ id: op.id, completed: op.completed })}
                      className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        op.completed ? "bg-success border-success text-success-foreground" : "border-muted-foreground/30 hover:border-primary"
                      }`}
                    >
                      {op.completed && <Check className="h-3 w-3" />}
                    </button>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEditing(op)}>
                      <p className={`font-medium truncate ${isMobile ? "text-xs" : "text-sm"} ${op.completed ? "line-through text-muted-foreground" : ""}`}>
                        Op. {op.operation_number} — {op.type}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(op.loading_date)} · {op.loading_city || "—"} → {op.delivery_city || "—"}
                        {op.lv_bt_number && ` · LV/BT: ${op.lv_bt_number}`}
                        {op.factures?.code && ` · Fact: ${op.factures.code}`}
                      </p>
                    </div>
                    <button onClick={() => startEditing(op)} className="p-1 rounded text-muted-foreground hover:text-primary transition-colors shrink-0" title="Modifier">
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

                  {/* Notes / consignes preview */}
                  {(op.notes || op.instructions) && (
                    <div className="ml-8 mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{op.instructions || op.notes}</span>
                    </div>
                  )}
                </>
              )}

              {/* ══════ Edit mode with tabs ══════ */}
              {isEditMode && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">Modifier Op. {op.operation_number}</p>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingOp(null); setEditForm({}); }}>
                        Annuler
                      </Button>
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={saveEdit} disabled={updateMutation.isPending}>
                        <Save className="h-3 w-3" /> Enregistrer
                      </Button>
                    </div>
                  </div>

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
                      <div className={`grid gap-2 ${isMobile ? "grid-cols-2" : "grid-cols-3"}`}>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Type</label>
                          <select
                            value={editForm.type}
                            onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
                          >
                            {OP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">N° LV/BT</label>
                          <Input value={editForm.lv_bt_number} onChange={(e) => setEditForm({ ...editForm, lv_bt_number: e.target.value })} className="h-8 text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Volume (m³)</label>
                          <Input type="number" value={editForm.volume} onChange={(e) => setEditForm({ ...editForm, volume: e.target.value })} className="h-8 text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Poids (t)</label>
                          <Input type="number" value={editForm.weight} onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })} className="h-8 text-xs" />
                        </div>
                      </div>
                    </TabsContent>

                    {/* ── Chargement ── */}
                    <TabsContent value="loading" className="mt-2">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-primary">Chargement</Label>
                          <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => fillDepot("loading")}>
                            <Warehouse className="h-3 w-3" /> Dépôt
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Date</label>
                            <Input type="date" value={editForm.loading_date} onChange={(e) => setEditForm({ ...editForm, loading_date: e.target.value })} className="h-8 text-xs" />
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <div>
                              <label className="text-[10px] text-muted-foreground">Début</label>
                              <Input type="time" value={editForm.loading_time_start} onChange={(e) => setEditForm({ ...editForm, loading_time_start: e.target.value })} className="h-8 text-xs" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Fin</label>
                              <Input type="time" value={editForm.loading_time_end} onChange={(e) => setEditForm({ ...editForm, loading_time_end: e.target.value })} className="h-8 text-xs" />
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-muted-foreground">Adresse</label>
                            <Input value={editForm.loading_address} onChange={(e) => setEditForm({ ...editForm, loading_address: e.target.value })} className="h-8 text-xs" placeholder="Adresse de chargement" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Code postal</label>
                            <Input value={editForm.loading_postal_code} onChange={(e) => setEditForm({ ...editForm, loading_postal_code: e.target.value })} className="h-8 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Ville</label>
                            <Input value={editForm.loading_city} onChange={(e) => setEditForm({ ...editForm, loading_city: e.target.value })} className="h-8 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Étage</label>
                            <Input value={editForm.loading_floor} onChange={(e) => setEditForm({ ...editForm, loading_floor: e.target.value })} className="h-8 text-xs" placeholder="RDC, 3e…" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Accès</label>
                            <Input value={editForm.loading_access} onChange={(e) => setEditForm({ ...editForm, loading_access: e.target.value })} className="h-8 text-xs" placeholder="Digicode, portail…" />
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <Checkbox
                                id="loading-elevator-edit"
                                checked={editForm.loading_elevator}
                                onCheckedChange={(v) => setEditForm({ ...editForm, loading_elevator: !!v })}
                              />
                              <label htmlFor="loading-elevator-edit" className="text-[10px]">Ascenseur</label>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Checkbox
                                id="loading-parking-edit"
                                checked={editForm.loading_parking_request}
                                onCheckedChange={(v) => setEditForm({ ...editForm, loading_parking_request: !!v })}
                              />
                              <label htmlFor="loading-parking-edit" className="text-[10px]">Stationnement</label>
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-muted-foreground">Observations chargement</label>
                            <Textarea value={editForm.loading_comments} onChange={(e) => setEditForm({ ...editForm, loading_comments: e.target.value })} className="min-h-[50px] text-xs resize-none" placeholder="Contraintes, observations…" />
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* ── Livraison ── */}
                    <TabsContent value="delivery" className="mt-2">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-primary">Livraison</Label>
                          <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => fillDepot("delivery")}>
                            <Warehouse className="h-3 w-3" /> Dépôt
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Date livraison</label>
                            <Input type="date" value={editForm.delivery_date} onChange={(e) => setEditForm({ ...editForm, delivery_date: e.target.value })} className="h-8 text-xs" />
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <div>
                              <label className="text-[10px] text-muted-foreground">Début</label>
                              <Input type="time" value={editForm.delivery_time_start} onChange={(e) => setEditForm({ ...editForm, delivery_time_start: e.target.value })} className="h-8 text-xs" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Fin</label>
                              <Input type="time" value={editForm.delivery_time_end} onChange={(e) => setEditForm({ ...editForm, delivery_time_end: e.target.value })} className="h-8 text-xs" />
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-muted-foreground">Adresse</label>
                            <Input value={editForm.delivery_address} onChange={(e) => setEditForm({ ...editForm, delivery_address: e.target.value })} className="h-8 text-xs" placeholder="Adresse de livraison" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Code postal</label>
                            <Input value={editForm.delivery_postal_code} onChange={(e) => setEditForm({ ...editForm, delivery_postal_code: e.target.value })} className="h-8 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Ville</label>
                            <Input value={editForm.delivery_city} onChange={(e) => setEditForm({ ...editForm, delivery_city: e.target.value })} className="h-8 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Étage</label>
                            <Input value={editForm.delivery_floor} onChange={(e) => setEditForm({ ...editForm, delivery_floor: e.target.value })} className="h-8 text-xs" placeholder="RDC, 3e…" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Accès</label>
                            <Input value={editForm.delivery_access} onChange={(e) => setEditForm({ ...editForm, delivery_access: e.target.value })} className="h-8 text-xs" placeholder="Digicode, portail…" />
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <Checkbox
                                id="delivery-elevator-edit"
                                checked={editForm.delivery_elevator}
                                onCheckedChange={(v) => setEditForm({ ...editForm, delivery_elevator: !!v })}
                              />
                              <label htmlFor="delivery-elevator-edit" className="text-[10px]">Ascenseur</label>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Checkbox
                                id="delivery-parking-edit"
                                checked={editForm.delivery_parking_request}
                                onCheckedChange={(v) => setEditForm({ ...editForm, delivery_parking_request: !!v })}
                              />
                              <label htmlFor="delivery-parking-edit" className="text-[10px]">Stationnement</label>
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-muted-foreground">Observations livraison</label>
                            <Textarea value={editForm.delivery_comments} onChange={(e) => setEditForm({ ...editForm, delivery_comments: e.target.value })} className="min-h-[50px] text-xs resize-none" placeholder="Contraintes, observations…" />
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* ── Consignes ── */}
                    <TabsContent value="instructions" className="mt-2 space-y-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">Consignes / Mode opératoire</label>
                        <Textarea
                          value={editForm.instructions}
                          onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })}
                          placeholder="Mode opératoire, consignes de sécurité, procédures spécifiques…"
                          className="min-h-[100px] text-xs mt-1 resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">Notes internes</label>
                        <Textarea
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          placeholder="Notes internes, rappels…"
                          className="min-h-[60px] text-xs mt-1 resize-none"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {/* Assigned resources badges */}
              {assignedResources.length > 0 && !isEditMode && (
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

              {/* Resource assignment dropdown */}
              {isEditingThis && !isEditMode && unassigned.length > 0 && (
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
