import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Save, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface Props {
  visiteId: string;
  companyId: string;
}

export const VisiteContraintesTab = ({ visiteId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const [data, setData] = useState<any>(null);

  const { data: contrainte } = useQuery({
    queryKey: ["visite-contraintes", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("visite_contraintes").select("*").eq("visite_id", visiteId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (contrainte) setData({ ...contrainte });
    else setData({ door_width: "", stairs: "", freight_elevator: false, ramp: false, obstacles: "", authorizations: "", notes: "" });
  }, [contrainte]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data) return;
      if (contrainte) {
        const { id, created_at, updated_at, visite_id, company_id, ...rest } = data;
        const { error } = await supabase.from("visite_contraintes").update(rest).eq("id", contrainte.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("visite_contraintes").insert({
          visite_id: visiteId, company_id: companyId, ...data,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Contraintes enregistrées");
      queryClient.invalidateQueries({ queryKey: ["visite-contraintes", visiteId] });
    },
    onError: () => toast.error("Erreur"),
  });

  if (!data) return null;

  const upd = (field: string, value: any) => setData((p: any) => ({ ...p, [field]: value }));

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-primary flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Accès et contraintes</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label>Largeur portes</Label>
            <Input value={data.door_width || ""} onChange={(e) => upd("door_width", e.target.value)} placeholder="80cm, 120cm..." />
          </div>
          <div>
            <Label>Escaliers</Label>
            <Input value={data.stairs || ""} onChange={(e) => upd("stairs", e.target.value)} placeholder="2 étages, étroit..." />
          </div>
          <div className="flex flex-col gap-3 pt-5">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={data.freight_elevator || false} onCheckedChange={(v) => upd("freight_elevator", v)} />
              Monte-charge
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={data.ramp || false} onCheckedChange={(v) => upd("ramp", v)} />
              Rampe d'accès
            </label>
          </div>
        </div>
        <div>
          <Label>Obstacles</Label>
          <Textarea value={data.obstacles || ""} onChange={(e) => upd("obstacles", e.target.value)} rows={3} placeholder="Arbres, câbles, mobilier urbain..." />
        </div>
        <div>
          <Label>Autorisations nécessaires</Label>
          <Textarea value={data.authorizations || ""} onChange={(e) => upd("authorizations", e.target.value)} rows={2} placeholder="Arrêté voirie, autorisation copro..." />
        </div>
        <div>
          <Label>Notes complémentaires</Label>
          <Textarea value={data.notes || ""} onChange={(e) => upd("notes", e.target.value)} rows={3} />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Enregistrer
        </Button>
      </Card>
    </div>
  );
};
