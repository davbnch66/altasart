import { useState, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Plus, FileText, MapPin, ClipboardList, Warehouse, ChevronsUpDown, Check, UserPlus } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { ContactSelect } from "@/components/client/ContactSelect";
import { CreateClientDialog } from "@/components/forms/CreateClientDialog";
import { cn } from "@/lib/utils";

const DEPOT_ADDRESS = { address: "12 rue Jean Monnet", postal_code: "95190", city: "Goussainville" };
const executionOptions = ["Route", "Maritime", "Aérien", "Ferroviaire", "Mixte"];

const schema = z.object({
  title: z.string().trim().min(1, "L'intitulé est requis").max(300),
  code: z.string().trim().max(20).optional(),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(500).optional(),
  amount: z.coerce.number().min(0).optional(),
  client_id: z.string().uuid("Sélectionnez un client"),
  company_id: z.string().uuid("Sélectionnez une société"),
  // Général
  volume: z.coerce.number().min(0).optional(),
  weight: z.coerce.number().min(0).optional(),
  distance: z.coerce.number().min(0).optional(),
  execution_mode: z.string().optional(),
  nature: z.string().trim().max(100).optional(),
  dossier_type: z.string().trim().max(100).optional(),
  origin: z.string().trim().max(100).optional(),
  advisor: z.string().trim().max(200).optional(),
  coordinator: z.string().trim().max(200).optional(),
  loss_reason: z.string().trim().max(500).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  visite_date: z.string().optional(),
  confirmation_date: z.string().optional(),
  // Adresses chargement
  loading_address: z.string().trim().max(500).optional(),
  loading_postal_code: z.string().trim().max(10).optional(),
  loading_city: z.string().trim().max(100).optional(),
  loading_floor: z.string().trim().max(20).optional(),
  loading_access: z.string().trim().max(500).optional(),
  loading_elevator: z.boolean().default(false),
  loading_parking_request: z.boolean().default(false),
  loading_comments: z.string().trim().max(1000).optional(),
  // Adresses livraison
  delivery_address: z.string().trim().max(500).optional(),
  delivery_postal_code: z.string().trim().max(10).optional(),
  delivery_city: z.string().trim().max(100).optional(),
  delivery_floor: z.string().trim().max(20).optional(),
  delivery_access: z.string().trim().max(500).optional(),
  delivery_elevator: z.boolean().default(false),
  delivery_parking_request: z.boolean().default(false),
  delivery_comments: z.string().trim().max(1000).optional(),
  // Instructions
  instructions: z.string().trim().max(5000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

type FormData = z.infer<typeof schema>;

const defaults: Partial<FormData> = {
  amount: 0, volume: 0, weight: 0, distance: 0,
  execution_mode: "Route",
  loading_elevator: false, loading_parking_request: false,
  delivery_elevator: false, delivery_parking_request: false,
};

interface CreateDossierDialogProps {
  preselectedClientId?: string;
  preselectedCompanyId?: string;
  trigger?: React.ReactNode;
}

export const CreateDossierDialog = ({ preselectedClientId, preselectedCompanyId, trigger }: CreateDossierDialogProps) => {
  const [open, setOpen] = useState(false);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();

  const defaultCompanyId = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || "");
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId);
  const [selectedContactId, setSelectedContactId] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-select", selectedCompanyId],
    queryFn: async () => {
      let query = supabase.from("clients").select("id, name, address, postal_code, city").order("name");
      if (selectedCompanyId) query = query.eq("company_id", selectedCompanyId);
      const { data } = await query;
      return data || [];
    },
    enabled: open,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { company_id: defaultCompanyId, ...defaults },
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
        volume: data.volume || 0,
        weight: data.weight || 0,
        distance: data.distance || 0,
        execution_mode: data.execution_mode || "route",
        nature: data.nature || null,
        dossier_type: data.dossier_type || null,
        origin: data.origin || null,
        advisor: data.advisor || null,
        coordinator: data.coordinator || null,
        loss_reason: data.loss_reason || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        visite_date: data.visite_date || null,
        confirmation_date: data.confirmation_date || null,
        instructions: data.instructions || null,
        notes: data.notes || null,
        loading_address: data.loading_address || null,
        loading_postal_code: data.loading_postal_code || null,
        loading_city: data.loading_city || null,
        loading_floor: data.loading_floor || null,
        loading_access: data.loading_access || null,
        loading_elevator: data.loading_elevator || false,
        loading_parking_request: data.loading_parking_request || false,
        loading_comments: data.loading_comments || null,
        delivery_address: data.delivery_address || null,
        delivery_postal_code: data.delivery_postal_code || null,
        delivery_city: data.delivery_city || null,
        delivery_floor: data.delivery_floor || null,
        delivery_access: data.delivery_access || null,
        delivery_elevator: data.delivery_elevator || false,
        delivery_parking_request: data.delivery_parking_request || false,
        delivery_comments: data.delivery_comments || null,
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

  const handleClientChange = (clientId: string) => {
    setValue("client_id", clientId);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      if (client.address) setValue("loading_address", client.address);
      if (client.postal_code) setValue("loading_postal_code", client.postal_code);
      if (client.city) setValue("loading_city", client.city);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (v) {
        const cid = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || "");
        setSelectedCompanyId(cid);
        reset({ company_id: cid, client_id: preselectedClientId || ("" as any), ...defaults });
        setSelectedContactId("");
      }
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nouveau dossier
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nouveau dossier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full flex-wrap h-auto gap-1 justify-start">
              <TabsTrigger value="general" className="flex items-center gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" /> Généralités
              </TabsTrigger>
              <TabsTrigger value="addresses" className="flex items-center gap-1.5 text-xs">
                <MapPin className="h-3.5 w-3.5" /> Adresses
              </TabsTrigger>
              <TabsTrigger value="instructions" className="flex items-center gap-1.5 text-xs">
                <ClipboardList className="h-3.5 w-3.5" /> Instructions
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-1 mt-2">
              {/* ── Généralités ── */}
              <TabsContent value="general" className="mt-0">
                <div className="grid grid-cols-2 gap-3">
                  {/* Identification */}
                  <div>
                    <Label>Société *</Label>
                    <Select value={watch("company_id")} onValueChange={handleCompanyChange}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {dbCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {errors.company_id && <p className="text-xs text-destructive mt-1">{errors.company_id.message}</p>}
                  </div>
                  <div>
                    <Label>Client *</Label>
                    <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={clientPopoverOpen} className="w-full justify-between font-normal h-10">
                          {watch("client_id") ? clients.find(c => c.id === watch("client_id"))?.name || "Sélectionner" : "Rechercher un client..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput placeholder="Taper pour rechercher..." value={clientSearch} onValueChange={setClientSearch} />
                          <CommandList>
                            <CommandEmpty className="py-2 px-3 text-sm text-muted-foreground">
                              Aucun client trouvé
                            </CommandEmpty>
                            <CommandGroup>
                              {clients
                                .filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                                .slice(0, 50)
                                .map((c) => (
                                  <CommandItem
                                    key={c.id}
                                    value={c.id}
                                    onSelect={() => { handleClientChange(c.id); setClientPopoverOpen(false); setClientSearch(""); }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", watch("client_id") === c.id ? "opacity-100" : "opacity-0")} />
                                    {c.name}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandGroup>
                              <CommandItem
                                onSelect={() => {
                                  setClientPopoverOpen(false);
                                  setTimeout(() => setCreateClientOpen(true), 150);
                                }}
                                className="text-primary cursor-pointer"
                              >
                                <UserPlus className="mr-2 h-4 w-4" />
                                Créer un nouveau client
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {errors.client_id && <p className="text-xs text-destructive mt-1">{errors.client_id.message}</p>}
                  </div>
                  {watch("client_id") && (
                    <div className="col-span-2">
                      <ContactSelect clientId={watch("client_id")} value={selectedContactId} onChange={setSelectedContactId} label="Contact référent" />
                    </div>
                  )}
                  <div className="col-span-2">
                    <Label htmlFor="title">Libellé du dossier *</Label>
                    <Input id="title" {...register("title")} placeholder="Intitulé du dossier" />
                    {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="code">Code / Référence</Label>
                    <Input id="code" {...register("code")} placeholder="DOS-2026-XXX" />
                  </div>
                  <div>
                    <Label htmlFor="amount">Montant (€)</Label>
                    <Input id="amount" type="number" step="0.01" {...register("amount")} />
                  </div>

                  {/* Dates */}
                  <div className="col-span-2 border-t pt-3 mt-1">
                    <Label className="text-sm font-semibold">Dates</Label>
                  </div>
                  <div>
                    <Label htmlFor="start_date">Date début</Label>
                    <Input id="start_date" type="date" {...register("start_date")} />
                  </div>
                  <div>
                    <Label htmlFor="end_date">Date fin</Label>
                    <Input id="end_date" type="date" {...register("end_date")} />
                  </div>
                  <div>
                    <Label htmlFor="visite_date">Date visite</Label>
                    <Input id="visite_date" type="date" {...register("visite_date")} />
                  </div>
                  <div>
                    <Label htmlFor="confirmation_date">Date confirmation</Label>
                    <Input id="confirmation_date" type="date" {...register("confirmation_date")} />
                  </div>

                  {/* Détails techniques */}
                  <div className="col-span-2 border-t pt-3 mt-1">
                    <Label className="text-sm font-semibold">Détails techniques</Label>
                  </div>
                  <div className="col-span-2 rounded-lg border border-dashed bg-muted/30 p-3">
                    <p className="text-[10px] text-muted-foreground italic">📦 La liste de matériel sera récupérée automatiquement depuis la visite liée au dossier.</p>
                  </div>
                  <div>
                    <Label htmlFor="distance">Distance (km)</Label>
                    <Input id="distance" type="number" step="1" {...register("distance")} />
                  </div>
                  <div>
                    <Label>Mode d'exécution</Label>
                    <Select value={watch("execution_mode") || "Route"} onValueChange={(v) => setValue("execution_mode", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {executionOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="nature">Nature</Label>
                    <Input id="nature" {...register("nature")} placeholder="Ex: Déménagement" />
                  </div>
                  <div>
                    <Label htmlFor="dossier_type">Type</Label>
                    <Input id="dossier_type" {...register("dossier_type")} placeholder="Ex: National" />
                  </div>
                  <div>
                    <Label htmlFor="origin">Origine</Label>
                    <Input id="origin" {...register("origin")} placeholder="Ex: Appel d'offres" />
                  </div>

                  {/* Informations internes */}
                  <div className="col-span-2 border-t pt-3 mt-1">
                    <Label className="text-sm font-semibold">Informations internes</Label>
                  </div>
                  <div>
                    <Label htmlFor="advisor">Conseiller</Label>
                    <Input id="advisor" {...register("advisor")} placeholder="Nom du conseiller" />
                  </div>
                  <div>
                    <Label htmlFor="coordinator">Coordinateur</Label>
                    <Input id="coordinator" {...register("coordinator")} placeholder="Nom du coordinateur" />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" {...register("description")} rows={2} placeholder="Description du dossier..." />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="loss_reason">Raison de la perte</Label>
                    <Input id="loss_reason" {...register("loss_reason")} placeholder="Si dossier perdu..." />
                  </div>
                </div>
              </TabsContent>

              {/* ── Adresses ── */}
              <TabsContent value="addresses" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Chargement */}
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold uppercase tracking-wider text-primary">Chargement</Label>
                      <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => { setValue("loading_address", DEPOT_ADDRESS.address); setValue("loading_postal_code", DEPOT_ADDRESS.postal_code); setValue("loading_city", DEPOT_ADDRESS.city); }}>
                        <Warehouse className="h-3 w-3" /> Dépôt
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Adresse</Label>
                      <AddressAutocomplete id="loading-address" value={watch("loading_address") || ""} onChange={(v) => setValue("loading_address", v)} onSelect={(s) => { if (s.postcode) setValue("loading_postal_code", s.postcode); if (s.city) setValue("loading_city", s.city); }} placeholder="Adresse de chargement" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">CP</Label><Input {...register("loading_postal_code")} className="h-8 text-xs" /></div>
                      <div><Label className="text-xs">Ville</Label><Input {...register("loading_city")} className="h-8 text-xs" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">Étage</Label><Input {...register("loading_floor")} placeholder="RDC, 3e..." className="h-8 text-xs" /></div>
                      <div><Label className="text-xs">Accès</Label><Input {...register("loading_access")} placeholder="Portail..." className="h-8 text-xs" /></div>
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" {...register("loading_elevator")} className="rounded border-input" />Ascenseur</label>
                      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" {...register("loading_parking_request")} className="rounded border-input" />Stationnement</label>
                    </div>
                    <div><Label className="text-xs">Commentaires</Label><Textarea {...register("loading_comments")} rows={2} className="text-xs" /></div>
                  </div>

                  {/* Livraison */}
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold uppercase tracking-wider text-primary">Livraison</Label>
                      <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => { setValue("delivery_address", DEPOT_ADDRESS.address); setValue("delivery_postal_code", DEPOT_ADDRESS.postal_code); setValue("delivery_city", DEPOT_ADDRESS.city); }}>
                        <Warehouse className="h-3 w-3" /> Dépôt
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Adresse</Label>
                      <AddressAutocomplete id="delivery-address" value={watch("delivery_address") || ""} onChange={(v) => setValue("delivery_address", v)} onSelect={(s) => { if (s.postcode) setValue("delivery_postal_code", s.postcode); if (s.city) setValue("delivery_city", s.city); }} placeholder="Adresse de livraison" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">CP</Label><Input {...register("delivery_postal_code")} className="h-8 text-xs" /></div>
                      <div><Label className="text-xs">Ville</Label><Input {...register("delivery_city")} className="h-8 text-xs" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">Étage</Label><Input {...register("delivery_floor")} placeholder="RDC, 3e..." className="h-8 text-xs" /></div>
                      <div><Label className="text-xs">Accès</Label><Input {...register("delivery_access")} placeholder="Portail..." className="h-8 text-xs" /></div>
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" {...register("delivery_elevator")} className="rounded border-input" />Ascenseur</label>
                      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" {...register("delivery_parking_request")} className="rounded border-input" />Stationnement</label>
                    </div>
                    <div><Label className="text-xs">Commentaires</Label><Textarea {...register("delivery_comments")} rows={2} className="text-xs" /></div>
                  </div>
                </div>
              </TabsContent>

              {/* ── Instructions ── */}
              <TabsContent value="instructions" className="mt-0">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="instructions">Instructions / Consignes</Label>
                    <p className="text-xs text-muted-foreground mb-2">Consignes spécifiques transmises aux équipes terrain</p>
                    <Textarea id="instructions" {...register("instructions")} rows={8} placeholder="Instructions pour l'exécution du dossier..." />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes internes</Label>
                    <Textarea id="notes" {...register("notes")} rows={3} placeholder="Notes, annotations..." />
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex justify-end gap-2 pt-3 pb-1 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Création..." : "Créer le dossier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <CreateClientDialog
      open={createClientOpen}
      onOpenChange={setCreateClientOpen}
      onClientCreated={(clientId) => {
        handleClientChange(clientId);
      }}
    />
    </>
  );
};
