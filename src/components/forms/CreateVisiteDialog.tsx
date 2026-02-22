import { useState, useRef, useEffect } from "react";
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
import { Plus, FileText, Calendar, MapPin, StickyNote } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { ContactSelect } from "@/components/client/ContactSelect";

const visitTypeOptions = ["VT - Visite Technique", "VC - Visite Commerciale", "VI - Visite d'Inspection", "VR - Visite de Réception"];

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

interface CreateVisiteDialogProps {
  trigger?: React.ReactNode;
  preselectedClientId?: string;
  preselectedCompanyId?: string;
  preselectedDossierId?: string;
}

export const CreateVisiteDialog = ({ trigger, preselectedClientId, preselectedCompanyId, preselectedDossierId }: CreateVisiteDialogProps = {}) => {
  const [open, setOpen] = useState(false);
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();
  const [selectedContactId, setSelectedContactId] = useState("");

  const defaultCompanyId = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || "");
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-visite", selectedCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, code, address, postal_code, city")
        .eq("company_id", selectedCompanyId)
        .order("name");
      return data || [];
    },
    enabled: open && !!selectedCompanyId,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { company_id: defaultCompanyId, client_id: preselectedClientId || ("" as any) },
  });

  const watchClientId = watch("client_id");
  const prevClientRef = useRef("");
  useEffect(() => {
    if (watchClientId && watchClientId !== prevClientRef.current) {
      prevClientRef.current = watchClientId;
      const selectedClient = clients.find(c => c.id === watchClientId);
      if (selectedClient) {
        if (selectedClient.address) setValue("address", selectedClient.address);
        if (selectedClient.postal_code) setValue("zone", selectedClient.city || selectedClient.postal_code);
      }
    }
  }, [watchClientId, clients, setValue]);

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
        dossier_id: preselectedDossierId || null,
        status: "planifiee",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visite créée");
      queryClient.invalidateQueries({ queryKey: ["visites"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-visites"] });
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
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { const cid = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || ""); setSelectedCompanyId(cid); reset({ company_id: cid, client_id: preselectedClientId || ("" as any), title: "" }); setSelectedContactId(""); } }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nouvelle visite
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nouvelle visite</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full flex-wrap h-auto gap-1 justify-start">
              <TabsTrigger value="general" className="flex items-center gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" /> Général
              </TabsTrigger>
              <TabsTrigger value="planning" className="flex items-center gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5" /> Planification
              </TabsTrigger>
              <TabsTrigger value="address" className="flex items-center gap-1.5 text-xs">
                <MapPin className="h-3.5 w-3.5" /> Adresse
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-1.5 text-xs">
                <StickyNote className="h-3.5 w-3.5" /> Notes
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-1 mt-2">
              {/* ── Général ── */}
              <TabsContent value="general" className="mt-0">
                <div className="grid grid-cols-2 gap-3">
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
                    <Select value={watch("client_id") || ""} onValueChange={(v) => setValue("client_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.code ? `${c.code} - ` : ""}{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {errors.client_id && <p className="text-xs text-destructive mt-1">{errors.client_id.message}</p>}
                  </div>
                  {watch("client_id") && (
                    <div className="col-span-2">
                      <ContactSelect clientId={watch("client_id")} value={selectedContactId} onChange={setSelectedContactId} label="Contact sur site" />
                    </div>
                  )}
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
                    <Label>Type de visite</Label>
                    <Select value={watch("visit_type") || ""} onValueChange={(v) => setValue("visit_type", v)}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {visitTypeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="visite-advisor">Conseiller / Technicien</Label>
                    <Input id="visite-advisor" {...register("advisor")} placeholder="Nom du responsable" />
                  </div>
                </div>
              </TabsContent>

              {/* ── Planification ── */}
              <TabsContent value="planning" className="mt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="visite-date">Date</Label>
                    <Input id="visite-date" type="date" {...register("scheduled_date")} />
                  </div>
                  <div>
                    <Label htmlFor="visite-time">Heure</Label>
                    <Input id="visite-time" type="time" {...register("scheduled_time")} />
                  </div>
                  <div className="col-span-2 pt-2">
                    <p className="text-xs text-muted-foreground">💡 Après création, vous pourrez planifier plus finement depuis le calendrier.</p>
                  </div>
                </div>
              </TabsContent>

              {/* ── Adresse ── */}
              <TabsContent value="address" className="mt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label htmlFor="visite-address">Adresse du rendez-vous</Label>
                    <AddressAutocomplete
                      id="visite-address"
                      value={watch("address") || ""}
                      onChange={(v) => setValue("address", v)}
                      placeholder="Adresse du rendez-vous"
                    />
                  </div>
                  <div>
                    <Label htmlFor="visite-zone">Zone / Ville</Label>
                    <Input id="visite-zone" {...register("zone")} placeholder="Paris, Lyon..." />
                  </div>
                </div>
              </TabsContent>

              {/* ── Notes ── */}
              <TabsContent value="notes" className="mt-0">
                <div>
                  <Label htmlFor="visite-notes">Notes / Observations</Label>
                  <Textarea id="visite-notes" {...register("notes")} rows={6} placeholder="Notes, observations, points à vérifier..." />
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex justify-end gap-2 pt-3 pb-1 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Création..." : "Créer la visite"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
