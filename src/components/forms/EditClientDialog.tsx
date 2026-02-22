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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Building2, Users, MapPin, CreditCard, Briefcase, StickyNote } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const tagOptions = ["Déménagement", "Garde-meubles", "Stockage", "Manutention", "Distribution", "Archives"];

const clientTypeOptions = [
  { value: "societe", label: "Société" },
  { value: "particulier", label: "Particulier" },
  { value: "partenaire", label: "Partenaire" },
  { value: "agent", label: "Agent" },
];

const statusOptions = [
  { value: "nouveau_lead", label: "Nouveau lead" },
  { value: "actif", label: "Actif" },
  { value: "inactif", label: "Inactif" },
  { value: "relance", label: "Relance" },
];

const paymentMethodOptions = [
  "Virement", "Chèque", "Carte bancaire", "Prélèvement", "Espèces", "Traite", "LCR",
];

const sourceOptions = [
  "Bouche à oreille", "Site web", "Réseaux sociaux", "Recommandation", "Démarchage", "Salon professionnel", "Annuaire", "Partenaire",
];

const schema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(200),
  code: z.string().trim().max(20).optional(),
  client_type: z.string().default("societe"),
  status: z.string(),
  contact_name: z.string().trim().max(200).optional(),
  email: z.string().trim().email("Email invalide").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional(),
  mobile: z.string().trim().max(20).optional(),
  address: z.string().trim().max(500).optional(),
  postal_code: z.string().trim().max(10).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  billing_address: z.string().trim().max(500).optional(),
  site_address: z.string().trim().max(500).optional(),
  payment_terms: z.string().trim().max(100).optional(),
  payment_method: z.string().trim().max(100).optional(),
  credit_limit: z.coerce.number().min(0).optional(),
  special_conditions: z.string().trim().max(1000).optional(),
  advisor: z.string().trim().max(200).optional(),
  source: z.string().trim().max(200).optional(),
  commercial_notes: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
  tags: z.array(z.string()).default([]),
  company_id: z.string().uuid("Sélectionnez une société"),
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
        status: client.status || "nouveau_lead",
        contact_name: client.contact_name || "",
        email: client.email || "",
        phone: client.phone || "",
        mobile: client.mobile || "",
        address: client.address || "",
        postal_code: client.postal_code || "",
        city: client.city || "",
        country: client.country || "France",
        billing_address: client.billing_address || "",
        site_address: client.site_address || "",
        payment_terms: client.payment_terms || "",
        payment_method: client.payment_method || "",
        credit_limit: client.credit_limit || 0,
        special_conditions: client.special_conditions || "",
        advisor: client.advisor || "",
        source: client.source || "",
        commercial_notes: client.commercial_notes || "",
        notes: client.notes || "",
        tags: client.tags || [],
        company_id: client.company_id,
      });
    }
  }, [open, client, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("clients").update({
        name: data.name,
        code: data.code || null,
        client_type: data.client_type,
        status: data.status as any,
        contact_name: data.contact_name || null,
        email: data.email || null,
        phone: data.phone || null,
        mobile: data.mobile || null,
        address: data.address || null,
        postal_code: data.postal_code || null,
        city: data.city || null,
        country: data.country || "France",
        billing_address: data.billing_address || null,
        site_address: data.site_address || null,
        payment_terms: data.payment_terms || null,
        payment_method: data.payment_method || null,
        credit_limit: data.credit_limit || 0,
        special_conditions: data.special_conditions || null,
        advisor: data.advisor || null,
        source: data.source || null,
        commercial_notes: data.commercial_notes || null,
        notes: data.notes || null,
        tags: data.tags || [],
        company_id: data.company_id,
      }).eq("id", client.id);
      if (error) throw error;

      if (data.contact_name) {
        const { data: existing } = await supabase
          .from("client_contacts").select("id")
          .eq("client_id", client.id).eq("is_default", true).maybeSingle();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Modifier le client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex-1 overflow-y-auto pr-1 space-y-2">
          <Accordion type="multiple" defaultValue={["general", "contact", "address", "finance", "commercial", "notes"]} className="w-full">
            {/* Section 1: Informations générales */}
            <AccordionItem value="general">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Informations générales</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="col-span-2">
                    <Label htmlFor="edit-name">Nom / Raison sociale *</Label>
                    <Input id="edit-name" {...register("name")} />
                    {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="edit-code">Code client</Label>
                    <Input id="edit-code" {...register("code")} />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={watch("client_type")} onValueChange={(v) => setValue("client_type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {clientTypeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Statut</Label>
                    <Select value={watch("status")} onValueChange={(v) => setValue("status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Société interne *</Label>
                    <Select value={watch("company_id")} onValueChange={(v) => setValue("company_id", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {dbCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
                          <button key={tag} type="button"
                            onClick={() => { const cur = watch("tags") || []; setValue("tags", selected ? cur.filter((t: string) => t !== tag) : [...cur, tag]); }}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-transparent hover:border-border"}`}
                          >{tag}</button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 2: Contact */}
            <AccordionItem value="contact">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Contact principal</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="col-span-2">
                    <Label htmlFor="edit-contact">Nom du contact</Label>
                    <Input id="edit-contact" {...register("contact_name")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-email">Email</Label>
                    <Input id="edit-email" type="email" {...register("email")} />
                    {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="edit-phone">Téléphone fixe</Label>
                    <Input id="edit-phone" {...register("phone")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-mobile">Mobile</Label>
                    <Input id="edit-mobile" {...register("mobile")} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">💡 Gérez les contacts multiples depuis l'onglet Contacts de la fiche client.</p>
              </AccordionContent>
            </AccordionItem>

            {/* Section 3: Adresses */}
            <AccordionItem value="address">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Adresses</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="col-span-2">
                    <Label>Adresse principale</Label>
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
                  <div>
                    <Label htmlFor="edit-postal">Code postal</Label>
                    <Input id="edit-postal" {...register("postal_code")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-city">Ville</Label>
                    <Input id="edit-city" {...register("city")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-country">Pays</Label>
                    <Input id="edit-country" {...register("country")} />
                  </div>
                  <div className="col-span-2">
                    <Label>Adresse de facturation</Label>
                    <AddressAutocomplete
                      id="edit-billing"
                      value={watch("billing_address") || ""}
                      onChange={(v) => setValue("billing_address", v)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Adresse chantier (par défaut)</Label>
                    <AddressAutocomplete
                      id="edit-site"
                      value={watch("site_address") || ""}
                      onChange={(v) => setValue("site_address", v)}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 4: Informations financières */}
            <AccordionItem value="finance">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Informations financières</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <Label>Mode de règlement</Label>
                    <Select value={watch("payment_method") || ""} onValueChange={(v) => setValue("payment_method", v)}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {paymentMethodOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-payment-terms">Délais de paiement</Label>
                    <Input id="edit-payment-terms" {...register("payment_terms")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-credit-limit">Encours autorisé (€)</Label>
                    <Input id="edit-credit-limit" type="number" step="0.01" {...register("credit_limit")} />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="edit-special">Conditions particulières</Label>
                    <Textarea id="edit-special" {...register("special_conditions")} rows={2} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 5: Commercial */}
            <AccordionItem value="commercial">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" /> Informations commerciales</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <Label htmlFor="edit-advisor">Commercial responsable</Label>
                    <Input id="edit-advisor" {...register("advisor")} />
                  </div>
                  <div>
                    <Label>Source client</Label>
                    <Select value={watch("source") || ""} onValueChange={(v) => setValue("source", v)}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {sourceOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="edit-commercial-notes">Notes commerciales</Label>
                    <Textarea id="edit-commercial-notes" {...register("commercial_notes")} rows={2} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 6: Notes */}
            <AccordionItem value="notes">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="flex items-center gap-2"><StickyNote className="h-4 w-4 text-primary" /> Notes internes</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-1">
                  <Label htmlFor="edit-notes">Notes internes</Label>
                  <Textarea id="edit-notes" {...register("notes")} rows={3} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex justify-end gap-2 pt-3 pb-1 sticky bottom-0 bg-background border-t mt-2">
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
