import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateDevisPdf } from "@/lib/generateDevisPdf";
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
import { FileText, Euro, StickyNote, Download, CalendarDays } from "lucide-react";
import { GenerateDevisMemoButton } from "@/components/devis/GenerateDevisMemoButton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const schema = z.object({
  objet: z.string().trim().min(1, "L'objet est requis").max(500),
  code: z.string().trim().max(20).optional(),
  amount: z.coerce.number().min(0, "Le montant doit être positif"),
  notes: z.string().trim().max(2000).optional(),
  valid_until: z.string().optional(),
  status: z.string(),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { value: "brouillon", label: "Brouillon", color: "bg-muted text-muted-foreground" },
  { value: "envoye", label: "Envoyé", color: "bg-blue-100 text-blue-800" },
  { value: "accepte", label: "Accepté", color: "bg-green-100 text-green-800" },
  { value: "refuse", label: "Refusé", color: "bg-red-100 text-red-800" },
  { value: "expire", label: "Expiré", color: "bg-orange-100 text-orange-800" },
];

interface EditDevisDialogProps {
  devis: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy", { locale: fr }); } catch { return d; }
};

export const EditDevisDialog = ({ devis, open, onOpenChange }: EditDevisDialogProps) => {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open && devis) {
      reset({
        objet: devis.objet || "",
        code: devis.code || "",
        amount: devis.amount || 0,
        notes: devis.notes || "",
        valid_until: devis.valid_until || "",
        status: devis.status,
      });
    }
  }, [open, devis, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const updatePayload: any = {
        objet: data.objet,
        code: data.code || null,
        amount: data.amount,
        notes: data.notes || null,
        valid_until: data.valid_until || null,
        status: data.status as any,
      };
      // Set accepted_at when moving to accepte
      if (data.status === "accepte" && devis.status !== "accepte") {
        updatePayload.accepted_at = new Date().toISOString();
      }
      // Set sent_at when moving to envoye
      if (data.status === "envoye" && !devis.sent_at) {
        updatePayload.sent_at = new Date().toISOString();
      }
      const { error } = await supabase.from("devis").update(updatePayload).eq("id", devis.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devis modifié avec succès");
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      queryClient.invalidateQueries({ queryKey: ["client-devis"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-devis"] });
      queryClient.invalidateQueries({ queryKey: ["devis-detail"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Erreur lors de la modification"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Modifier le devis
            {devis?.code && <Badge variant="outline" className="text-xs font-mono">{devis.code}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* Read-only context */}
        {devis && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                {devis.clients?.name && <p className="font-medium text-sm">{devis.clients?.name}</p>}
                {devis.dossiers?.title && <p className="text-muted-foreground">Dossier : {devis.dossiers?.code || devis.dossiers?.title}</p>}
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Créé le {fmtDate(devis.created_at)}</p>
                {devis.sent_at && <p className="text-muted-foreground">Envoyé le {fmtDate(devis.sent_at)}</p>}
                {devis.accepted_at && <p className="text-green-600 font-medium">Accepté le {fmtDate(devis.accepted_at)}</p>}
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
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="edit-objet">Objet *</Label>
                  <Input id="edit-objet" {...register("objet")} />
                  {errors.objet && <p className="text-xs text-destructive mt-1">{errors.objet.message}</p>}
                </div>
                <div>
                  <Label htmlFor="edit-code">Code / Réf.</Label>
                  <Input id="edit-code" {...register("code")} placeholder="DEV-XXX" />
                </div>
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
            </TabsContent>

            <TabsContent value="financier" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-amount">Montant HT (€) *</Label>
                  <Input id="edit-amount" type="number" step="0.01" {...register("amount")} />
                  {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <Label htmlFor="edit-valid">Valide jusqu'au</Label>
                  <Input id="edit-valid" type="date" {...register("valid_until")} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="edit-notes">Notes internes</Label>
                  <GenerateDevisMemoButton
                    devisId={devis.id}
                    onGenerated={(memo) => setValue("notes", memo)}
                    size="sm"
                  />
                </div>
                <Textarea id="edit-notes" {...register("notes")} rows={4} />
              </div>
            </TabsContent>
          </Tabs>

          <Separator />
          <div className="flex justify-between gap-2 pt-1">
            <Button type="button" variant="outline" className="gap-1.5" onClick={() => generateDevisPdf(devis.id).catch(() => toast.error("Erreur PDF"))}>
              <Download className="h-4 w-4" /> Télécharger PDF
            </Button>
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
  );
};
