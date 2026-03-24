import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Warehouse, X, Loader2, ExternalLink, Trash2, Eye } from "lucide-react";
import { generateBTReportPdf } from "@/lib/generateBTReportPdf";
import { BTReportPreviewDialog } from "@/components/terrain/BTReportPreviewDialog";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { MaterielListDisplay } from "@/components/MaterielListDisplay";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationId: string | null;
}

const DEPOT_ADDRESS = { address: "12 rue Jean Monnet", postal_code: "95190", city: "Goussainville" };
const OP_TYPES = ["B.T.", "Opérat°", "Livraison", "Enlèvement"];

const emptyForm = () => ({
  type: "B.T.",
  loading_date: "", loading_city: "", loading_address: "", loading_postal_code: "",
  loading_floor: "", loading_access: "", loading_elevator: false, loading_parking_request: false,
  loading_comments: "", loading_time_start: "", loading_time_end: "",
  loading_portage: "0", loading_passage_fenetre: false, loading_monte_meubles: false, loading_transbordement: false,
  delivery_city: "", delivery_address: "", delivery_postal_code: "",
  delivery_floor: "", delivery_access: "", delivery_elevator: false, delivery_parking_request: false,
  delivery_comments: "", delivery_date: "", delivery_time_start: "", delivery_time_end: "",
  delivery_portage: "0", delivery_passage_fenetre: false, delivery_monte_meubles: false, delivery_transbordement: false,
  lv_bt_number: "", volume: "", weight: "", notes: "", instructions: "",
});

type OpForm = ReturnType<typeof emptyForm>;

const AddressBlock = ({
  title, prefix, form, setForm, fillDepot,
}: {
  title: string; prefix: "loading" | "delivery"; form: OpForm;
  setForm: (f: OpForm) => void; fillDepot: (p: "loading" | "delivery") => void;
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
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-[10px] text-muted-foreground">Date</Label><Input type="date" value={f("date")} onChange={(e) => up(`${prefix}_date`, e.target.value)} className="h-7 text-xs" /></div>
        <div><Label className="text-[10px] text-muted-foreground">Début</Label><Input type="time" value={f("time_start")} onChange={(e) => up(`${prefix}_time_start`, e.target.value)} className="h-7 text-xs" /></div>
        <div><Label className="text-[10px] text-muted-foreground">Fin</Label><Input type="time" value={f("time_end")} onChange={(e) => up(`${prefix}_time_end`, e.target.value)} className="h-7 text-xs" /></div>
      </div>
      <div><Label className="text-[10px] text-muted-foreground">Adresse</Label><Input value={f("address")} onChange={(e) => up(`${prefix}_address`, e.target.value)} className="h-7 text-xs" /></div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-[10px] text-muted-foreground">CP</Label><Input value={f("postal_code")} onChange={(e) => up(`${prefix}_postal_code`, e.target.value)} className="h-7 text-xs" /></div>
        <div className="col-span-2"><Label className="text-[10px] text-muted-foreground">Ville</Label><Input value={f("city")} onChange={(e) => up(`${prefix}_city`, e.target.value)} className="h-7 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-[10px] text-muted-foreground">Étage</Label><Input value={f("floor")} onChange={(e) => up(`${prefix}_floor`, e.target.value)} className="h-7 text-xs" placeholder="RDC, 3e…" /></div>
        <div><Label className="text-[10px] text-muted-foreground">Portage</Label><Input type="number" value={f("portage")} onChange={(e) => up(`${prefix}_portage`, e.target.value)} className="h-7 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {[
          { key: "elevator", label: "Ascenseur" },
          { key: "passage_fenetre", label: "Passage fenêtre" },
          { key: "monte_meubles", label: "Monte-meubles" },
          { key: "transbordement", label: "Transbordement" },
          { key: "parking_request", label: "Stationnement" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <Checkbox id={`plan-${prefix}-${key}`} checked={!!f(key)} onCheckedChange={(v) => up(`${prefix}_${key}`, !!v)} />
            <label htmlFor={`plan-${prefix}-${key}`} className="text-[10px]">{label}</label>
          </div>
        ))}
      </div>
      <div><Label className="text-[10px] text-muted-foreground">Accès</Label><Input value={f("access")} onChange={(e) => up(`${prefix}_access`, e.target.value)} className="h-7 text-xs" placeholder="Digicode, portail…" /></div>
      <div><Label className="text-[10px] text-muted-foreground">Observations</Label><Textarea value={f("comments")} onChange={(e) => up(`${prefix}_comments`, e.target.value)} className="min-h-[40px] text-xs resize-none" /></div>
    </div>
  );
};

