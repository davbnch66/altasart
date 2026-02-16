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

const schema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  code: z.string().trim().max(20).optional(),
  client_id: z.string().uuid("Sélectionnez un client"),
  company_id: z.string().uuid("Sélectionnez une société"),
  scheduled_date: z.string().optional(),
  scheduled_time: z.string().optional(),
  zone: z.string().optional(),
  address: z.string().optional(),
  visit_type: z.string().optional(),
  advisor: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export const CreateVisiteDialog = () => {
  const [open, setOpen] = useState(false);
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();

  const defaultCompanyId = current !== "global" ? current : dbCompanies[0]?.id || "";
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-visite", selectedCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, code")
        .eq("company_id", selectedCompanyId)
        .order("name");
      return data || [];
    },
    enabled: open && !!selectedCompanyId,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { company_id: defaultCompanyId },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("visites").insert({
        title: data.title,
        code: data.code || null,
        client_id: data.client_id,
        company_id: data.company_id,
        scheduled_date: data.scheduled_date || null,
        scheduled_time: data.scheduled_time || null,
        zone: data.zone || null,
        address: data.address || null,
        visit_type: data.visit_type || null,
        advisor: data.advisor || null,
        notes: data.notes || null,
        status: "planifiee",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visite créée");
      queryClient.invalidateQueries({ queryKey: ["visites"] });
      reset();
      setOpen(false);
    },
    onError: (err: any) => {
      console.error("Erreur création visite:", err);
      toast.error(err?.message || "Erreur lors de la création");
    },
  });

  const handleCompanyChange = (v: string) => {
    setValue("company_id", v);
    setSelectedCompanyId(v);
    setValue("client_id", "" as any);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { const cid = current !== "global" ? current : dbCompanies[0]?.id || ""; setSelectedCompanyId(cid); reset({ company_id: cid, title: "" }); } }}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nouvelle visite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nouvelle visite</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 overflow-y-auto flex-1 pr-2">
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
              <Label>Client *</Label>
              <select
                value={watch("client_id") || ""}
                onChange={(e) => setValue("client_id", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Sélectionner un client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.code ? `${c.code} - ` : ""}{c.name}</option>
                ))}
              </select>
              {errors.client_id && <p className="text-xs text-destructive mt-1">{errors.client_id.message}</p>}
            </div>
            <div className="col-span-2">
              <Label htmlFor="visite-title">Titre *</Label>
              <Input id="visite-title" {...register("title")} placeholder="Ex: Visite technique curage" />
              {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <Label htmlFor="visite-code">Code visite</Label>
              <Input id="visite-code" {...register("code")} placeholder="15086" />
            </div>
            <div>
              <Label htmlFor="visite-zone">Zone</Label>
              <Input id="visite-zone" {...register("zone")} placeholder="Paris" />
            </div>
            <div>
              <Label htmlFor="visite-date">Date</Label>
              <Input id="visite-date" type="date" {...register("scheduled_date")} />
            </div>
            <div>
              <Label htmlFor="visite-time">Heure</Label>
              <Input id="visite-time" type="time" {...register("scheduled_time")} />
            </div>
            <div>
              <Label htmlFor="visite-type">Type visite</Label>
              <Input id="visite-type" {...register("visit_type")} placeholder="VT, VC..." />
            </div>
            <div>
              <Label htmlFor="visite-advisor">Conseiller</Label>
              <Input id="visite-advisor" {...register("advisor")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="visite-address">Adresse</Label>
              <Input id="visite-address" {...register("address")} placeholder="Adresse du rendez-vous" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="visite-notes">Notes</Label>
              <Textarea id="visite-notes" {...register("notes")} rows={2} placeholder="Notes..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Création..." : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
