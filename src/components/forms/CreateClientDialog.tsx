import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const tagOptions = ["Déménagement", "Garde-meubles", "Stockage", "Manutention", "Distribution", "Archives"];

const schema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(200),
  code: z.string().trim().max(20).optional(),
  client_type: z.string().default("societe"),
  contact_name: z.string().trim().max(200).optional(),
  email: z.string().trim().email("Email invalide").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional(),
  mobile: z.string().trim().max(20).optional(),
  address: z.string().trim().max(500).optional(),
  postal_code: z.string().trim().max(10).optional(),
  city: z.string().trim().max(100).optional(),
  billing_address: z.string().trim().max(500).optional(),
  payment_terms: z.string().trim().max(100).optional(),
  tags: z.array(z.string()).default([]),
  company_id: z.string().uuid("Sélectionnez une société"),
});

type FormData = z.infer<typeof schema>;

interface CreateClientDialogProps {
  trigger?: React.ReactNode;
}

export const CreateClientDialog = ({ trigger }: CreateClientDialogProps) => {
  const [open, setOpen] = useState(false);
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();

  const defaultCompanyId = current !== "global" ? current : dbCompanies[0]?.id || "";

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { company_id: defaultCompanyId, client_type: "societe", tags: [] },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const insertData = {
        name: data.name,
        code: data.code || null,
        client_type: data.client_type,
        contact_name: data.contact_name || null,
        email: data.email || null,
        phone: data.phone || null,
        mobile: data.mobile || null,
        address: data.address || null,
        postal_code: data.postal_code || null,
        city: data.city || null,
        billing_address: data.billing_address || null,
        payment_terms: data.payment_terms || null,
        tags: data.tags || [],
        company_id: data.company_id,
      };
      const { data: newClient, error } = await supabase.from("clients").insert(insertData).select("id").single();
      if (error) throw error;

      // Auto-create a client_contact from the contact info
      if (data.contact_name && newClient) {
        const nameParts = data.contact_name.trim().split(/\s+/);
        const lastName = nameParts.pop() || data.contact_name;
        const firstName = nameParts.join(" ") || null;
        await supabase.from("client_contacts").insert({
          client_id: newClient.id,
          company_id: data.company_id,
          first_name: firstName,
          last_name: lastName,
          email: data.email || null,
          phone_office: data.phone || null,
          mobile: data.mobile || null,
          is_default: true,
        });
      }
    },
    onSuccess: () => {
      toast.success("Client créé avec succès");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      reset();
      setOpen(false);
    },
    onError: () => toast.error("Erreur lors de la création du client"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { reset({ company_id: defaultCompanyId, client_type: "societe", tags: [] }); } }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nouveau client
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Nom *</Label>
              <Input id="name" {...register("name")} placeholder="Nom du client" />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="code">Code</Label>
              <Input id="code" {...register("code")} placeholder="Ex: 6001" />
            </div>
            <div>
              <Label>Type</Label>
              <select
                value={watch("client_type")}
                onChange={(e) => setValue("client_type", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="societe">Société</option>
                <option value="particulier">Particulier</option>
              </select>
            </div>
            <div>
              <Label htmlFor="contact_name">Contact principal</Label>
              <Input id="contact_name" {...register("contact_name")} placeholder="Nom du contact" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} placeholder="email@exemple.fr" />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" {...register("phone")} placeholder="01 23 45 67 89" />
            </div>
            <div>
              <Label htmlFor="mobile">Mobile</Label>
              <Input id="mobile" {...register("mobile")} placeholder="06 12 34 56 78" />
            </div>
            <div>
              <Label htmlFor="postal_code">Code postal</Label>
              <Input id="postal_code" {...register("postal_code")} placeholder="75001" />
            </div>
            <div>
              <Label htmlFor="city">Ville</Label>
              <Input id="city" {...register("city")} placeholder="Paris" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="address">Adresse</Label>
              <AddressAutocomplete
                id="address"
                value={watch("address") || ""}
                onChange={(v) => setValue("address", v)}
                onSelect={(s) => {
                  if (s.postcode) setValue("postal_code", s.postcode);
                  if (s.city) setValue("city", s.city);
                }}
                placeholder="Adresse complète"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="billing_address">Adresse de facturation</Label>
              <AddressAutocomplete
                id="billing_address"
                value={watch("billing_address") || ""}
                onChange={(v) => setValue("billing_address", v)}
                placeholder="Si différente de l'adresse principale"
              />
            </div>
            <div>
              <Label htmlFor="payment_terms">Mode de règlement</Label>
              <Input id="payment_terms" {...register("payment_terms")} placeholder="30 jours" />
            </div>
            <div>
              <Label>Société *</Label>
              <Select value={watch("company_id")} onValueChange={(v) => setValue("company_id", v)}>
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
              <Label>Tags métier</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {tagOptions.map((tag) => {
                  const selected = (watch("tags") || []).includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const current = watch("tags") || [];
                        setValue("tags", selected ? current.filter((t) => t !== tag) : [...current, tag]);
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selected ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-transparent hover:border-border"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Création..." : "Créer le client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
