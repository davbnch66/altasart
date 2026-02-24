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

const schema = z.object({
  amount: z.coerce.number().min(0.01, "Le montant doit être positif"),
  payment_date: z.string().min(1, "La date est requise"),
  encaissement_date: z.string().optional(),
  reference: z.string().trim().max(100).optional(),
  bank: z.string().trim().max(100).optional(),
  code: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(2000).optional(),
});

type FormData = z.infer<typeof schema>;

interface EditReglementDialogProps {
  reglement: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditReglementDialog = ({ reglement, open, onOpenChange }: EditReglementDialogProps) => {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open && reglement) {
      reset({
        amount: reglement.amount || 0,
        payment_date: reglement.payment_date || "",
        encaissement_date: reglement.encaissement_date || "",
        reference: reglement.reference || "",
        bank: reglement.bank || "",
        code: reglement.code || "",
        notes: reglement.notes || "",
      });
    }
  }, [open, reglement, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("reglements").update({
        amount: data.amount,
        payment_date: data.payment_date,
        encaissement_date: data.encaissement_date || null,
        reference: data.reference || null,
        bank: data.bank || null,
        code: data.code || null,
        notes: data.notes || null,
      }).eq("id", reglement.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Règlement modifié");
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: ["reglements"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-reglements-count"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Erreur lors de la modification"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier le règlement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-reg-amount">Montant (€) *</Label>
              <Input id="edit-reg-amount" type="number" step="0.01" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <Label htmlFor="edit-reg-date">Date de paiement *</Label>
              <Input id="edit-reg-date" type="date" {...register("payment_date")} />
              {errors.payment_date && <p className="text-xs text-destructive mt-1">{errors.payment_date.message}</p>}
            </div>
            <div>
              <Label htmlFor="edit-reg-enc">Date d'encaissement</Label>
              <Input id="edit-reg-enc" type="date" {...register("encaissement_date")} />
            </div>
            <div>
              <Label htmlFor="edit-reg-ref">Référence</Label>
              <Input id="edit-reg-ref" {...register("reference")} />
            </div>
            <div>
              <Label htmlFor="edit-reg-bank">Banque</Label>
              <Input id="edit-reg-bank" {...register("bank")} />
            </div>
            <div>
              <Label htmlFor="edit-reg-code">Code</Label>
              <Input id="edit-reg-code" {...register("code")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="edit-reg-notes">Notes</Label>
              <Textarea id="edit-reg-notes" {...register("notes")} rows={2} />
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
