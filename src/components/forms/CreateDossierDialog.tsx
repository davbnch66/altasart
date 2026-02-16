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
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const schema = z.object({
  title: z.string().trim().min(1, "L'intitulé est requis").max(300),
  code: z.string().trim().max(20).optional(),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(500).optional(),
  amount: z.coerce.number().min(0).optional(),
  client_id: z.string().uuid("Sélectionnez un client"),
  company_id: z.string().uuid("Sélectionnez une société"),
});

type FormData = z.infer<typeof schema>;

interface CreateDossierDialogProps {
  preselectedClientId?: string;
  preselectedCompanyId?: string;
  trigger?: React.ReactNode;
}

export const CreateDossierDialog = ({ preselectedClientId, preselectedCompanyId, trigger }: CreateDossierDialogProps) => {
  const [open, setOpen] = useState(false);
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();

  const defaultCompanyId = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || "");
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId);

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

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { company_id: defaultCompanyId, amount: 0 },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("dossiers").insert({
        title: data.title,
        code: data.code || null,
        description: data.description || null,
        address: data.address || null,
        amount: data.amount || 0,
        client_id: data.client_id,
        company_id: data.company_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dossier créé avec succès");
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      queryClient.invalidateQueries({ queryKey: ["client-dossiers"] });
      reset();
      setOpen(false);
    },
    onError: () => toast.error("Erreur lors de la création du dossier"),
  });

  const handleCompanyChange = (v: string) => {
    setValue("company_id", v);
    setSelectedCompanyId(v);
    setValue("client_id", "" as any);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { const cid = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || ""); setSelectedCompanyId(cid); reset({ company_id: cid, client_id: preselectedClientId || ("" as any), amount: 0 }); } }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nouveau dossier
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau dossier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Société *</Label>
              <Select value={watch("company_id")} onValueChange={handleCompanyChange}>
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
              <Select value={watch("client_id")} onValueChange={(v) => setValue("client_id", v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.client_id && <p className="text-xs text-destructive mt-1">{errors.client_id.message}</p>}
            </div>
            <div className="col-span-2">
              <Label htmlFor="title">Intitulé *</Label>
              <Input id="title" {...register("title")} placeholder="Titre du dossier" />
              {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <Label htmlFor="code">Code</Label>
              <Input id="code" {...register("code")} placeholder="DOS-2026-XXX" />
            </div>
            <div>
              <Label htmlFor="amount">Montant (€)</Label>
              <Input id="amount" type="number" step="0.01" {...register("amount")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="address">Adresse du chantier</Label>
              <AddressAutocomplete
                id="address"
                value={watch("address") || ""}
                onChange={(v) => setValue("address", v)}
                placeholder="Adresse du chantier"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register("description")} rows={3} placeholder="Description du dossier..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Création..." : "Créer le dossier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
