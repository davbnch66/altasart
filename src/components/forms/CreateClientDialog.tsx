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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2, Users, MapPin, CreditCard, Briefcase, StickyNote } from "lucide-react";
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
  status: z.string().default("nouveau_lead"),
  siret: z.string().trim().max(20).optional(),
  ape_naf: z.string().trim().max(10).optional(),
  tva_intra: z.string().trim().max(20).optional(),
  website: z.string().trim().max(255).optional(),
  contact_name: z.string().trim().max(200).optional(),
  email: z.string().trim().email("Email invalide").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional(),
  mobile: z.string().trim().max(20).optional(),
  fax: z.string().trim().max(20).optional(),
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
  iban: z.string().trim().max(34).optional(),
  bic: z.string().trim().max(11).optional(),
  invoice_by_email: z.boolean().default(false),
  account_number: z.string().trim().max(20).optional(),
  accounting_collective: z.string().trim().max(20).optional(),
  advisor: z.string().trim().max(200).optional(),
  source: z.string().trim().max(200).optional(),
  commercial_notes: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
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
    defaultValues: { company_id: defaultCompanyId, client_type: "societe", status: "nouveau_lead", tags: [], country: "France", credit_limit: 0, invoice_by_email: false },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const insertData = {
        name: data.name,
        code: data.code || null,
        client_type: data.client_type,
        status: data.status as any,
        siret: data.siret || null,
        ape_naf: data.ape_naf || null,
        tva_intra: data.tva_intra || null,
        website: data.website || null,
        contact_name: data.contact_name || null,
        email: data.email || null,
        phone: data.phone || null,
        mobile: data.mobile || null,
        fax: data.fax || null,
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
        iban: data.iban || null,
        bic: data.bic || null,
        invoice_by_email: data.invoice_by_email || false,
        account_number: data.account_number || null,
        accounting_collective: data.accounting_collective || null,
        advisor: data.advisor || null,
        source: data.source || null,
        commercial_notes: data.commercial_notes || null,
        notes: data.notes || null,
        tags: data.tags || [],
        company_id: data.company_id,
      };
      const { data: newClient, error } = await supabase.from("clients").insert(insertData).select("id").single();
      if (error) throw error;

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
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { reset({ company_id: defaultCompanyId, client_type: "societe", status: "nouveau_lead", tags: [], country: "France", credit_limit: 0, invoice_by_email: false }); } }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nouveau client
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nouveau client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full flex-wrap h-auto gap-1 justify-start">
              <TabsTrigger value="general" className="flex items-center gap-1.5 text-xs">
                <Building2 className="h-3.5 w-3.5" /> Général
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex items-center gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5" /> Contact
              </TabsTrigger>
              <TabsTrigger value="address" className="flex items-center gap-1.5 text-xs">
                <MapPin className="h-3.5 w-3.5" /> Adresses
              </TabsTrigger>
              <TabsTrigger value="finance" className="flex items-center gap-1.5 text-xs">
                <CreditCard className="h-3.5 w-3.5" /> Finance
              </TabsTrigger>
              <TabsTrigger value="commercial" className="flex items-center gap-1.5 text-xs">
                <Briefcase className="h-3.5 w-3.5" /> Commercial
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-1.5 text-xs">
                <StickyNote className="h-3.5 w-3.5" /> Notes
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-1 mt-2">
              <TabsContent value="general" className="mt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label htmlFor="name">Nom / Raison sociale *</Label>
                    <Input id="name" {...register("name")} placeholder="Nom du client" />
                    {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="code">Code client</Label>
                    <Input id="code" {...register("code")} placeholder="Ex: 6001" />
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
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {dbCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {errors.company_id && <p className="text-xs text-destructive mt-1">{errors.company_id.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="siret">SIRET</Label>
                    <Input id="siret" {...register("siret")} placeholder="123 456 789 00012" />
                  </div>
                  <div>
                    <Label htmlFor="ape_naf">APE / NAF</Label>
                    <Input id="ape_naf" {...register("ape_naf")} placeholder="4942Z" />
                  </div>
                  <div>
                    <Label htmlFor="tva_intra">TVA Intracommunautaire</Label>
                    <Input id="tva_intra" {...register("tva_intra")} placeholder="FR 12 345678901" />
                  </div>
                  <div>
                    <Label htmlFor="website">Site web</Label>
                    <Input id="website" {...register("website")} placeholder="https://..." />
                  </div>
                  <div className="col-span-2">
                    <Label>Tags métier</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {tagOptions.map((tag) => {
                        const selected = (watch("tags") || []).includes(tag);
                        return (
                          <button key={tag} type="button"
                            onClick={() => { const cur = watch("tags") || []; setValue("tags", selected ? cur.filter((t) => t !== tag) : [...cur, tag]); }}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-transparent hover:border-border"}`}
                          >{tag}</button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="contact" className="mt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label htmlFor="contact_name">Nom du contact</Label>
                    <Input id="contact_name" {...register("contact_name")} placeholder="Prénom Nom" />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register("email")} placeholder="email@exemple.fr" />
                    {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="phone">Téléphone fixe</Label>
                    <Input id="phone" {...register("phone")} placeholder="01 23 45 67 89" />
                  </div>
                  <div>
                    <Label htmlFor="mobile">Mobile</Label>
                    <Input id="mobile" {...register("mobile")} placeholder="06 12 34 56 78" />
                  </div>
                  <div>
                    <Label htmlFor="fax">Fax</Label>
                    <Input id="fax" {...register("fax")} placeholder="01 23 45 67 90" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">💡 Vous pourrez ajouter d'autres contacts depuis la fiche client.</p>
              </TabsContent>

              <TabsContent value="address" className="mt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Adresse principale</Label>
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
                  <div>
                    <Label htmlFor="postal_code">Code postal</Label>
                    <Input id="postal_code" {...register("postal_code")} placeholder="75001" />
                  </div>
                  <div>
                    <Label htmlFor="city">Ville</Label>
                    <Input id="city" {...register("city")} placeholder="Paris" />
                  </div>
                  <div>
                    <Label htmlFor="country">Pays</Label>
                    <Input id="country" {...register("country")} placeholder="France" />
                  </div>
                  <div className="col-span-2">
                    <Label>Adresse de facturation</Label>
                    <AddressAutocomplete
                      id="billing_address"
                      value={watch("billing_address") || ""}
                      onChange={(v) => setValue("billing_address", v)}
                      placeholder="Si différente de l'adresse principale"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Adresse chantier (par défaut)</Label>
                    <AddressAutocomplete
                      id="site_address"
                      value={watch("site_address") || ""}
                      onChange={(v) => setValue("site_address", v)}
                      placeholder="Adresse de chantier habituelle"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="finance" className="mt-0">
                <div className="grid grid-cols-2 gap-3">
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
                    <Label htmlFor="payment_terms">Délais de paiement</Label>
                    <Input id="payment_terms" {...register("payment_terms")} placeholder="30 jours date de facture" />
                  </div>
                  <div>
                    <Label htmlFor="credit_limit">Encours autorisé (€)</Label>
                    <Input id="credit_limit" type="number" step="0.01" {...register("credit_limit")} placeholder="0" />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="special_conditions">Conditions particulières</Label>
                    <Textarea id="special_conditions" {...register("special_conditions")} rows={2} placeholder="Conditions spéciales, remises, etc." />
                  </div>
                  <div>
                    <Label htmlFor="account_number">N° de compte</Label>
                    <Input id="account_number" {...register("account_number")} placeholder="411000" />
                  </div>
                  <div>
                    <Label htmlFor="accounting_collective">Collectif</Label>
                    <Input id="accounting_collective" {...register("accounting_collective")} placeholder="411" />
                  </div>
                  <div className="col-span-2 border-t pt-3 mt-1">
                    <Label className="text-sm font-semibold">Coordonnées bancaires</Label>
                  </div>
                  <div>
                    <Label htmlFor="iban">IBAN</Label>
                    <Input id="iban" {...register("iban")} placeholder="FR76 1234 5678 9012 3456 7890 123" />
                  </div>
                  <div>
                    <Label htmlFor="bic">BIC</Label>
                    <Input id="bic" {...register("bic")} placeholder="BNPAFRPP" />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <input type="checkbox" id="invoice_by_email" {...register("invoice_by_email")} className="rounded border-input" />
                    <Label htmlFor="invoice_by_email" className="mb-0">Facture par email</Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="commercial" className="mt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="advisor">Commercial responsable</Label>
                    <Input id="advisor" {...register("advisor")} placeholder="Nom du commercial" />
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
                    <Label htmlFor="commercial_notes">Notes commerciales</Label>
                    <Textarea id="commercial_notes" {...register("commercial_notes")} rows={2} placeholder="Informations commerciales importantes..." />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-0">
                <div>
                  <Label htmlFor="notes">Notes internes</Label>
                  <Textarea id="notes" {...register("notes")} rows={3} placeholder="Notes, annotations, historique..." />
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex justify-end gap-2 pt-3 pb-1 border-t mt-2">
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
