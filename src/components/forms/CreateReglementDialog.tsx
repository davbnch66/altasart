import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const schema = z.object({
  amount: z.coerce.number().min(0.01, "Le montant doit être positif"),
  payment_date: z.string().min(1, "La date est requise"),
  encaissement_date: z.string().optional(),
  reference: z.string().trim().max(100).optional(),
  bank: z.string().trim().max(100).optional(),
  code: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(2000).optional(),
  facture_id: z.string().uuid("Sélectionnez une facture"),
  company_id: z.string().uuid("Sélectionnez une société"),
});

type FormData = z.infer<typeof schema>;

interface CreateReglementDialogProps {
  preselectedFactureId?: string;
  preselectedCompanyId?: string;
}

export const CreateReglementDialog = ({ preselectedFactureId, preselectedCompanyId }: CreateReglementDialogProps) => {
  const [open, setOpen] = useState(false);
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();

  const defaultCompanyId = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || "");
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId);

  const { data: factures = [] } = useQuery({
    queryKey: ["factures-for-select", selectedCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("factures")
        .select("id, code, amount, paid_amount, clients(name)")
        .eq("company_id", selectedCompanyId)
        .in("status", ["envoyee", "en_retard", "brouillon"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: open && !!selectedCompanyId,
  });

  const today = new Date().toISOString().slice(0, 10);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { company_id: defaultCompanyId, payment_date: today, amount: 0 },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("reglements").insert({
        amount: data.amount,
        payment_date: data.payment_date,
        encaissement_date: data.encaissement_date || null,
        reference: data.reference || null,
        bank: data.bank || null,
        code: data.code || null,
        notes: data.notes || null,
        facture_id: data.facture_id,
        company_id: data.company_id,
      });
      if (error) throw error;
      // paid_amount is now synced automatically by database trigger
    },
    onSuccess: () => {
      toast.success("Règlement enregistré");
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: ["reglements"] });
      queryClient.invalidateQueries({ queryKey: ["facture-reglements"] });
      queryClient.invalidateQueries({ queryKey: ["facture-detail"] });
      reset();
      setOpen(false);
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  const handleCompanyChange = (v: string) => {
    setValue("company_id", v);
    setSelectedCompanyId(v);
    setValue("facture_id", "" as any);
  };

  const handleFactureChange = (v: string) => {
    setValue("facture_id", v);
    const f = factures.find((f) => f.id === v);
    if (f) {
      const remaining = Number(f.amount) - Number(f.paid_amount);
      setValue("amount", remaining > 0 ? remaining : 0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { const cid = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || ""); setSelectedCompanyId(cid); reset({ company_id: cid, facture_id: preselectedFactureId || ("" as any), payment_date: today, amount: 0 }); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nouveau règlement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau règlement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Société *</Label>
              <select
                value={watch("company_id")}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Sélectionner</option>
                {dbCompanies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.company_id && <p className="text-xs text-destructive mt-1">{errors.company_id.message}</p>}
            </div>
            <div className="col-span-2">
              <Label>Facture *</Label>
              <select
                value={watch("facture_id")}
                onChange={(e) => handleFactureChange(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Sélectionner une facture</option>
                {factures.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code || "Sans code"} — {(f.clients as any)?.name ?? "?"} — Reste: {fmt(Number(f.amount) - Number(f.paid_amount))}
                  </option>
                ))}
              </select>
              {errors.facture_id && <p className="text-xs text-destructive mt-1">{errors.facture_id.message}</p>}
            </div>
            <div>
              <Label htmlFor="reg-amount">Montant (€) *</Label>
              <Input id="reg-amount" type="number" step="0.01" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <Label htmlFor="reg-date">Date de paiement *</Label>
              <Input id="reg-date" type="date" {...register("payment_date")} />
              {errors.payment_date && <p className="text-xs text-destructive mt-1">{errors.payment_date.message}</p>}
            </div>
            <div>
              <Label htmlFor="reg-encaissement">Date d'encaissement</Label>
              <Input id="reg-encaissement" type="date" {...register("encaissement_date")} />
            </div>
            <div>
              <Label htmlFor="reg-ref">Référence</Label>
              <Input id="reg-ref" {...register("reference")} placeholder="N° chèque, virement..." />
            </div>
            <div>
              <Label htmlFor="reg-bank">Banque</Label>
              <Input id="reg-bank" {...register("bank")} placeholder="Nom de la banque" />
            </div>
            <div>
              <Label htmlFor="reg-code">Code</Label>
              <Input id="reg-code" {...register("code")} placeholder="REG-XXX" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="reg-notes">Notes</Label>
              <Textarea id="reg-notes" {...register("notes")} rows={2} placeholder="Notes..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