export const PlanningOperationDialog = ({ open, onOpenChange, operationId }: Props) => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [form, setForm] = useState<OpForm>(emptyForm());

  // Fetch the operation
  const { data: operation } = useQuery({
    queryKey: ["planning-op-detail", operationId],
    queryFn: async () => {
      if (!operationId) return null;
      const { data, error } = await supabase
        .from("operations")
        .select("*, dossiers(id, title, code, clients(name)), companies(id)")
        .eq("id", operationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!operationId && open,
  });

  // Fetch resources for this op
  const { data: opResources = [] } = useQuery({
    queryKey: ["planning-op-resources", operationId],
    queryFn: async () => {
      if (!operationId) return [];
      const { data } = await supabase
        .from("operation_resources")
        .select("*, resources!left(id, name, type)")
        .eq("operation_id", operationId);
      return data || [];
    },
    enabled: !!operationId && open,
  });

  // Available resources
  const { data: availableResources = [] } = useQuery({
    queryKey: ["planning-op-avail-resources", operation?.company_id],
    queryFn: async () => {
      if (!operation?.company_id) return [];
      const { data } = await supabase
        .from("resource_companies")
        .select("resource_id, resources!inner(id, name, type)")
        .eq("company_id", operation.company_id);
      return (data || []).map((rc: any) => rc.resources);
    },
    enabled: !!operation?.company_id && open,
  });

  useEffect(() => {
    if (operation) {
      setForm({
        type: operation.type || "B.T.",
        loading_date: operation.loading_date || "",
        loading_city: operation.loading_city || "",
        loading_address: operation.loading_address || "",
        loading_postal_code: operation.loading_postal_code || "",
        loading_floor: operation.loading_floor || "",
        loading_access: operation.loading_access || "",
        loading_elevator: operation.loading_elevator || false,
        loading_parking_request: operation.loading_parking_request || false,
        loading_comments: operation.loading_comments || "",
        loading_time_start: operation.loading_time_start || "",
        loading_time_end: operation.loading_time_end || "",
        loading_portage: String(operation.loading_portage ?? 0),
        loading_passage_fenetre: operation.loading_passage_fenetre || false,
        loading_monte_meubles: operation.loading_monte_meubles || false,
        loading_transbordement: operation.loading_transbordement || false,
        delivery_city: operation.delivery_city || "",
        delivery_address: operation.delivery_address || "",
        delivery_postal_code: operation.delivery_postal_code || "",
        delivery_floor: operation.delivery_floor || "",
        delivery_access: operation.delivery_access || "",
        delivery_elevator: operation.delivery_elevator || false,
        delivery_parking_request: operation.delivery_parking_request || false,
        delivery_comments: operation.delivery_comments || "",
        delivery_date: operation.delivery_date || "",
        delivery_time_start: operation.delivery_time_start || "",
        delivery_time_end: operation.delivery_time_end || "",
        delivery_portage: String(operation.delivery_portage ?? 0),
        delivery_passage_fenetre: operation.delivery_passage_fenetre || false,
        delivery_monte_meubles: operation.delivery_monte_meubles || false,
        delivery_transbordement: operation.delivery_transbordement || false,
        lv_bt_number: operation.lv_bt_number || "",
        volume: String(operation.volume ?? ""),
        weight: String(operation.weight ?? ""),
        notes: operation.notes || "",
        instructions: operation.instructions || "",
      });
    }
  }, [operation]);

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

  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [btPreviewOpen, setBtPreviewOpen] = useState(false);
  const { dbCompanies } = useCompany();
  const companyIds = dbCompanies.map(c => c.id);

  // Suppliers queries
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-active", operation?.company_id],
    queryFn: async () => {
      if (!operation?.company_id) return [];
      const { data } = await supabase
        .from("suppliers")
        .select("id, name, category, daily_rate, hourly_rate")
        .eq("company_id", operation.company_id)
        .eq("status", "actif");
      return data || [];
    },
    enabled: !!operation?.company_id && open,
  });

  const { data: assignedSuppliers = [] } = useQuery({
    queryKey: ["operation-suppliers", operationId],
    queryFn: async () => {
      if (!operationId) return [];
      const { data } = await supabase
        .from("operation_suppliers")
        .select("*, suppliers(name, category)")
        .eq("operation_id", operationId);
      return data || [];
    },
    enabled: !!operationId && open,
  });

  const assignSupplier = useMutation({
    mutationFn: async (supplierId: string) => {
      const { error } = await supabase.from("operation_suppliers").insert({
        operation_id: operationId!,
        supplier_id: supplierId,
        company_id: operation!.company_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operation-suppliers", operationId] });
      toast.success("Sous-traitant ajouté");
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const removeSupplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("operation_suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operation-suppliers", operationId] });
      toast.success("Sous-traitant retiré");
    },
  });

  const assignedSupplierIds = assignedSuppliers.map((as: any) => as.supplier_id);
  const unassignedSuppliers = suppliers.filter((s: any) => !assignedSupplierIds.includes(s.id));

  const handleDeleteOp = async () => {
    if (!operationId) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try {
      await supabase.from("operation_resources").delete().eq("operation_id", operationId);
      const { error } = await supabase.from("operations").delete().eq("id", operationId);
      if (error) throw error;
      toast.success("Opération supprimée");
      queryClient.invalidateQueries({ queryKey: ["planning-operations"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-operations"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-operations-count"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur de suppression");
    } finally {
      setDeleting(false);
      setConfirmDel(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!operationId) return;
      const { error } = await (supabase.from("operations") as any).update(formToPayload(form)).eq("id", operationId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Opération mise à jour");
      queryClient.invalidateQueries({ queryKey: ["planning-operations"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-operations"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-operations-count"] });
      onOpenChange(false);

      // Send push notifications to assigned resources
      if (operationId) {
        try {
          const { data: orData } = await supabase
            .from("operation_resources")
            .select("resources(linked_profile_id, name)")
            .eq("operation_id", operationId);

          for (const or of orData || []) {
            const profileId = (or.resources as any)?.linked_profile_id;
            if (profileId) {
              await supabase.functions.invoke("send-push-notification", {
                body: {
                  user_id: profileId,
                  title: "🏗️ Mission mise à jour",
                  body: `${form.loading_city || "Chantier"} → ${form.delivery_city || ""} le ${form.loading_date}`,
                  link: "/terrain",
                },
              });
            }
          }
        } catch (e) {
          console.error("Push notification error:", e);
        }
      }
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const addResourceToOp = useMutation({
    mutationFn: async ({ resourceId }: { resourceId: string }) => {
      if (!operationId) return;
      const { error } = await supabase.from("operation_resources").insert({ operation_id: operationId, resource_id: resourceId } as any);
      if (error) throw error;
      return resourceId;
    },
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["planning-op-resources"] });
      queryClient.invalidateQueries({ queryKey: ["planning-operations"] });
      toast.success("Ressource affectée");

      // Send push to newly assigned resource
      try {
        const { data: resData } = await supabase
          .from("resources")
          .select("linked_profile_id, name")
          .eq("id", variables.resourceId)
          .maybeSingle();
        if (resData?.linked_profile_id) {
          await supabase.functions.invoke("send-push-notification", {
            body: {
              user_id: resData.linked_profile_id,
              title: "🏗️ Nouvelle mission assignée",
              body: `${form.loading_city || "Chantier"} → ${form.delivery_city || ""} le ${form.loading_date}`,
              link: "/terrain",
            },
          });
        }
      } catch (e) {
        console.error("Push notification error:", e);
      }
    },
    onError: (e: any) => toast.error(e.message?.includes("duplicate") ? "Déjà affecté" : "Erreur"),
  });

  const removeResourceFromOp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("operation_resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planning-op-resources"] });
      queryClient.invalidateQueries({ queryKey: ["planning-operations"] });
      toast.success("Ressource retirée");
    },
  });

  const fillDepot = (prefix: "loading" | "delivery") => {
    setForm({
      ...form,
      [`${prefix}_address`]: DEPOT_ADDRESS.address,
      [`${prefix}_postal_code`]: DEPOT_ADDRESS.postal_code,
      [`${prefix}_city`]: DEPOT_ADDRESS.city,
    } as any);
  };

  const assignedIds = opResources.map((ar: any) => ar.resource_id);
  const unassigned = availableResources.filter((r: any) => !assignedIds.includes(r.id));
  const vehicles = opResources.filter((ar: any) => ["vehicule", "vehicle", "grue"].includes(ar.resources?.type));
  const personnel = opResources.filter((ar: any) => ["employe", "equipe", "personnel", "person"].includes(ar.resources?.type));
  const unassignedVehicles = unassigned.filter((r: any) => ["vehicule", "vehicle", "grue"].includes(r.type));
  const unassignedPersonnel = unassigned.filter((r: any) => ["employe", "equipe", "personnel", "person"].includes(r.type));

  const dossierInfo = operation?.dossiers as any;
  const up = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Modifier Op. {operation?.operation_number || ""}
            {dossierInfo && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1 text-muted-foreground"
                onClick={() => { onOpenChange(false); navigate(`/dossiers/${dossierInfo.id}`); }}
              >
                <ExternalLink className="h-3 w-3" />
                {dossierInfo.code || dossierInfo.title} — {dossierInfo.clients?.name}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* Header row */}
          <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}>
            <div>
              <Label className="text-[10px] text-muted-foreground">Type</Label>
              <select value={form.type} onChange={(e) => up("type", e.target.value)} className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs">
                {OP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><Label className="text-[10px] text-muted-foreground">N° LV/BT</Label><Input value={form.lv_bt_number} onChange={(e) => up("lv_bt_number", e.target.value)} className="h-7 text-xs" /></div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Poids (t)</Label>
              <Input type="number" value={form.weight} onChange={(e) => up("weight", e.target.value)} className="h-7 text-xs" />
            </div>
          </div>

          {/* Liste matériel */}
          <MaterielListDisplay dossierId={operation?.dossier_id} compact />

          {/* Chargement / Livraison */}
          <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
            <AddressBlock title="Chargement" prefix="loading" form={form} setForm={setForm} fillDepot={fillDepot} />
            <AddressBlock title="Livraison" prefix="delivery" form={form} setForm={setForm} fillDepot={fillDepot} />
          </div>

          {/* Consignes + Notes */}
          <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
            <div>
              <Label className="text-[10px] text-muted-foreground font-medium">Consignes / Mode opératoire</Label>
              <Textarea value={form.instructions} onChange={(e) => up("instructions", e.target.value)} placeholder="Mode opératoire, consignes de sécurité…" className="min-h-[60px] text-xs mt-1 resize-none" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground font-medium">Commentaires</Label>
              <Textarea value={form.notes} onChange={(e) => up("notes", e.target.value)} placeholder="Notes internes…" className="min-h-[60px] text-xs mt-1 resize-none" />
          </div>

          {/* Sous-traitants */}
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Sous-traitants</h4>
            {assignedSuppliers.length > 0 && (
              <div className="space-y-1">
                {assignedSuppliers.map((as: any) => (
                  <div key={as.id} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium truncate">{as.suppliers?.name || "—"}</span>
                      {as.suppliers?.category && (
                        <span className="text-[10px] text-muted-foreground shrink-0">{as.suppliers.category}</span>
                      )}
                    </div>
                    <button onClick={() => removeSupplier.mutate(as.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {unassignedSuppliers.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {unassignedSuppliers.map((s: any) => (
                  <button key={s.id} onClick={() => assignSupplier.mutate(s.id)}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    + {s.name} {s.daily_rate ? `(${s.daily_rate}€/j)` : ""}
                  </button>
                ))}
              </div>
            )}
            {assignedSuppliers.length === 0 && unassignedSuppliers.length === 0 && (
              <p className="text-[10px] text-muted-foreground">Aucun sous-traitant actif</p>
            )}
          </div>
        </div>

          {/* Resources */}
          <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Véhicules réservés</h4>
              {vehicles.length > 0 && (
                <div className="space-y-1">
                  {vehicles.map((ar: any) => (
                    <div key={ar.id} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1">
                      <span className="text-xs font-medium">{ar.resources?.name || "—"}</span>
                      <button onClick={() => removeResourceFromOp.mutate(ar.id)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              {unassignedVehicles.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {unassignedVehicles.map((r: any) => (
                    <button key={r.id} onClick={() => addResourceToOp.mutate({ resourceId: r.id })}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                      + {r.name}
                    </button>
                  ))}
                </div>
              )}
              {vehicles.length === 0 && unassignedVehicles.length === 0 && <p className="text-[10px] text-muted-foreground">Aucun véhicule disponible</p>}
            </div>
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Personnel réservé</h4>
              {personnel.length > 0 && (
                <div className="space-y-1">
                  {personnel.map((ar: any) => (
                    <div key={ar.id} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1">
                      <span className="text-xs font-medium">{ar.resources?.name || "—"}</span>
                      <button onClick={() => removeResourceFromOp.mutate(ar.id)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              {unassignedPersonnel.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {unassignedPersonnel.map((r: any) => (
                    <button key={r.id} onClick={() => addResourceToOp.mutate({ resourceId: r.id })}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                      + {r.name}
                    </button>
                  ))}
                </div>
              )}
              {personnel.length === 0 && unassignedPersonnel.length === 0 && <p className="text-[10px] text-muted-foreground">Aucun personnel disponible</p>}
            </div>
          </div>
        </div>

        <div className="flex justify-between gap-2 pt-3 border-t">
          <Button variant="destructive" size="sm" className="gap-1" onClick={handleDeleteOp} disabled={updateMutation.isPending || deleting}>
            <Trash2 className="h-3.5 w-3.5" /> {confirmDel ? "Confirmer ?" : "Supprimer"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setBtPreviewOpen(true)}>
              <Eye className="h-3.5 w-3.5" /> Aperçu
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Enregistrement…</> : "Enregistrer"}
            </Button>
          </div>
        </div>
        {operationId && btPreviewOpen && (
          <BTReportPreviewDialog
            open={btPreviewOpen}
            onOpenChange={setBtPreviewOpen}
            btId={operationId}
            companyIds={companyIds}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
