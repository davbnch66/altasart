import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  visiteId: string;
  companyId: string;
}

export const MobileContraintesSheet = ({ open, onClose, visiteId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const [data, setData] = useState<any>(null);

  const { data: contrainte } = useQuery({
    queryKey: ["visite-contraintes", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_contraintes").select("*").eq("visite_id", visiteId).maybeSingle();
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (contrainte) setData({ ...contrainte });
    else if (open) setData({ door_width: "", stairs: "", freight_elevator: false, ramp: false, obstacles: "", authorizations: "", notes: "" });
  }, [contrainte, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data) return;
      if (contrainte) {
        const { id, created_at, updated_at, visite_id, company_id, ...rest } = data;
        await supabase.from("visite_contraintes").update(rest).eq("id", contrainte.id);
      } else {
        await supabase.from("visite_contraintes").insert({ visite_id: visiteId, company_id: companyId, ...data });
      }
    },
    onSuccess: () => {
      toast.success("Contraintes enregistrées ✓");
      queryClient.invalidateQueries({ queryKey: ["visite-contraintes", visiteId] });
      onClose();
    },
    onError: () => toast.error("Erreur"),
  });

  if (!data) return null;

  const upd = (f: string, v: any) => setData((p: any) => ({ ...p, [f]: v }));

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto pb-safe">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">🚧 Accès & Contraintes</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium mb-1">Largeur portes</p>
              <Input value={data.door_width || ""} onChange={(e) => upd("door_width", e.target.value)} placeholder="80cm..." className="h-12 text-base rounded-xl" />
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Escaliers</p>
              <Input value={data.stairs || ""} onChange={(e) => upd("stairs", e.target.value)} placeholder="2 étages..." className="h-12 text-base rounded-xl" />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2.5 text-sm bg-card rounded-xl border px-4 py-3">
              <Checkbox checked={data.freight_elevator || false} onCheckedChange={(v) => upd("freight_elevator", v)} className="h-5 w-5" />
              Monte-charge
            </label>
            <label className="flex items-center gap-2.5 text-sm bg-card rounded-xl border px-4 py-3">
              <Checkbox checked={data.ramp || false} onCheckedChange={(v) => upd("ramp", v)} className="h-5 w-5" />
              Rampe d'accès
            </label>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Obstacles</p>
            <Textarea
              value={data.obstacles || ""}
              onChange={(e) => upd("obstacles", e.target.value)}
              rows={3}
              placeholder="Arbres, câbles, mobilier urbain..."
              className="text-base rounded-xl"
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Autorisations nécessaires</p>
            <Textarea
              value={data.authorizations || ""}
              onChange={(e) => upd("authorizations", e.target.value)}
              rows={2}
              placeholder="Arrêté voirie, autorisation copro..."
              className="text-base rounded-xl"
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Notes</p>
            <Textarea
              value={data.notes || ""}
              onChange={(e) => upd("notes", e.target.value)}
              rows={3}
              className="text-base rounded-xl"
            />
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full h-14 text-base rounded-2xl gap-2">
            {save.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Enregistrer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
