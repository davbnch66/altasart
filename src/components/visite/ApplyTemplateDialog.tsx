import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardList, Users, Truck, Loader2, Sparkles, Check } from "lucide-react";
import { VISITE_TEMPLATES, type VisiteTemplate } from "@/lib/visiteTemplates";

interface Props {
  visiteId: string;
  companyId: string;
  trigger?: React.ReactNode;
}

export const ApplyTemplateDialog = ({ visiteId, companyId, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<VisiteTemplate | null>(null);
  const [sections, setSections] = useState({ methodologie: true, rh: true, vehicules: true });
  const queryClient = useQueryClient();

  const apply = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Aucun template sélectionné");

      const promises: PromiseLike<any>[] = [];

      if (sections.methodologie) {
        promises.push(
          supabase.from("visite_methodologie").insert({
            visite_id: visiteId,
            company_id: companyId,
            title: `Méthodologie – ${selected.label}`,
            content: selected.methodologie.content,
            checklist: JSON.parse(JSON.stringify(selected.methodologie.checklist)),
            sort_order: 0,
          }).then(({ error }) => { if (error) throw error; })
        );
      }

      if (sections.rh && selected.rh.length > 0) {
        const rhRows = selected.rh.map((r, i) => ({
          visite_id: visiteId,
          company_id: companyId,
          role: r.role,
          quantity: r.quantity,
          duration_estimate: r.duration_estimate,
          notes: r.notes,
          sort_order: i,
        }));
        promises.push(
          supabase.from("visite_ressources_humaines").insert(rhRows).then(({ error }) => { if (error) throw error; })
        );
      }

      if (sections.vehicules && selected.vehicules.length > 0) {
        const vRows = selected.vehicules.map((v, i) => ({
          visite_id: visiteId,
          company_id: companyId,
          type: v.type as any,
          label: v.label,
          capacity: v.capacity,
          notes: v.notes,
          sort_order: i,
        }));
        promises.push(
          supabase.from("visite_vehicules").insert(vRows).then(({ error }) => { if (error) throw error; })
        );
      }

      await Promise.all(promises);
    },
    onSuccess: () => {
      toast.success("Template appliqué avec succès");
      queryClient.invalidateQueries({ queryKey: ["visite-methodologie", visiteId] });
      queryClient.invalidateQueries({ queryKey: ["visite-rh", visiteId] });
      queryClient.invalidateQueries({ queryKey: ["visite-vehicules", visiteId] });
      setOpen(false);
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de l'application"),
  });

  const sectionCount = [sections.methodologie, sections.rh, sections.vehicules].filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelected(null); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Sparkles className="h-4 w-4" /> Appliquer un template
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Templates de visite
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Choisissez un template pour pré-remplir la méthodologie, les RH et les véhicules :</p>
            {VISITE_TEMPLATES.map((t) => (
              <Card
                key={t.id}
                className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelected(t)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold">{t.label}</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{t.operationType}</Badge>
                </div>
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3" /> {t.methodologie.checklist.length} étapes</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {t.rh.reduce((s, r) => s + r.quantity, 0)} pers.</span>
                  <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> {t.vehicules.length} véhicule(s)</span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>← Retour</Button>
              <h4 className="font-semibold">{selected.label}</h4>
              <Badge variant="secondary">{selected.operationType}</Badge>
            </div>

            <p className="text-sm text-muted-foreground">Sélectionnez les sections à pré-remplir :</p>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                <Checkbox
                  checked={sections.methodologie}
                  onCheckedChange={(v) => setSections((p) => ({ ...p, methodologie: !!v }))}
                  className="mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <ClipboardList className="h-4 w-4 text-primary" /> Méthodologie
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Notes techniques + {selected.methodologie.checklist.length} éléments de checklist
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                <Checkbox
                  checked={sections.rh}
                  onCheckedChange={(v) => setSections((p) => ({ ...p, rh: !!v }))}
                  className="mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <Users className="h-4 w-4 text-primary" /> Ressources humaines
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selected.rh.map((r) => `${r.quantity}× ${r.role}`).join(", ")}
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                <Checkbox
                  checked={sections.vehicules}
                  onCheckedChange={(v) => setSections((p) => ({ ...p, vehicules: !!v }))}
                  className="mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <Truck className="h-4 w-4 text-primary" /> Véhicules
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selected.vehicules.map((v) => v.label).join(", ")}
                  </p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={() => apply.mutate()} disabled={apply.isPending || sectionCount === 0}>
                {apply.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Appliquer ({sectionCount} section{sectionCount > 1 ? "s" : ""})
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
