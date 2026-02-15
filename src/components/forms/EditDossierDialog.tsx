import { useState, useEffect } from "react";
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
  title: z.string().trim().min(1, "L'intitulé est requis").max(300),
  code: z.string().trim().max(20).optional(),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(500).optional(),
  amount: z.coerce.number().min(0).optional(),
  stage: z.string(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
});

type FormData = z.infer<typeof schema>;

const stageOptions = [
  { value: "prospect", label: "Prospect" },
  { value: "devis", label: "Devis" },
  { value: "accepte", label: "Accepté" },
  { value: "planifie", label: "Planifié" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminé" },
  { value: "facture", label: "Facturé" },
  { value: "paye", label: "Payé" },
];

interface EditDossierDialogProps {
  dossier: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditDossierDialog = ({ dossier, open, onOpenChange }: EditDossierDialogProps) => {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open && dossier) {
      reset({
        title: dossier.title || "",
        code: dossier.code || "",
        description: dossier.description || "",
        address: dossier.address || "",
        amount: dossier.amount || 0,
        stage: dossier.stage,
        start_date: dossier.start_date || "",
        end_date: dossier.end_date || "",
        notes: dossier.notes || "",
      });
    }
  }, [open, dossier, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("dossiers").update({
        title: data.title,
        code: data.code || null,
        description: data.description || null,
        address: data.address || null,
        amount: data.amount || 0,
        stage: data.stage as any,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        notes: data.notes || null,
      }).eq("id", dossier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dossier modifié avec succès");
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      queryClient.invalidateQueries({ queryKey: ["client-dossiers"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Erreur lors de la modification"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le dossier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="edit-title">Intitulé *</Label>
              <Input id="edit-title" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <Label htmlFor="edit-code">Code</Label>
              <Input id="edit-code" {...register("code")} />
            </div>
            <div>
              <Label htmlFor="edit-amount">Montant (€)</Label>
              <Input id="edit-amount" type="number" step="0.01" {...register("amount")} />
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={watch("stage")} onValueChange={(v) => setValue("stage", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stageOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-start">Date début</Label>
              <Input id="edit-start" type="date" {...register("start_date")} />
            </div>
            <div>
              <Label htmlFor="edit-end">Date fin</Label>
              <Input id="edit-end" type="date" {...register("end_date")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="edit-address">Adresse du chantier</Label>
              <Input id="edit-address" {...register("address")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea id="edit-desc" {...register("description")} rows={2} />
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
