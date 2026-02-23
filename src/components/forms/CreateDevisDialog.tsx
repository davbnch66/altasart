import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/hooks/useAuth";
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
import { Plus, FileText, Euro, StickyNote } from "lucide-react";
import { ContactSelect } from "@/components/client/ContactSelect";
import { Separator } from "@/components/ui/separator";

const schema = z.object({
  objet: z.string().trim().min(1, "L'objet est requis").max(500),
  code: z.string().trim().max(20).optional(),
  amount: z.coerce.number().min(0, "Le montant doit être positif"),
  notes: z.string().trim().max(2000).optional(),
  valid_until: z.string().optional(),
  client_id: z.string().uuid("Sélectionnez un client"),
  company_id: z.string().uuid("Sélectionnez une société"),
  dossier_id: z.string().uuid("Sélectionnez un dossier"),
});

type FormData = z.infer<typeof schema>;

interface CreateDevisDialogProps {
  preselectedClientId?: string;
  preselectedCompanyId?: string;
  preselectedDossierId?: string;
  trigger?: React.ReactNode;
}

export const CreateDevisDialog = ({ preselectedClientId, preselectedCompanyId, preselectedDossierId, trigger }: CreateDevisDialogProps) => {
  const [open, setOpen] = useState(false);
  const { current, dbCompanies } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [creatingDossier, setCreatingDossier] = useState(false);
  const [newDossierTitle, setNewDossierTitle] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");

  const defaultCompanyId = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || "");
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId);
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || "");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-select", selectedCompanyId],
    queryFn: async () => {
      let query = supabase.from("clients").select("id, name, address, city, postal_code, email, phone").order("name");
      if (selectedCompanyId) query = query.eq("company_id", selectedCompanyId);
      const { data } = await query;
      return data || [];
    },
    enabled: open,
  });

  const { data: dossiers = [], refetch: refetchDossiers } = useQuery({
    queryKey: ["dossiers-for-select", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data } = await supabase.from("dossiers").select("id, title, code, address, volume, weight").eq("client_id", selectedClientId).order("title");
      return data || [];
    },
    enabled: open && !!selectedClientId,
  });

  const { data: visites = [] } = useQuery({
    queryKey: ["visites-for-select", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data } = await supabase.from("visites").select("id, title, code").eq("client_id", selectedClientId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: open && !!selectedClientId,
  });

  // Default valid_until = today + 30 days
  const defaultValidUntil = new Date();
  defaultValidUntil.setDate(defaultValidUntil.getDate() + 30);
  const defaultValidUntilStr = defaultValidUntil.toISOString().split("T")[0];

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { company_id: defaultCompanyId, amount: 0, dossier_id: preselectedDossierId || "", valid_until: defaultValidUntilStr },
  });

  const selectedClient = clients.find((c) => c.id === watch("client_id"));
  const selectedDossier = dossiers.find((d) => d.id === watch("dossier_id"));

  const createDossierMutation = useMutation({
    mutationFn: async () => {
      if (!newDossierTitle.trim() || !selectedClientId || !selectedCompanyId) return;
      const { data, error } = await supabase.from("dossiers").insert({
        title: newDossierTitle.trim(),
        client_id: selectedClientId,
        company_id: selectedCompanyId,
      }).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        toast.success("Dossier créé");
        setValue("dossier_id", data.id);
        refetchDossiers();
        queryClient.invalidateQueries({ queryKey: ["dossiers"] });
        queryClient.invalidateQueries({ queryKey: ["client-dossiers"] });
      }
      setCreatingDossier(false);
      setNewDossierTitle("");
    },
    onError: () => toast.error("Erreur lors de la création du dossier"),
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("devis").insert({
        objet: data.objet,
        code: data.code || null,
        amount: data.amount,
        notes: data.notes || null,
        valid_until: data.valid_until || null,
        client_id: data.client_id,
        company_id: data.company_id,
        dossier_id: data.dossier_id,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devis créé avec succès");
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      queryClient.invalidateQueries({ queryKey: ["client-devis"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-devis"] });
      reset();
      setOpen(false);
    },
    onError: () => toast.error("Erreur lors de la création du devis"),
  });

  const handleCompanyChange = (v: string) => {
    setValue("company_id", v);
    setSelectedCompanyId(v);
    setValue("client_id", "" as any);
    setSelectedClientId("");
    setValue("dossier_id", "" as any);
  };

  const handleClientChange = (v: string) => {
    setValue("client_id", v);
    setSelectedClientId(v);
    setValue("dossier_id", "" as any);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { const cid = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || ""); setSelectedCompanyId(cid); setSelectedClientId(preselectedClientId || ""); reset({ company_id: cid, client_id: preselectedClientId || ("" as any), amount: 0, dossier_id: preselectedDossierId || ("" as any), valid_until: defaultValidUntilStr }); setCreatingDossier(false); setSelectedContactId(""); } }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nouveau devis
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau devis</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="general" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Général</TabsTrigger>
              <TabsTrigger value="financier" className="gap-1.5 text-xs"><Euro className="h-3.5 w-3.5" /> Financier</TabsTrigger>
              <TabsTrigger value="notes" className="gap-1.5 text-xs"><StickyNote className="h-3.5 w-3.5" /> Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              {/* Société & Client */}
              <div className="grid grid-cols-2 gap-4">
                <div>
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
                <div>
                  <Label>Client *</Label>
                  <Select value={watch("client_id")} onValueChange={handleClientChange}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.client_id && <p className="text-xs text-destructive mt-1">{errors.client_id.message}</p>}
                </div>
              </div>

              {/* Client info summary */}
              {selectedClient && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                  <p className="font-medium text-sm">{selectedClient.name}</p>
                  {selectedClient.address && <p className="text-muted-foreground">{selectedClient.address}{selectedClient.postal_code ? `, ${selectedClient.postal_code}` : ""}{selectedClient.city ? ` ${selectedClient.city}` : ""}</p>}
                  <div className="flex gap-4">
                    {selectedClient.email && <p className="text-muted-foreground">✉ {selectedClient.email}</p>}
                    {selectedClient.phone && <p className="text-muted-foreground">☎ {selectedClient.phone}</p>}
                  </div>
                </div>
              )}

              {/* Dossier */}
              <div>
                <Label>Dossier *</Label>
                {creatingDossier ? (
                  <div className="flex gap-2">
                    <Input
                      value={newDossierTitle}
                      onChange={(e) => setNewDossierTitle(e.target.value)}
                      placeholder="Titre du nouveau dossier"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createDossierMutation.mutate(); } if (e.key === "Escape") setCreatingDossier(false); }}
                    />
                    <Button type="button" size="sm" onClick={() => createDossierMutation.mutate()} disabled={!newDossierTitle.trim() || createDossierMutation.isPending}>
                      {createDossierMutation.isPending ? "..." : "Créer"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setCreatingDossier(false)}>✕</Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select value={watch("dossier_id") || ""} onValueChange={(v) => setValue("dossier_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner un dossier" /></SelectTrigger>
                        <SelectContent>
                          {dossiers.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.code ? `${d.code} — ` : ""}{d.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedClientId && (
                      <Button type="button" size="icon" variant="outline" onClick={() => setCreatingDossier(true)} title="Créer un dossier">
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
                {errors.dossier_id && <p className="text-xs text-destructive mt-1">{errors.dossier_id.message}</p>}
                {!selectedClientId && <p className="text-xs text-muted-foreground mt-1">Sélectionnez d'abord un client</p>}
              </div>

              {/* Dossier info */}
              {selectedDossier && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                  <p className="font-medium text-sm">{selectedDossier.code ? `${selectedDossier.code} — ` : ""}{selectedDossier.title}</p>
                  {selectedDossier.address && <p className="text-muted-foreground">📍 {selectedDossier.address}</p>}
                  <div className="flex gap-4">
                    {selectedDossier.volume ? <p className="text-muted-foreground">📦 {selectedDossier.volume} m³</p> : null}
                    {selectedDossier.weight ? <p className="text-muted-foreground">⚖️ {selectedDossier.weight} kg</p> : null}
                  </div>
                </div>
              )}

              <Separator />

              {/* Contact destinataire */}
              {selectedClientId && (
                <ContactSelect
                  clientId={selectedClientId}
                  value={selectedContactId}
                  onChange={setSelectedContactId}
                  label="Contact destinataire"
                />
              )}

              {/* Objet & Code */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="objet">Objet *</Label>
                  <Input id="objet" {...register("objet")} placeholder="Objet du devis" />
                  {errors.objet && <p className="text-xs text-destructive mt-1">{errors.objet.message}</p>}
                </div>
                <div>
                  <Label htmlFor="code">Code / Réf.</Label>
                  <Input id="code" {...register("code")} placeholder="DEV-2026-XXX" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="financier" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Montant HT (€) *</Label>
                  <Input id="amount" type="number" step="0.01" {...register("amount")} />
                  {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <Label htmlFor="valid_until">Valide jusqu'au</Label>
                  <Input id="valid_until" type="date" {...register("valid_until")} />
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="text-muted-foreground">Les lignes de devis détaillées pourront être ajoutées après la création, depuis la fiche du devis.</p>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="notes">Notes internes</Label>
                <Textarea id="notes" {...register("notes")} rows={4} placeholder="Notes internes, commentaires, précisions..." />
              </div>
            </TabsContent>
          </Tabs>

          <Separator />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Création..." : "Créer le devis"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
