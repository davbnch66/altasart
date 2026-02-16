import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["Chef d'équipe", "Manutentionnaire", "Grutier", "Chauffeur", "Monteur", "Électricien", "Autre"];

interface Props {
  visiteId: string;
  companyId: string;
}

export const VisiteRHTab = ({ visiteId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const [newRH, setNewRH] = useState({ role: "", quantity: 1, duration_estimate: "", notes: "" });

  const { data: rh = [] } = useQuery({
    queryKey: ["visite-rh", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("visite_ressources_humaines").select("*").eq("visite_id", visiteId).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const addRH = useMutation({
    mutationFn: async () => {
      if (!newRH.role.trim()) throw new Error("Rôle requis");
      const { error } = await supabase.from("visite_ressources_humaines").insert({
        visite_id: visiteId, company_id: companyId, ...newRH, sort_order: rh.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ressource ajoutée");
      setNewRH({ role: "", quantity: 1, duration_estimate: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["visite-rh", visiteId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteRH = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("visite_ressources_humaines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supprimé");
      queryClient.invalidateQueries({ queryKey: ["visite-rh", visiteId] });
    },
  });

  const totalPersons = rh.reduce((sum: number, r: any) => sum + r.quantity, 0);

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Ajouter ressource humaine</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Rôle *</Label>
            <select
              value={newRH.role}
              onChange={(e) => setNewRH((p) => ({ ...p, role: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">-- Choisir --</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <Label>Quantité</Label>
            <Input type="number" min={1} value={newRH.quantity} onChange={(e) => setNewRH((p) => ({ ...p, quantity: Number(e.target.value) }))} />
          </div>
          <div>
            <Label>Durée estimée</Label>
            <Input value={newRH.duration_estimate} onChange={(e) => setNewRH((p) => ({ ...p, duration_estimate: e.target.value }))} placeholder="2h, 1 jour..." />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={newRH.notes} onChange={(e) => setNewRH((p) => ({ ...p, notes: e.target.value }))} placeholder="" />
          </div>
        </div>
        <Button size="sm" onClick={() => addRH.mutate()} disabled={addRH.isPending || !newRH.role.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </Card>

      {totalPersons > 0 && (
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" /> Total : {totalPersons} personne(s)
        </div>
      )}

      {rh.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Rôle</th>
                <th className="text-center p-2 font-medium w-16">Qté</th>
                <th className="text-left p-2 font-medium">Durée</th>
                <th className="text-left p-2 font-medium hidden md:table-cell">Notes</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rh.map((item: any, idx: number) => (
                <tr key={item.id} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                  <td className="p-2 font-medium">{item.role}</td>
                  <td className="p-2 text-center">{item.quantity}</td>
                  <td className="p-2 text-muted-foreground">{item.duration_estimate || "—"}</td>
                  <td className="p-2 hidden md:table-cell text-muted-foreground">{item.notes || "—"}</td>
                  <td className="p-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRH.mutate(item.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
