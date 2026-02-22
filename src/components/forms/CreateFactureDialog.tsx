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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const schema = z.object({
  code: z.string().trim().max(20).optional(),
  amount: z.coerce.number().min(0, "Le montant doit être positif"),
  notes: z.string().trim().max(2000).optional(),
  due_date: z.string().optional(),
  client_id: z.string().uuid("Sélectionnez un client"),
  company_id: z.string().uuid("Sélectionnez une société"),
  dossier_id: z.string().optional(),
  devis_id: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateFactureDialogProps {
  preselectedClientId?: string;
  preselectedCompanyId?: string;
  preselectedDossierId?: string;
  trigger?: React.ReactNode;
}

export const CreateFactureDialog = ({ preselectedClientId, preselectedCompanyId, preselectedDossierId, trigger }: CreateFactureDialogProps) => {
  const [open, setOpen] = useState(false);
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();

  const defaultCompanyId = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || "");
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId);
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || "");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-select", selectedCompanyId],
    queryFn: async () => {
      let query = supabase.from("clients").select("id, name").order("name");
      if (selectedCompanyId) query = query.eq("company_id", selectedCompanyId);
      const { data } = await query;
      return data || [];
    },
    enabled: open,
  });

  const { data: dossiers = [] } = useQuery({
    queryKey: ["dossiers-for-select", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data } = await supabase.from("dossiers").select("id, title, code").eq("client_id", selectedClientId).order("title");
      return data || [];
    },
    enabled: open && !!selectedClientId,
  });

  const { data: devisList = [] } = useQuery({
    queryKey: ["devis-for-select", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data } = await supabase.from("devis").select("id, objet, code, amount").eq("client_id", selectedClientId).eq("status", "accepte").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: open && !!selectedClientId,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { company_id: defaultCompanyId, amount: 0 },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("factures").insert({
        code: data.code || null,
        amount: data.amount,
        notes: data.notes || null,
        due_date: data.due_date || null,
        client_id: data.client_id,
        company_id: data.company_id,
        dossier_id: data.dossier_id && data.dossier_id !== "none" ? data.dossier_id : null,
        devis_id: data.devis_id && data.devis_id !== "none" ? data.devis_id : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Facture créée avec succès");
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: ["client-factures"] });
      reset();
      setOpen(false);
    },
    onError: () => toast.error("Erreur lors de la création de la facture"),
  });

  const handleCompanyChange = (v: string) => {
    setValue("company_id", v);
    setSelectedCompanyId(v);
    setValue("client_id", "" as any);
    setSelectedClientId("");
  };

  const handleClientChange = (v: string) => {
    setValue("client_id", v);
    setSelectedClientId(v);
    setValue("dossier_id", "");
    setValue("devis_id", "");
  };

  const handleDevisChange = (v: string) => {
    setValue("devis_id", v);
    if (v !== "none") {
      const d = devisList.find((d) => d.id === v);
      if (d) setValue("amount", Number(d.amount));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { const cid = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || ""); setSelectedCompanyId(cid); setSelectedClientId(preselectedClientId || ""); reset({ company_id: cid, client_id: preselectedClientId || ("" as any), amount: 0, dossier_id: preselectedDossierId || "" }); } }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nouvelle facture
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle facture</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Société *</Label>
              <Select value={watch("company_id") || ""} onValueChange={handleCompanyChange}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {dbCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.company_id && <p className="text-xs text-destructive mt-1">{errors.company_id.message}</p>}
            </div>
            <div className="col-span-2">
              <Label>Client *</Label>
              <Select value={watch("client_id") || ""} onValueChange={handleClientChange}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.client_id && <p className="text-xs text-destructive mt-1">{errors.client_id.message}</p>}
            </div>
            {devisList.length > 0 && (
              <div className="col-span-2">
                <Label>Devis associé</Label>
                <Select value={watch("devis_id") || "none"} onValueChange={handleDevisChange}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {devisList.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.code || d.objet} — {fmt(Number(d.amount))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {dossiers.length > 0 && (
              <div className="col-span-2">
                <Label>Dossier associé</Label>
                <Select value={watch("dossier_id") || "none"} onValueChange={(v) => setValue("dossier_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {dossiers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.code || d.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="fac-code">Code</Label>
              <Input id="fac-code" {...register("code")} placeholder="FAC-2026-XXX" />
            </div>
            <div>
              <Label htmlFor="fac-amount">Montant (€) *</Label>
              <Input id="fac-amount" type="number" step="0.01" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
            </div>
            <div className="col-span-2">
              <Label htmlFor="fac-due">Date d'échéance</Label>
              <Input id="fac-due" type="date" {...register("due_date")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="fac-notes">Notes</Label>
              <Textarea id="fac-notes" {...register("notes")} rows={2} placeholder="Notes..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Création..." : "Créer la facture"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};