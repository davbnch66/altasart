import { useState, useEffect, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Plus, FileText, Euro, StickyNote, Link2, Sparkles, Loader2,
  MapPin, CalendarDays, Truck, HardHat, Weight, Box, ClipboardCheck, Eye,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { generateFacturePdf } from "@/lib/generateFacturePdf";
import { GenericPdfPreviewDialog } from "@/components/shared/GenericPdfPreviewDialog";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy", { locale: fr }); } catch { return d; }
};

const schema = z.object({
  code: z.string().trim().max(20).optional(),
  amount: z.coerce.number().min(0, "Le montant doit être positif"),
  tva_rate: z.coerce.number().min(0).max(100),
  notes: z.string().trim().max(5000).optional(),
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
  linkOperationId?: string;
  trigger?: React.ReactNode;
}

/* ────────── Operation Context Card ────────── */
const OperationContextCard = ({ operationId }: { operationId: string }) => {
  const { data: op } = useQuery({
    queryKey: ["operation-context", operationId],
    queryFn: async () => {
      const { data } = await supabase.from("operations").select("*").eq("id", operationId).single();
      return data;
    },
    enabled: !!operationId,
  });

  const { data: resources = [] } = useQuery({
    queryKey: ["operation-resources-ctx", operationId],
    queryFn: async () => {
      const { data } = await supabase.from("operation_resources").select("resources(name, type)").eq("operation_id", operationId);
      return data || [];
    },
    enabled: !!operationId,
  });

  if (!op) return null;

  const vehicles = resources.filter((r: any) => r.resources?.type === "vehicule" || r.resources?.type === "vehicle");
  const personnel = resources.filter((r: any) => r.resources?.type === "personnel" || r.resources?.type === "person");

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold">Opération source — BT #{op.operation_number}</span>
        <Badge variant="secondary" className="text-[10px]">{op.type}</Badge>
        {op.completed && <Badge className="text-[10px] bg-success/10 text-success border-success/20">Terminée</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-3 text-[11px]">
        {/* Chargement */}
        <div className="space-y-1">
          <p className="font-medium text-primary flex items-center gap-1"><Truck className="h-3 w-3" /> Chargement</p>
          {op.loading_date && <p className="text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {fmtDate(op.loading_date)}{op.loading_time_start ? ` ${op.loading_time_start}` : ""}</p>}
          <p className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {[op.loading_address, op.loading_postal_code, op.loading_city].filter(Boolean).join(", ") || "—"}</p>
          {op.loading_floor && <p className="text-muted-foreground">Étage: {op.loading_floor}</p>}
        </div>
        {/* Livraison */}
        <div className="space-y-1">
          <p className="font-medium text-primary flex items-center gap-1"><Truck className="h-3 w-3 scale-x-[-1]" /> Livraison</p>
          {op.delivery_date && <p className="text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {fmtDate(op.delivery_date)}{op.delivery_time_start ? ` ${op.delivery_time_start}` : ""}</p>}
          <p className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {[op.delivery_address, op.delivery_postal_code, op.delivery_city].filter(Boolean).join(", ") || "—"}</p>
          {op.delivery_floor && <p className="text-muted-foreground">Étage: {op.delivery_floor}</p>}
        </div>
      </div>

      {/* Resources */}
      {(vehicles.length > 0 || personnel.length > 0) && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-primary/10">
          {vehicles.map((r: any, i: number) => (
            <Badge key={i} variant="outline" className="text-[10px] gap-1"><Truck className="h-2.5 w-2.5" /> {r.resources?.name}</Badge>
          ))}
          {personnel.map((r: any, i: number) => (
            <Badge key={i} variant="outline" className="text-[10px] gap-1"><HardHat className="h-2.5 w-2.5" /> {r.resources?.name}</Badge>
          ))}
        </div>
      )}

      {/* Technical details */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {(op.volume != null && op.volume > 0) && <span className="flex items-center gap-1"><Box className="h-3 w-3" /> {op.volume} m³</span>}
        {(op.weight != null && op.weight > 0) && <span className="flex items-center gap-1"><Weight className="h-3 w-3" /> {op.weight} kg</span>}
        {op.lv_bt_number && <span>LV/BT: {op.lv_bt_number}</span>}
      </div>

      {op.instructions && (
        <p className="text-[11px] text-muted-foreground border-t border-primary/10 pt-1">
          <span className="font-medium">Consignes:</span> {op.instructions}
        </p>
      )}
    </div>
  );
};

/* ────────── Main Dialog ────────── */
export const CreateFactureDialog = ({ preselectedClientId, preselectedCompanyId, preselectedDossierId, linkOperationId, trigger }: CreateFactureDialogProps) => {
  const [open, setOpen] = useState(false);
  const { current, dbCompanies } = useCompany();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [aiLoading, setAiLoading] = useState(false);

  const defaultCompanyId = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || "");
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId);
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || "");

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
      const { data } = await supabase.from("dossiers").select("id, title, code, amount, volume, weight").eq("client_id", selectedClientId).order("title");
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
    defaultValues: { company_id: defaultCompanyId, amount: 0, tva_rate: 20, due_date: defaultDueDateStr },
  });

  const watchAmount = Number(watch("amount")) || 0;
  const watchTva = Number(watch("tva_rate")) || 20;
  const montantHT = watchAmount;
  const montantTVA = montantHT * (watchTva / 100);
  const montantTTC = montantHT + montantTVA;

  const selectedClient = clients.find((c) => c.id === watch("client_id"));
  const selectedDossier = dossiers.find((d) => d.id === watch("dossier_id"));

  // Pre-fill amount from devis when linked from operation
  useEffect(() => {
    if (open && preselectedDossierId && devisList.length > 0) {
      const acceptedDevis = devisList[0];
      if (acceptedDevis && watch("amount") === 0) {
        setValue("amount", Number(acceptedDevis.amount));
        setValue("devis_id", acceptedDevis.id);
      }
    }
  }, [open, devisList, preselectedDossierId]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: facture, error } = await supabase.from("factures").insert({
        code: data.code || null,
        amount: data.amount,
        tva_rate: data.tva_rate,
        notes: data.notes || null,
        due_date: data.due_date || null,
        client_id: data.client_id,
        company_id: data.company_id,
        dossier_id: data.dossier_id && data.dossier_id !== "none" ? data.dossier_id : null,
        devis_id: data.devis_id && data.devis_id !== "none" ? data.devis_id : null,
      }).select("id").single();
      if (error) throw error;
      if (linkOperationId && facture) {
        await supabase.from("operations").update({ facture_id: facture.id } as any).eq("id", linkOperationId);
      }
    },
    onSuccess: () => {
      toast.success("Facture créée avec succès");
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: ["finance-factures"] });
      queryClient.invalidateQueries({ queryKey: ["client-factures"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-factures"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-reglements-count"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-operations"] });
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

  const generateAiNotes = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-facture-notes", {
        body: {
          dossier_id: watch("dossier_id") && watch("dossier_id") !== "none" ? watch("dossier_id") : preselectedDossierId || null,
          operation_id: linkOperationId || null,
          client_id: watch("client_id") || preselectedClientId || null,
          amount: watch("amount") || 0,
        },
      });
      if (error) throw new Error(error.message || "Erreur");
      if (data?.error) throw new Error(data.error);
      if (data?.content) {
        setValue("notes", data.content);
        toast.success("Contenu généré par l'IA");
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération");
    } finally {
      setAiLoading(false);
    }
  };

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v) {
      const cid = preselectedCompanyId || (current !== "global" ? current : dbCompanies[0]?.id || "");
      setSelectedCompanyId(cid);
      setSelectedClientId(preselectedClientId || "");
      reset({
        company_id: cid,
        client_id: preselectedClientId || ("" as any),
        amount: 0,
        tva_rate: 20,
        dossier_id: preselectedDossierId || "",
        due_date: defaultDueDateStr,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nouvelle facture
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Nouvelle facture
            {linkOperationId && <Badge variant="outline" className="text-[10px]">Depuis opération</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* Operation context card */}
        {linkOperationId && <OperationContextCard operationId={linkOperationId} />}

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className={`w-full grid ${isMobile ? "grid-cols-3" : "grid-cols-4"}`}>
              <TabsTrigger value="general" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Général</TabsTrigger>
              <TabsTrigger value="financier" className="gap-1.5 text-xs"><Euro className="h-3.5 w-3.5" /> Financier</TabsTrigger>
              <TabsTrigger value="contenu" className="gap-1.5 text-xs"><StickyNote className="h-3.5 w-3.5" /> Contenu</TabsTrigger>
              {!isMobile && <TabsTrigger value="liens" className="gap-1.5 text-xs"><Link2 className="h-3.5 w-3.5" /> Liaisons</TabsTrigger>}
            </TabsList>

            {/* ── Général ── */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
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

              <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                <div>
                  <Label htmlFor="fac-code">Code / Référence</Label>
                  <Input id="fac-code" {...register("code")} placeholder="FAC-2026-XXX" />
                </div>
                <div>
                  <Label htmlFor="fac-due">Date d'échéance</Label>
                  <Input id="fac-due" type="date" {...register("due_date")} />
                </div>
              </div>

              {/* Dossier & Devis selection (inline for linked context) */}
              {selectedClientId && (
                <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
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
                  {devisList.length > 0 && (
                    <div>
                      <Label>Devis accepté</Label>
                      <Select value={watch("devis_id") || "none"} onValueChange={handleDevisChange}>
                        <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          {devisList.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.code || d.objet} — {fmt(Number(d.amount))}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground mt-1">Le montant sera pré-rempli depuis le devis sélectionné.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Dossier context */}
              {selectedDossier && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                  <p className="font-medium">Dossier : {selectedDossier.code || selectedDossier.title}</p>
                  <div className="flex gap-4 text-muted-foreground">
                    {selectedDossier.amount != null && <span>Montant dossier: {fmt(Number(selectedDossier.amount))}</span>}
                    {selectedDossier.volume != null && Number(selectedDossier.volume) > 0 && <span>{selectedDossier.volume} m³</span>}
                    {selectedDossier.weight != null && Number(selectedDossier.weight) > 0 && <span>{selectedDossier.weight} kg</span>}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Financier ── */}
            <TabsContent value="financier" className="space-y-4 mt-4">
              <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
                <div>
                  <Label htmlFor="fac-amount">Montant HT (€) *</Label>
                  <Input id="fac-amount" type="number" step="0.01" {...register("amount")} />
                  {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <Label htmlFor="fac-tva">Taux TVA (%)</Label>
                  <Input id="fac-tva" type="number" step="0.1" {...register("tva_rate")} />
                </div>
                <div>
                  <Label htmlFor="fac-due2">Échéance</Label>
                  <Input id="fac-due2" type="date" {...register("due_date")} />
                </div>
              </div>

              {/* Financial summary */}
              <div className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total HT</span>
                  <span className="font-medium">{fmt(montantHT)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA ({watchTva}%)</span>
                  <span>{fmt(montantTVA)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Total TTC</span>
                  <span className="text-primary">{fmt(montantTTC)}</span>
                </div>
              </div>

              {selectedClient?.payment_terms && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <p className="text-muted-foreground">Conditions de paiement client : <span className="font-medium text-foreground">{selectedClient.payment_terms}</span></p>
                </div>
              )}
            </TabsContent>

            {/* ── Contenu (Notes + AI) ── */}
            <TabsContent value="contenu" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="fac-notes" className="text-sm font-medium">Description / Notes de facturation</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateAiNotes}
                  disabled={aiLoading}
                  className="gap-1.5 text-xs"
                >
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {aiLoading ? "Génération..." : "Rédiger par IA"}
                </Button>
              </div>
              <Textarea
                id="fac-notes"
                {...register("notes")}
                rows={10}
                placeholder="Description des prestations réalisées, moyens mis en œuvre, conditions d'intervention...&#10;&#10;Cliquez sur 'Rédiger par IA' pour générer automatiquement le contenu à partir des données de l'opération et du dossier."
                className="resize-none text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                L'IA utilise les données de l'opération, du dossier, du devis et des ressources mobilisées pour rédiger le descriptif. Vous pouvez ensuite le modifier librement.
              </p>
            </TabsContent>

            {/* ── Liaisons (desktop only as separate tab, merged in general on mobile) ── */}
            {!isMobile && (
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
                        <p className="text-[10px] text-muted-foreground mt-1">Seuls les devis acceptés sont affichés.</p>
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
                    {linkOperationId && (
                      <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                        <p className="text-muted-foreground">Cette facture sera automatiquement liée à l'opération source.</p>
                      </div>
                    )}
                    {devisList.length === 0 && dossiers.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">Aucun devis accepté ni dossier pour ce client.</p>
                    )}
                  </>
                )}
              </TabsContent>
            )}
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
