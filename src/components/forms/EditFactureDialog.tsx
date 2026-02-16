import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { generateFacturePdf } from "@/lib/generateFacturePdf";
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
  code: z.string().trim().max(20).optional(),
  amount: z.coerce.number().min(0, "Le montant doit être positif"),
  notes: z.string().trim().max(2000).optional(),
  due_date: z.string().optional(),
  status: z.string(),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { value: "brouillon", label: "Brouillon" },
  { value: "envoyee", label: "Envoyée" },
  { value: "payee", label: "Payée" },
  { value: "en_retard", label: "En retard" },
  { value: "annulee", label: "Annulée" },
];

interface EditFactureDialogProps {
  facture: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditFactureDialog = ({ facture, open, onOpenChange }: EditFactureDialogProps) => {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open && facture) {
      reset({
        code: facture.code || "",
        amount: facture.amount || 0,
        notes: facture.notes || "",
        due_date: facture.due_date || "",
        status: facture.status,
      });
    }
  }, [open, facture, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("factures").update({
        code: data.code || null,
        amount: data.amount,
        notes: data.notes || null,
        due_date: data.due_date || null,
        status: data.status as any,
      }).eq("id", facture.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Facture modifiée avec succès");
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: ["finance-stats"] });
      queryClient.invalidateQueries({ queryKey: ["finance-factures"] });
      queryClient.invalidateQueries({ queryKey: ["facture-detail"] });
      queryClient.invalidateQueries({ queryKey: ["client-factures"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Erreur lors de la modification"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la facture</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-fac-code">Code</Label>
              <Input id="edit-fac-code" {...register("code")} />
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
              <Label htmlFor="edit-fac-amount">Montant (€) *</Label>
              <Input id="edit-fac-amount" type="number" step="0.01" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
            </div>
            <div className="col-span-2">
              <Label htmlFor="edit-fac-due">Date d'échéance</Label>
              <Input id="edit-fac-due" type="date" {...register("due_date")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="edit-fac-notes">Notes</Label>
              <Textarea id="edit-fac-notes" {...register("notes")} rows={2} />
            </div>
          </div>
          <div className="flex justify-between gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => generateFacturePdf(facture.id).catch(() => toast.error("Erreur PDF"))}>
              Télécharger PDF
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
