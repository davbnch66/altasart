import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const RESOURCE_TYPES = [
  { value: "employe", label: "Employé" },
  { value: "grue", label: "Grue" },
  { value: "vehicule", label: "Véhicule" },
  { value: "equipement", label: "Équipement" },
  { value: "equipe", label: "Équipe" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  /** Pre-select a resource type */
  defaultType?: string;
}

export function CreateResourceDialog({ open, onOpenChange, companyId, defaultType }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState(defaultType ?? "employe");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nom requis");
      // 1. Create the resource
      const { data: resource, error } = await supabase
        .from("resources")
        .insert({ name: name.trim(), type: type as any, notes: notes.trim() || null })
        .select("id")
        .single();
      if (error) throw error;

      // 2. Link to company
      const { error: linkError } = await supabase
        .from("resource_companies")
        .insert({ resource_id: resource.id, company_id: companyId });
      if (linkError) throw linkError;

      return resource;
    },
    onSuccess: () => {
      toast.success("Ressource créée");
      setName("");
      setNotes("");
      setType(defaultType ?? "employe");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["fleet-resources"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle ressource</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Jean Dupont, Grue MK73..."
              autoFocus
            />
          </div>
          <div>
            <Label>Type *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes optionnelles..."
              rows={2}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => create.mutate()}
            disabled={create.isPending || !name.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            {create.isPending ? "Création..." : "Créer la ressource"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
