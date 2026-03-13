import { useEffect } from "react";
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
import { FileText, Euro, StickyNote, Download, CalendarDays, Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const schema = z.object({
  code: z.string().trim().max(20).optional(),
  amount: z.coerce.number().min(0, "Le montant doit être positif"),
  paid_amount: z.coerce.number().min(0),
  notes: z.string().trim().max(2000).optional(),
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ blobUrl: string; fileName: string; dataUri: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
        paid_amount: facture.paid_amount || 0,
        notes: facture.notes || "",
        due_date: facture.due_date || "",
        status: facture.status,
      });
    }
  }, [open, facture, reset]);

  const watchAmount = watch("amount") || 0;
  const watchPaid = watch("paid_amount") || 0;
  const resteDu = Math.max(0, watchAmount - watchPaid);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const updatePayload: any = {
        code: data.code || null,
        amount: data.amount,
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
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="general" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Général</TabsTrigger>
              <TabsTrigger value="financier" className="gap-1.5 text-xs"><Euro className="h-3.5 w-3.5" /> Financier</TabsTrigger>
              <TabsTrigger value="notes" className="gap-1.5 text-xs"><StickyNote className="h-3.5 w-3.5" /> Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
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
            </TabsContent>

            <TabsContent value="financier" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-fac-amount">Montant TTC (€) *</Label>
                  <Input id="edit-fac-amount" type="number" step="0.01" {...register("amount")} />
                  {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <Label htmlFor="edit-fac-paid">Montant réglé (€)</Label>
                  <Input id="edit-fac-paid" type="number" step="0.01" {...register("paid_amount")} />
                </div>
                <div>
                  <Label htmlFor="edit-fac-due">Date d'échéance</Label>
                  <Input id="edit-fac-due" type="date" {...register("due_date")} />
                </div>
                <div className="flex items-end">
                  <div className="rounded-lg border bg-muted/30 p-3 w-full text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Reste dû</p>
                    <p className={`text-lg font-bold ${resteDu > 0 ? "text-destructive" : "text-green-600"}`}>
                      {fmtEur(resteDu)}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="edit-fac-notes">Notes</Label>
                <Textarea id="edit-fac-notes" {...register("notes")} rows={4} />
              </div>
            </TabsContent>
          </Tabs>

          <Separator />
          <div className="flex justify-between gap-2 pt-1">
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="gap-1.5" onClick={handlePreview} disabled={previewLoading}>
                {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Aperçu
              </Button>
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => generateFacturePdf(facture.id).catch(() => toast.error("Erreur PDF"))}>
                <Download className="h-4 w-4" /> PDF
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

        <GenericPdfPreviewDialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          blobUrl={previewData?.blobUrl || null}
          dataUri={previewData?.dataUri || null}
          fileName={previewData?.fileName || "facture.pdf"}
        />
      </DialogContent>
    </Dialog>
  );
};
