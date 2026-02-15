import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  objet: z.string().trim().min(1, "L'objet est requis").max(500),
  code: z.string().trim().max(20).optional(),
  amount: z.coerce.number().min(0, "Le montant doit être positif"),
  notes: z.string().trim().max(2000).optional(),
  valid_until: z.string().optional(),
  status: z.string(),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { value: "brouillon", label: "Brouillon" },
  { value: "envoye", label: "Envoyé" },
  { value: "accepte", label: "Accepté" },
  { value: "refuse", label: "Refusé" },
  { value: "expire", label: "Expiré" },
];

interface EditDevisDialogProps {
  devis: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditDevisDialog = ({ devis, open, onOpenChange }: EditDevisDialogProps) => {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open && devis) {
      reset({
        objet: devis.objet || "",
        code: devis.code || "",
        amount: devis.amount || 0,
        notes: devis.notes || "",
        valid_until: devis.valid_until || "",
        status: devis.status,
      });
    }
  }, [open, devis, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("devis").update({
        objet: data.objet,
        code: data.code || null,
        amount: data.amount,
        notes: data.notes || null,
        valid_until: data.valid_until || null,
        status: data.status as any,
      }).eq("id", devis.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devis modifié avec succès");
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      queryClient.invalidateQueries({ queryKey: ["client-devis"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Erreur lors de la modification"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier le devis</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="edit-objet">Objet *</Label>
              <Input id="edit-objet" {...register("objet")} />
              {errors.objet && <p className="text-xs text-destructive mt-1">{errors.objet.message}</p>}
            </div>
            <div>
              <Label htmlFor="edit-code">Code</Label>
              <Input id="edit-code" {...register("code")} />
            </div>
            <div>
              <Label htmlFor="edit-amount">Montant (€) *</Label>
              <Input id="edit-amount" type="number" step="0.01" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-valid">Valide jusqu'au</Label>
              <Input id="edit-valid" type="date" {...register("valid_until")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea id="edit-notes" {...register("notes")} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
