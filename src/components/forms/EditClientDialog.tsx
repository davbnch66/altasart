import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  advisor: z.string().trim().max(200).optional(),
  tags: z.array(z.string()).default([]),
  company_id: z.string().uuid("Sélectionnez une société"),
  status: z.string(),
});

type FormData = z.infer<typeof schema>;

interface EditClientDialogProps {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditClientDialog = ({ client, open, onOpenChange }: EditClientDialogProps) => {
  const { dbCompanies } = useCompany();
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open && client) {
      reset({
        name: client.name || "",
        code: client.code || "",
        client_type: client.client_type || "societe",
        contact_name: client.contact_name || "",
        email: client.email || "",
        phone: client.phone || "",
        mobile: client.mobile || "",
        address: client.address || "",
        postal_code: client.postal_code || "",
        city: client.city || "",
        billing_address: client.billing_address || "",
        payment_terms: client.payment_terms || "",
        advisor: client.advisor || "",
        tags: client.tags || [],
        company_id: client.company_id,
        status: client.status,
      });
    }
  }, [open, client, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("clients").update({
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
        advisor: data.advisor || null,
        tags: data.tags || [],
        company_id: data.company_id,
        status: data.status as any,
      }).eq("id", client.id);
      if (error) throw error;

      // Create a default contact only if none exists yet
      if (data.contact_name) {
        const { data: existing } = await supabase
          .from("client_contacts")
          .select("id")
          .eq("client_id", client.id)
          .eq("is_default", true)
          .maybeSingle();

        if (!existing) {
          const nameParts = data.contact_name.trim().split(/\s+/);
          const lastName = nameParts.pop() || data.contact_name;
          const firstName = nameParts.join(" ") || null;

          await supabase.from("client_contacts").insert({
            client_id: client.id,
            company_id: data.company_id,
            first_name: firstName,
            last_name: lastName,
            email: data.email || null,
            phone_office: data.phone || null,
            mobile: data.mobile || null,
            is_default: true,
          });
        }
      }
    },
    onSuccess: () => {
      toast.success("Client modifié avec succès");
      queryClient.invalidateQueries({ queryKey: ["client", client.id] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-contacts", client.id] });
      onOpenChange(false);
    },
    onError: () => toast.error("Erreur lors de la modification"),
  });

  const statusOptions = [
    { value: "nouveau_lead", label: "Nouveau lead" },
    { value: "actif", label: "Actif" },
    { value: "inactif", label: "Inactif" },
    { value: "relance", label: "Relance" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="edit-name">Nom *</Label>
              <Input id="edit-name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="edit-code">Code</Label>
              <Input id="edit-code" {...register("code")} />
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
              <Label htmlFor="edit-contact">Contact</Label>
              <Input id="edit-contact" {...register("contact_name")} />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="edit-phone">Téléphone</Label>
              <Input id="edit-phone" {...register("phone")} />
            </div>
            <div>
              <Label htmlFor="edit-mobile">Mobile</Label>
              <Input id="edit-mobile" {...register("mobile")} />
            </div>
            <div>
              <Label htmlFor="edit-postal">Code postal</Label>
              <Input id="edit-postal" {...register("postal_code")} />
            </div>
            <div>
              <Label htmlFor="edit-city">Ville</Label>
              <Input id="edit-city" {...register("city")} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="edit-address">Adresse</Label>
              <AddressAutocomplete
                id="edit-address"
                value={watch("address") || ""}
                onChange={(v) => setValue("address", v)}
                onSelect={(s) => {
                  if (s.postcode) setValue("postal_code", s.postcode);
                  if (s.city) setValue("city", s.city);
                }}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="edit-billing">Adresse de facturation</Label>
              <AddressAutocomplete
                id="edit-billing"
                value={watch("billing_address") || ""}
                onChange={(v) => setValue("billing_address", v)}
              />
            </div>
            <div>
              <Label htmlFor="edit-payment">Mode de règlement</Label>
              <Input id="edit-payment" {...register("payment_terms")} />
            </div>
            <div>
              <Label htmlFor="edit-advisor">Conseiller</Label>
              <Input id="edit-advisor" {...register("advisor")} />
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
              <Label>Société *</Label>
              <Select value={watch("company_id")} onValueChange={(v) => setValue("company_id", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {dbCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                        setValue("tags", selected ? current.filter((t: string) => t !== tag) : [...current, tag]);
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
