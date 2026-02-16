import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

const TYPES = [
  { value: "utilitaire", label: "Utilitaire" },
  { value: "camion", label: "Camion" },
  { value: "semi", label: "Semi" },
  { value: "grue_mobile", label: "Grue mobile" },
  { value: "bras_de_grue", label: "Bras de grue" },
  { value: "nacelle", label: "Nacelle" },
  { value: "chariot", label: "Chariot" },
  { value: "palan", label: "Palan" },
  { value: "autre", label: "Autre" },
];

interface Props {
  visiteId: string;
  companyId: string;
}

export const VisiteVehiculesTab = ({ visiteId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const [newV, setNewV] = useState({ type: "utilitaire" as string, label: "", height: "", reach: "", capacity: "", road_constraints: "", notes: "" });

  const { data: vehicules = [] } = useQuery({
    queryKey: ["visite-vehicules", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("visite_vehicules").select("*").eq("visite_id", visiteId).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("visite_vehicules").insert({
        visite_id: visiteId,
        company_id: companyId,
        type: newV.type as any,
        label: newV.label || null,
        height: newV.height ? Number(newV.height) : null,
        reach: newV.reach ? Number(newV.reach) : null,
        capacity: newV.capacity ? Number(newV.capacity) : null,
        road_constraints: newV.road_constraints || null,
        notes: newV.notes || null,
        sort_order: vehicules.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Véhicule/Engin ajouté");
      setNewV({ type: "utilitaire", label: "", height: "", reach: "", capacity: "", road_constraints: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["visite-vehicules", visiteId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("visite_vehicules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supprimé");
      queryClient.invalidateQueries({ queryKey: ["visite-vehicules", visiteId] });
    },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Ajouter véhicule / engin</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Type *</Label>
            <select
              value={newV.type}
              onChange={(e) => setNewV((p) => ({ ...p, type: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Libellé</Label>
            <Input value={newV.label} onChange={(e) => setNewV((p) => ({ ...p, label: e.target.value }))} placeholder="Ex: Grue 50T" />
          </div>
          <div>
            <Label>Hauteur (m)</Label>
            <Input value={newV.height} onChange={(e) => setNewV((p) => ({ ...p, height: e.target.value }))} />
          </div>
          <div>
            <Label>Déport (m)</Label>
            <Input value={newV.reach} onChange={(e) => setNewV((p) => ({ ...p, reach: e.target.value }))} />
          </div>
          <div>
            <Label>Capacité (T)</Label>
            <Input value={newV.capacity} onChange={(e) => setNewV((p) => ({ ...p, capacity: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Contraintes voirie</Label>
            <Input value={newV.road_constraints} onChange={(e) => setNewV((p) => ({ ...p, road_constraints: e.target.value }))} placeholder="Stationnement, autorisation..." />
          </div>
        </div>
        <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </Card>

      {vehicules.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicules.map((v: any) => (
            <Card key={v.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    {TYPES.find((t) => t.value === v.type)?.label || v.type}
                    {v.label && <span className="text-muted-foreground font-normal">— {v.label}</span>}
                  </h4>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {v.height && <p>Hauteur : {v.height}m</p>}
                    {v.reach && <p>Déport : {v.reach}m</p>}
                    {v.capacity && <p>Capacité : {v.capacity}T</p>}
                    {v.road_constraints && <p>Voirie : {v.road_constraints}</p>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => del.mutate(v.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
