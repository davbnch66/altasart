import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronRight, Check, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";

interface Props {
  dossierId: string;
  companyId: string;
}

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
};

export const DossierOperationsTab = ({ dossierId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
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

  // Fetch operation_resources for all operations
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

  // Fetch available resources for assignment
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

  const addMutation = useMutation({
    mutationFn: async () => {
      const nextNum = operations.length + 1;
      const { error } = await supabase.from("operations").insert({
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
      });
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
                <option value="B.T.">B.T.</option>
                <option value="Opérat°">Opérat°</option>
                <option value="Livraison">Livraison</option>
                <option value="Enlèvement">Enlèvement</option>
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
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isMobile ? "text-xs" : "text-sm"} ${op.completed ? "line-through text-muted-foreground" : ""}`}>
                    Op. {op.operation_number} — {op.type}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(op.loading_date)} · {op.loading_city || "—"} → {op.delivery_city || "—"}
                    {op.lv_bt_number && ` · LV/BT: ${op.lv_bt_number}`}
                    {op.factures?.code && ` · Fact: ${op.factures.code}`}
                  </p>
                </div>
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

              {/* Assigned resources badges */}
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

              {/* Resource assignment dropdown */}
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
