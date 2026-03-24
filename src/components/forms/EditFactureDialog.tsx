import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { generateFacturePdf } from "@/lib/generateFacturePdf";
import { GenericPdfPreviewDialog } from "@/components/shared/GenericPdfPreviewDialog";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FileText, Euro, StickyNote, Download, CalendarDays, Eye, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

const schema = z.object({
  code: z.string().trim().max(20).optional(),
  amount: z.coerce.number().min(0, "Le montant doit être positif"),
  tva_rate: z.coerce.number().min(0).max(100),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
  payment_terms: z.string().optional(),
  paid_amount: z.coerce.number().min(0),
  notes: z.string().trim().max(5000).optional(),
  due_date: z.string().optional(),
  status: z.string(),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { value: "brouillon", label: "Brouillon" },
  { value: "envoyee", label: "Envoyée" },
  { value: "payee", label: "Payée" },
  { value: "en_retard", label: "En retard" },
  { value: "annulee", label: "Annulée" },
];

interface EditFactureDialogProps {
  facture: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy", { locale: fr }); } catch { return d; }
};

const fmtEur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export const EditFactureDialog = ({ facture, open, onOpenChange }: EditFactureDialogProps) => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ blobUrl: string; fileName: string; dataUri: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const result = await generateFacturePdf(facture.id, true);
      if (result) {
        setPreviewData(result);
        setPreviewOpen(true);
      }
    } catch {
      toast.error("Erreur lors de la génération de l'aperçu");
    } finally {
      setPreviewLoading(false);
    }
  };

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open && facture) {
      reset({
        code: facture.code || "",
        amount: facture.amount || 0,
        tva_rate: facture.tva_rate ?? 20,
        discount_percent: (facture as any).discount_percent || 0,
        payment_terms: (facture as any).payment_terms || "",
        paid_amount: facture.paid_amount || 0,
        notes: facture.notes || "",
        due_date: facture.due_date || "",
        status: facture.status,
      });
    }
  }, [open, facture, reset]);

  const watchAmount = Number(watch("amount")) || 0;
  const watchTva = Number(watch("tva_rate")) || 20;
  const watchDiscount = Number(watch("discount_percent")) || 0;
  const watchPaid = Number(watch("paid_amount")) || 0;
  const montantHT = watchAmount;
  const montantHTAfterDiscount = montantHT * (1 - watchDiscount / 100);
  const montantTVA = montantHTAfterDiscount * (watchTva / 100);
  const montantTTC = montantHTAfterDiscount + montantTVA;
  const resteDu = Math.max(0, montantTTC - watchPaid);

  const generateAiNotes = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-facture-notes", {
        body: {
          dossier_id: facture.dossier_id || null,
          operation_id: null,
          client_id: facture.client_id || null,
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

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const updatePayload: any = {
        code: data.code || null,
        amount: data.amount,
        tva_rate: data.tva_rate,
        paid_amount: data.paid_amount,
        notes: data.notes || null,
        due_date: data.due_date || null,
        status: data.status as any,
      };
      // Auto-set sent_at
      if (data.status === "envoyee" && !facture.sent_at) {
        updatePayload.sent_at = new Date().toISOString();
      }
      const { error } = await supabase.from("factures").update(updatePayload).eq("id", facture.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Facture modifiée avec succès");
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: ["finance-stats"] });
      queryClient.invalidateQueries({ queryKey: ["finance-factures"] });
      queryClient.invalidateQueries({ queryKey: ["facture-detail"] });
      queryClient.invalidateQueries({ queryKey: ["client-factures"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-factures"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Erreur lors de la modification"),
  });

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Modifier la facture
            {facture?.code && <Badge variant="outline" className="text-xs font-mono">{facture.code}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* Read-only context */}
        {facture && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                {facture.clients?.name && <p className="font-medium text-sm">{facture.clients?.name}</p>}
                {facture.clients?.address && (
                  <p className="text-muted-foreground">
                    {facture.clients.address}
                    {facture.clients.postal_code ? `, ${facture.clients.postal_code}` : ""}
                    {facture.clients.city ? ` ${facture.clients.city}` : ""}
                  </p>
                )}
                {facture.clients?.email && <p className="text-muted-foreground">✉ {facture.clients.email}</p>}
                {facture.dossiers?.title && <p className="text-muted-foreground">Dossier : {facture.dossiers?.code || facture.dossiers?.title}</p>}
                {facture.devis?.objet && <p className="text-muted-foreground">Devis : {facture.devis?.code || facture.devis?.objet}</p>}
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Créé le {fmtDate(facture.created_at)}</p>
                {facture.sent_at && <p className="text-muted-foreground">Envoyée le {fmtDate(facture.sent_at)}</p>}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className={`w-full grid ${isMobile ? "grid-cols-3" : "grid-cols-3"}`}>
              <TabsTrigger value="general" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Général</TabsTrigger>
              <TabsTrigger value="financier" className="gap-1.5 text-xs"><Euro className="h-3.5 w-3.5" /> Financier</TabsTrigger>
              <TabsTrigger value="contenu" className="gap-1.5 text-xs"><StickyNote className="h-3.5 w-3.5" /> Contenu</TabsTrigger>
            </TabsList>

            {/* ── Général ── */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                <div>
                  <Label htmlFor="edit-fac-code">Code / Référence</Label>
                  <Input id="edit-fac-code" {...register("code")} placeholder="FAC-XXX" />
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
              </div>
              <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                <div>
                  <Label htmlFor="edit-fac-due">Date d'échéance</Label>
                  <Input id="edit-fac-due" type="date" {...register("due_date")} />
                </div>
              </div>
            </TabsContent>

            {/* ── Financier ── */}
            <TabsContent value="financier" className="space-y-4 mt-4">
              <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
                <div>
                  <Label htmlFor="edit-fac-amount">Montant HT (€) *</Label>
                  <Input id="edit-fac-amount" type="number" step="0.01" {...register("amount")} />
                  {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <Label htmlFor="edit-fac-tva">Taux TVA (%)</Label>
                  <Input id="edit-fac-tva" type="number" step="0.1" {...register("tva_rate")} />
                </div>
                <div>
                  <Label htmlFor="edit-fac-paid">Montant réglé (€)</Label>
                  <Input id="edit-fac-paid" type="number" step="0.01" {...register("paid_amount")} />
                </div>
              </div>

              {/* Financial summary */}
              <div className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total HT</span>
                  <span className="font-medium">{fmtEur(montantHT)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA ({watchTva}%)</span>
                  <span>{fmtEur(montantTVA)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Total TTC</span>
                  <span className="text-primary">{fmtEur(montantTTC)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Réglé</span>
                  <span className="text-success font-medium">{fmtEur(watchPaid)}</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>Reste dû</span>
                  <span className={resteDu > 0 ? "text-destructive" : "text-success"}>{fmtEur(resteDu)}</span>
                </div>
              </div>
            </TabsContent>

            {/* ── Contenu (Notes + AI) ── */}
            <TabsContent value="contenu" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-fac-notes" className="text-sm font-medium">Description / Notes de facturation</Label>
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
                id="edit-fac-notes"
                {...register("notes")}
                rows={10}
                placeholder="Description des prestations réalisées, moyens mis en œuvre, conditions d'intervention...&#10;&#10;Cliquez sur 'Rédiger par IA' pour générer automatiquement le contenu."
                className="resize-none text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                L'IA utilise les données du dossier et du client pour rédiger le descriptif. Vous pouvez ensuite le modifier librement.
              </p>
            </TabsContent>
          </Tabs>

          <Separator />
          <div className={`flex ${isMobile ? "flex-col" : "justify-between"} gap-2 pt-1`}>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="gap-1.5" onClick={handlePreview} disabled={previewLoading}>
                {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                {isMobile ? "" : "Aperçu"}
              </Button>
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => generateFacturePdf(facture.id).catch(() => toast.error("Erreur PDF"))}>
                <Download className="h-4 w-4" /> {isMobile ? "" : "PDF"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <GenericPdfPreviewDialog
      open={previewOpen}
      onClose={() => setPreviewOpen(false)}
      blobUrl={previewData?.blobUrl || null}
      dataUri={previewData?.dataUri || null}
      fileName={previewData?.fileName || "facture.pdf"}
    />
    </>
  );
};
