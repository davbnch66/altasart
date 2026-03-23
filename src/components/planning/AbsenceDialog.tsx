import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface AbsenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resources: Array<{ id: string; name: string; type: string }>;
  companyId: string;
  preselectedResourceId?: string;
  preselectedDate?: Date;
}

const ABSENCE_TYPES = [
  { value: "conge", label: "Congé payé" },
  { value: "rtt", label: "RTT" },
  { value: "maladie", label: "Maladie" },
  { value: "formation", label: "Formation" },
  { value: "sans_solde", label: "Sans solde" },
  { value: "autre", label: "Autre" },
];

export function AbsenceDialog({ open, onOpenChange, resources, companyId, preselectedResourceId, preselectedDate }: AbsenceDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    resource_id: preselectedResourceId || "",
    type: "conge",
    start_date: preselectedDate ? format(preselectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    end_date: preselectedDate ? format(preselectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    reason: "",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.resource_id) throw new Error("Sélectionnez une ressource");
      const { error } = await supabase.from("resource_absences").insert({
        resource_id: form.resource_id,
        company_id: companyId,
        type: form.type,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Absence enregistrée");
      queryClient.invalidateQueries({ queryKey: ["resource-absences"] });
      queryClient.invalidateQueries({ queryKey: ["planning"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const personnelResources = resources.filter(r => r.type === "employe" || r.type === "equipe");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer une absence</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Ressource *</Label>
            <Select value={form.resource_id} onValueChange={v => setForm(f => ({ ...f, resource_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                {personnelResources.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ABSENCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date début</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date fin</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Motif</Label>
            <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2} placeholder="Optionnel..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
