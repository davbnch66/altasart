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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Plus, FileText, Euro, StickyNote, Link2 } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const schema = z.object({
  code: z.string().trim().max(20).optional(),
  amount: z.coerce.number().min(0, "Le montant doit être positif"),
  notes: z.string().trim().max(2000).optional(),
  due_date: z.string().optional(),
  client_id: z.string().uuid("Sélectionnez un client"),
  company_id: z.string().uuid("Sélectionnez une société"),
  dossier_id: z.string().optional(),
  devis_id: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateFactureDialogProps {
  preselectedClientId?: string;
  preselectedCompanyId?: string;
  preselectedDossierId?: string;
  trigger?: React.ReactNode;
}

export const CreateFactureDialog = ({ preselectedClientId, preselectedCompanyId, preselectedDossierId, trigger }: CreateFactureDialogProps) => {
  const [open, setOpen] = useState(false);
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();

  const defaultCompanyId = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || "");
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId);
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || "");

  // Default due date = today + 30 days
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 30);
  const defaultDueDateStr = defaultDueDate.toISOString().split("T")[0];

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-select", selectedCompanyId],
    queryFn: async () => {
      let query = supabase.from("clients").select("id, name, address, city, postal_code, email, phone, payment_terms, payment_method").order("name");
      if (selectedCompanyId) query = query.eq("company_id", selectedCompanyId);
      const { data } = await query;
      return data || [];
    },
    enabled: open,
  });

  const { data: dossiers = [] } = useQuery({
    queryKey: ["dossiers-for-select", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data } = await supabase.from("dossiers").select("id, title, code").eq("client_id", selectedClientId).order("title");
      return data || [];
    },
    enabled: open && !!selectedClientId,
  });

  const { data: devisList = [] } = useQuery({
    queryKey: ["devis-for-select", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data } = await supabase.from("devis").select("id, objet, code, amount").eq("client_id", selectedClientId).eq("status", "accepte").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: open && !!selectedClientId,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { company_id: defaultCompanyId, amount: 0, due_date: defaultDueDateStr },
  });

  const selectedClient = clients.find((c) => c.id === watch("client_id"));

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("factures").insert({
        code: data.code || null,
        amount: data.amount,
        notes: data.notes || null,
        due_date: data.due_date || null,
        client_id: data.client_id,
        company_id: data.company_id,
        dossier_id: data.dossier_id && data.dossier_id !== "none" ? data.dossier_id : null,
        devis_id: data.devis_id && data.devis_id !== "none" ? data.devis_id : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Facture créée avec succès");
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: ["finance-factures"] });
      queryClient.invalidateQueries({ queryKey: ["client-factures"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      reset();
      setOpen(false);
    },
    onError: () => toast.error("Erreur lors de la création de la facture"),
  });

  const handleCompanyChange = (v: string) => {
    setValue("company_id", v);
    setSelectedCompanyId(v);
    setValue("client_id", "" as any);
    setSelectedClientId("");
  };

  const handleClientChange = (v: string) => {
    setValue("client_id", v);
    setSelectedClientId(v);
    setValue("dossier_id", "");
    setValue("devis_id", "");
  };

  const handleDevisChange = (v: string) => {
    setValue("devis_id", v);
    if (v !== "none") {
      const d = devisList.find((d) => d.id === v);
      if (d) setValue("amount", Number(d.amount));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { const cid = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || ""); setSelectedCompanyId(cid); setSelectedClientId(preselectedClientId || ""); reset({ company_id: cid, client_id: preselectedClientId || ("" as any), amount: 0, dossier_id: preselectedDossierId || "", due_date: defaultDueDateStr }); } }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nouvelle facture
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle facture</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="general" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Général</TabsTrigger>
              <TabsTrigger value="financier" className="gap-1.5 text-xs"><Euro className="h-3.5 w-3.5" /> Financier</TabsTrigger>
              <TabsTrigger value="liens" className="gap-1.5 text-xs"><Link2 className="h-3.5 w-3.5" /> Liaisons</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Société *</Label>
                  <Select value={watch("company_id") || ""} onValueChange={handleCompanyChange}>
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
                  <Select value={watch("client_id") || ""} onValueChange={handleClientChange}>
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

              {/* Client info */}
              {selectedClient && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                  <p className="font-medium text-sm">{selectedClient.name}</p>
                  {selectedClient.address && <p className="text-muted-foreground">{selectedClient.address}{selectedClient.postal_code ? `, ${selectedClient.postal_code}` : ""}{selectedClient.city ? ` ${selectedClient.city}` : ""}</p>}
                  <div className="flex gap-4 flex-wrap">
                    {selectedClient.email && <p className="text-muted-foreground">✉ {selectedClient.email}</p>}
                    {selectedClient.phone && <p className="text-muted-foreground">☎ {selectedClient.phone}</p>}
                    {selectedClient.payment_terms && <p className="text-muted-foreground">💳 {selectedClient.payment_terms}</p>}
                    {selectedClient.payment_method && <p className="text-muted-foreground">Mode : {selectedClient.payment_method}</p>}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="fac-code">Code / Référence</Label>
                <Input id="fac-code" {...register("code")} placeholder="FAC-2026-XXX" />
              </div>

              <div>
                <Label htmlFor="fac-notes">Notes</Label>
                <Textarea id="fac-notes" {...register("notes")} rows={3} placeholder="Notes internes, conditions particulières..." />
              </div>
            </TabsContent>

            <TabsContent value="financier" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fac-amount">Montant TTC (€) *</Label>
                  <Input id="fac-amount" type="number" step="0.01" {...register("amount")} />
                  {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <Label htmlFor="fac-due">Date d'échéance</Label>
                  <Input id="fac-due" type="date" {...register("due_date")} />
                </div>
              </div>
              {selectedClient?.payment_terms && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <p className="text-muted-foreground">Conditions de paiement client : <span className="font-medium text-foreground">{selectedClient.payment_terms}</span></p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="liens" className="space-y-4 mt-4">
              {!selectedClientId ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sélectionnez d'abord un client dans l'onglet Général.</p>
              ) : (
                <>
                  {devisList.length > 0 && (
                    <div>
                      <Label>Devis associé</Label>
                      <Select value={watch("devis_id") || "none"} onValueChange={handleDevisChange}>
                        <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          {devisList.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.code || d.objet} — {fmt(Number(d.amount))}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground mt-1">Seuls les devis acceptés sont affichés. Le montant sera pré-rempli.</p>
                    </div>
                  )}
                  {dossiers.length > 0 && (
                    <div>
                      <Label>Dossier associé</Label>
                      <Select value={watch("dossier_id") || "none"} onValueChange={(v) => setValue("dossier_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          {dossiers.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.code ? `${d.code} — ` : ""}{d.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {devisList.length === 0 && dossiers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Aucun devis accepté ni dossier pour ce client.</p>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>

          <Separator />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Création..." : "Créer la facture"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
