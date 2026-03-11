import { useState, useEffect, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, MapPin, CreditCard, Briefcase, StickyNote, Loader2, Search } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { useSiretLookup } from "@/hooks/useSiretLookup";

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

interface EditClientDialogProps {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditClientDialog = ({ client, open, onOpenChange }: EditClientDialogProps) => {
  const { dbCompanies } = useCompany();
  const queryClient = useQueryClient();
  const [siretLoading, setSiretLoading] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const lookupSiret = useCallback(async () => {
    const siret = (watch("siret") || "").replace(/\s/g, "");
    if (siret.length !== 14) {
      toast.error("Le SIRET doit contenir 14 chiffres");
      return;
    }
    setSiretLoading(true);
    try {
      const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siret}&mtm_campaign=lovable`);
      if (!res.ok) throw new Error("API indisponible");
      const data = await res.json();
      const etab = data.results?.[0];
      if (!etab) { toast.error("Aucune entreprise trouvée pour ce SIRET"); return; }
      const siege = etab.siege || {};
      const matchingEtab = etab.matching_etablissements?.find((e: any) => e.siret === siret) || siege;
      if (etab.nom_complet) setValue("name", etab.nom_complet);
      if (etab.activite_principale) setValue("ape_naf", etab.activite_principale);
      const siren = siret.substring(0, 9);
      const tvaKey = (12 + 3 * (parseInt(siren) % 97)) % 97;
      setValue("tva_intra", `FR${String(tvaKey).padStart(2, "0")}${siren}`);
      const addr = matchingEtab || siege;
      if (addr.adresse) setValue("address", addr.adresse);
      if (addr.code_postal) setValue("postal_code", addr.code_postal);
      if (addr.commune) setValue("city", addr.commune);
      toast.success(`Données pré-remplies pour ${etab.nom_complet}`);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la recherche SIRET");
    } finally {
      setSiretLoading(false);
    }
  }, [watch, setValue]);

  useEffect(() => {
    if (open && client) {
      reset({
        name: client.name || "",
        code: client.code || "",
        client_type: client.client_type || "societe",
        status: client.status || "nouveau_lead",
        siret: client.siret || "",
        ape_naf: client.ape_naf || "",
        tva_intra: client.tva_intra || "",
        website: client.website || "",
        contact_name: client.contact_name || "",
        email: client.email || "",
        phone: client.phone || "",
        mobile: client.mobile || "",
        fax: client.fax || "",
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
        iban: client.iban || "",
        bic: client.bic || "",
        invoice_by_email: client.invoice_by_email || false,
        account_number: client.account_number || "",
        accounting_collective: client.accounting_collective || "",
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Modifier le client</DialogTitle>
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
                  <div>
                    <Label htmlFor="edit-siret">SIRET</Label>
                    <div className="flex gap-1.5">
                      <Input id="edit-siret" {...register("siret")} className="flex-1" />
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={lookupSiret} disabled={siretLoading} title="Rechercher les données de l'entreprise">
                        {siretLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit-ape">APE / NAF</Label>
                    <Input id="edit-ape" {...register("ape_naf")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-tva">TVA Intracommunautaire</Label>
                    <Input id="edit-tva" {...register("tva_intra")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-website">Site web</Label>
                    <Input id="edit-website" {...register("website")} />
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
              </TabsContent>

              <TabsContent value="contact" className="mt-0">
                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <Label htmlFor="edit-fax">Fax</Label>
                    <Input id="edit-fax" {...register("fax")} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">💡 Gérez les contacts multiples depuis l'onglet Contacts de la fiche client.</p>
              </TabsContent>

              <TabsContent value="address" className="mt-0">
                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <Label htmlFor="edit-account">N° de compte</Label>
                    <Input id="edit-account" {...register("account_number")} placeholder="411000" />
                  </div>
                  <div>
                    <Label htmlFor="edit-collective">Collectif</Label>
                    <Input id="edit-collective" {...register("accounting_collective")} placeholder="411" />
                  </div>
                  <div className="col-span-2 border-t pt-3 mt-1">
                    <Label className="text-sm font-semibold">Coordonnées bancaires</Label>
                  </div>
                  <div>
                    <Label htmlFor="edit-iban">IBAN</Label>
                    <Input id="edit-iban" {...register("iban")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-bic">BIC</Label>
                    <Input id="edit-bic" {...register("bic")} />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <input type="checkbox" id="edit-invoice-email" {...register("invoice_by_email")} className="rounded border-input" />
                    <Label htmlFor="edit-invoice-email" className="mb-0">Facture par email</Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="commercial" className="mt-0">
                <div className="grid grid-cols-2 gap-3">
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
              </TabsContent>

              <TabsContent value="notes" className="mt-0">
                <div>
                  <Label htmlFor="edit-notes">Notes internes</Label>
                  <Textarea id="edit-notes" {...register("notes")} rows={3} />
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex justify-end gap-2 pt-3 pb-1 border-t mt-2">
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
