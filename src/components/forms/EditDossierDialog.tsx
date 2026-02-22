import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { FileText, MapPin, ClipboardList, Warehouse } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const DEPOT_ADDRESS = { address: "12 rue Jean Monnet", postal_code: "95190", city: "Goussainville" };
const executionOptions = ["Route", "Maritime", "Aérien", "Ferroviaire", "Mixte"];

const stageOptions = [
  { value: "prospect", label: "Prospect" },
  { value: "devis", label: "Devis" },
  { value: "accepte", label: "Accepté" },
  { value: "planifie", label: "Planifié" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminé" },
  { value: "facture", label: "Facturé" },
  { value: "paye", label: "Payé" },
];

const schema = z.object({
  title: z.string().trim().min(1, "L'intitulé est requis").max(300),
  code: z.string().trim().max(20).optional(),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(500).optional(),
  amount: z.coerce.number().min(0).optional(),
  stage: z.string(),
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
  // Chargement
  loading_address: z.string().trim().max(500).optional(),
  loading_postal_code: z.string().trim().max(10).optional(),
  loading_city: z.string().trim().max(100).optional(),
  loading_floor: z.string().trim().max(20).optional(),
  loading_access: z.string().trim().max(500).optional(),
  loading_elevator: z.boolean().default(false),
  loading_parking_request: z.boolean().default(false),
  loading_comments: z.string().trim().max(1000).optional(),
  // Livraison
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

interface EditDossierDialogProps {
  dossier: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditDossierDialog = ({ dossier, open, onOpenChange }: EditDossierDialogProps) => {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open && dossier) {
      reset({
        title: dossier.title || "",
        code: dossier.code || "",
        description: dossier.description || "",
        address: dossier.address || "",
        amount: dossier.amount || 0,
        stage: dossier.stage,
        volume: dossier.volume || 0,
        weight: dossier.weight || 0,
        distance: dossier.distance || 0,
        execution_mode: dossier.execution_mode || "Route",
        nature: dossier.nature || "",
        dossier_type: dossier.dossier_type || "",
        origin: dossier.origin || "",
        advisor: dossier.advisor || "",
        coordinator: dossier.coordinator || "",
        loss_reason: dossier.loss_reason || "",
        start_date: dossier.start_date || "",
        end_date: dossier.end_date || "",
        visite_date: dossier.visite_date || "",
        confirmation_date: dossier.confirmation_date || "",
        loading_address: dossier.loading_address || "",
        loading_postal_code: dossier.loading_postal_code || "",
        loading_city: dossier.loading_city || "",
        loading_floor: dossier.loading_floor || "",
        loading_access: dossier.loading_access || "",
        loading_elevator: dossier.loading_elevator || false,
        loading_parking_request: dossier.loading_parking_request || false,
        loading_comments: dossier.loading_comments || "",
        delivery_address: dossier.delivery_address || "",
        delivery_postal_code: dossier.delivery_postal_code || "",
        delivery_city: dossier.delivery_city || "",
        delivery_floor: dossier.delivery_floor || "",
        delivery_access: dossier.delivery_access || "",
        delivery_elevator: dossier.delivery_elevator || false,
        delivery_parking_request: dossier.delivery_parking_request || false,
        delivery_comments: dossier.delivery_comments || "",
        instructions: dossier.instructions || "",
        notes: dossier.notes || "",
      });
    }
  }, [open, dossier, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("dossiers").update({
        title: data.title,
        code: data.code || null,
        description: data.description || null,
        address: data.address || null,
        amount: data.amount || 0,
        stage: data.stage as any,
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
      }).eq("id", dossier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dossier modifié avec succès");
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      queryClient.invalidateQueries({ queryKey: ["client-dossiers"] });
      queryClient.invalidateQueries({ queryKey: ["dossier", dossier.id] });
      onOpenChange(false);
    },
    onError: () => toast.error("Erreur lors de la modification"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Modifier le dossier</DialogTitle>
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
                  <div className="col-span-2">
                    <Label htmlFor="edit-title">Libellé du dossier *</Label>
                    <Input id="edit-title" {...register("title")} />
                    {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="edit-code">Code / Référence</Label>
                    <Input id="edit-code" {...register("code")} />
                  </div>
                  <div>
                    <Label>Statut</Label>
                    <Select value={watch("stage")} onValueChange={(v) => setValue("stage", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {stageOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-amount">Montant (€)</Label>
                    <Input id="edit-amount" type="number" step="0.01" {...register("amount")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-address">Adresse chantier</Label>
                    <AddressAutocomplete id="edit-address" value={watch("address") || ""} onChange={(v) => setValue("address", v)} />
                  </div>

                  {/* Dates */}
                  <div className="col-span-2 border-t pt-3 mt-1">
                    <Label className="text-sm font-semibold">Dates</Label>
                  </div>
                  <div>
                    <Label htmlFor="edit-start">Date début</Label>
                    <Input id="edit-start" type="date" {...register("start_date")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-end">Date fin</Label>
                    <Input id="edit-end" type="date" {...register("end_date")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-visite">Date visite</Label>
                    <Input id="edit-visite" type="date" {...register("visite_date")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-confirm">Date confirmation</Label>
                    <Input id="edit-confirm" type="date" {...register("confirmation_date")} />
                  </div>

                  {/* Détails techniques */}
                  <div className="col-span-2 border-t pt-3 mt-1">
                    <Label className="text-sm font-semibold">Détails techniques</Label>
                  </div>
                  <div>
                    <Label htmlFor="edit-volume">Volume (m³)</Label>
                    <Input id="edit-volume" type="number" step="0.01" {...register("volume")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-weight">Poids (t)</Label>
                    <Input id="edit-weight" type="number" step="0.01" {...register("weight")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-distance">Distance (km)</Label>
                    <Input id="edit-distance" type="number" step="1" {...register("distance")} />
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
                    <Label htmlFor="edit-nature">Nature</Label>
                    <Input id="edit-nature" {...register("nature")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-type">Type</Label>
                    <Input id="edit-type" {...register("dossier_type")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-origin">Origine</Label>
                    <Input id="edit-origin" {...register("origin")} />
                  </div>

                  {/* Informations internes */}
                  <div className="col-span-2 border-t pt-3 mt-1">
                    <Label className="text-sm font-semibold">Informations internes</Label>
                  </div>
                  <div>
                    <Label htmlFor="edit-advisor">Conseiller</Label>
                    <Input id="edit-advisor" {...register("advisor")} />
                  </div>
                  <div>
                    <Label htmlFor="edit-coordinator">Coordinateur</Label>
                    <Input id="edit-coordinator" {...register("coordinator")} />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="edit-desc">Description</Label>
                    <Textarea id="edit-desc" {...register("description")} rows={2} />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="edit-loss">Raison de la perte</Label>
                    <Input id="edit-loss" {...register("loss_reason")} />
                  </div>
                </div>
              </TabsContent>

              {/* ── Adresses ── */}
              <TabsContent value="addresses" className="mt-0">
                <div className="space-y-6">
                  {/* Chargement */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-primary">Chargement</Label>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setValue("loading_address", DEPOT_ADDRESS.address); setValue("loading_postal_code", DEPOT_ADDRESS.postal_code); setValue("loading_city", DEPOT_ADDRESS.city); }}>
                        <Warehouse className="h-3 w-3" /> Dépôt
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="col-span-2">
                        <Label>Adresse</Label>
                        <AddressAutocomplete
                          id="edit-loading-addr"
                          value={watch("loading_address") || ""}
                          onChange={(v) => setValue("loading_address", v)}
                          onSelect={(s) => {
                            if (s.postcode) setValue("loading_postal_code", s.postcode);
                            if (s.city) setValue("loading_city", s.city);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-lpc">Code postal</Label>
                        <Input id="edit-lpc" {...register("loading_postal_code")} />
                      </div>
                      <div>
                        <Label htmlFor="edit-lcity">Ville</Label>
                        <Input id="edit-lcity" {...register("loading_city")} />
                      </div>
                      <div>
                        <Label htmlFor="edit-lfloor">Étage</Label>
                        <Input id="edit-lfloor" {...register("loading_floor")} />
                      </div>
                      <div>
                        <Label htmlFor="edit-laccess">Accès</Label>
                        <Input id="edit-laccess" {...register("loading_access")} />
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="edit-lelev" {...register("loading_elevator")} className="rounded border-input" />
                        <Label htmlFor="edit-lelev" className="mb-0">Ascenseur</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="edit-lpark" {...register("loading_parking_request")} className="rounded border-input" />
                        <Label htmlFor="edit-lpark" className="mb-0">Demande stationnement</Label>
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="edit-lcom">Commentaires</Label>
                        <Textarea id="edit-lcom" {...register("loading_comments")} rows={2} />
                      </div>
                    </div>
                  </div>

                  {/* Livraison */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-primary">Livraison</Label>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setValue("delivery_address", DEPOT_ADDRESS.address); setValue("delivery_postal_code", DEPOT_ADDRESS.postal_code); setValue("delivery_city", DEPOT_ADDRESS.city); }}>
                        <Warehouse className="h-3 w-3" /> Dépôt
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="col-span-2">
                        <Label>Adresse</Label>
                        <AddressAutocomplete
                          id="edit-delivery-addr"
                          value={watch("delivery_address") || ""}
                          onChange={(v) => setValue("delivery_address", v)}
                          onSelect={(s) => {
                            if (s.postcode) setValue("delivery_postal_code", s.postcode);
                            if (s.city) setValue("delivery_city", s.city);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-dpc">Code postal</Label>
                        <Input id="edit-dpc" {...register("delivery_postal_code")} />
                      </div>
                      <div>
                        <Label htmlFor="edit-dcity">Ville</Label>
                        <Input id="edit-dcity" {...register("delivery_city")} />
                      </div>
                      <div>
                        <Label htmlFor="edit-dfloor">Étage</Label>
                        <Input id="edit-dfloor" {...register("delivery_floor")} />
                      </div>
                      <div>
                        <Label htmlFor="edit-daccess">Accès</Label>
                        <Input id="edit-daccess" {...register("delivery_access")} />
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="edit-delev" {...register("delivery_elevator")} className="rounded border-input" />
                        <Label htmlFor="edit-delev" className="mb-0">Ascenseur</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="edit-dpark" {...register("delivery_parking_request")} className="rounded border-input" />
                        <Label htmlFor="edit-dpark" className="mb-0">Demande stationnement</Label>
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="edit-dcom">Commentaires</Label>
                        <Textarea id="edit-dcom" {...register("delivery_comments")} rows={2} />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── Instructions ── */}
              <TabsContent value="instructions" className="mt-0">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-instructions">Instructions / Consignes</Label>
                    <p className="text-xs text-muted-foreground mb-2">Consignes spécifiques transmises aux équipes terrain</p>
                    <Textarea id="edit-instructions" {...register("instructions")} rows={8} />
                  </div>
                  <div>
                    <Label htmlFor="edit-notes">Notes internes</Label>
                    <Textarea id="edit-notes" {...register("notes")} rows={3} />
                  </div>
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
