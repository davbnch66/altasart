import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2, Trash2, Plus, FileText, Check, AlertTriangle } from "lucide-react";

interface DevisLine {
  description: string;
  quantity: number;
  unit_price: number;
}

interface GeneratedDevis {
  objet: string;
  lines: DevisLine[];
  notes: string;
  company_id: string;
  client_id: string;
  client_name: string;
}

interface Props {
  visiteId: string;
  companyId: string;
  dossierId?: string | null;
  trigger?: React.ReactNode;
}

export const GenerateDevisDialog = ({ visiteId, companyId, dossierId, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [generated, setGenerated] = useState<GeneratedDevis | null>(null);
  const [editLines, setEditLines] = useState<DevisLine[]>([]);
  const [objet, setObjet] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-devis-from-visite", {
        body: { visite_id: visiteId },
      });
      if (error) throw new Error(error.message || "Erreur de génération");
      if (data?.error) throw new Error(data.error);
      return data as GeneratedDevis;
    },
    onSuccess: (data) => {
      setGenerated(data);
      setEditLines(data.lines);
      setObjet(data.objet);
      setNotes(data.notes || "");
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de la génération"),
  });

  const createDevis = useMutation({
    mutationFn: async () => {
      if (!generated) throw new Error("Aucun devis généré");
      const totalAmount = editLines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

      const { data: devis, error: devisErr } = await supabase.from("devis").insert({
        company_id: generated.company_id,
        client_id: generated.client_id,
        objet,
        amount: totalAmount,
        notes,
        dossier_id: dossierId || null,
        visite_id: visiteId,
        status: "brouillon",
      }).select("id").single();
      if (devisErr) throw devisErr;

      const lines = editLines.map((l, i) => ({
        devis_id: devis.id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        sort_order: i,
      }));
      const { error: linesErr } = await supabase.from("devis_lines").insert(lines);
      if (linesErr) throw linesErr;

      return devis.id;
    },
    onSuccess: (devisId) => {
      toast.success("Devis créé avec succès");
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      queryClient.invalidateQueries({ queryKey: ["visite-devis-history", visiteId] });
      setOpen(false);
      navigate(`/devis/${devisId}`);
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de la création du devis"),
  });

  const updateLine = (idx: number, field: keyof DevisLine, value: any) => {
    setEditLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const removeLine = (idx: number) => {
    setEditLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLine = () => {
    setEditLines((prev) => [...prev, { description: "", quantity: 1, unit_price: 0 }]);
  };

  const total = editLines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setGenerated(null); setEditLines([]); } }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Sparkles className="h-4 w-4" /> Générer un devis IA
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Génération intelligente de devis
          </DialogTitle>
        </DialogHeader>

        {!generated ? (
          <div className="space-y-4 py-4">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <p className="text-sm">L'IA va analyser les données de la visite technique :</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Matériel inventorié (poids, dimensions, quantités)</li>
                <li>Ressources humaines prévues</li>
                <li>Véhicules et engins nécessaires</li>
                <li>Contraintes d'accès</li>
                <li>Méthodologie et notes</li>
              </ul>
            </div>
            <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Le devis généré devra être validé et ajusté avant envoi au client.</span>
            </div>
            <Button onClick={() => generate.mutate()} disabled={generate.isPending} className="w-full gap-2">
              {generate.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Générer le devis</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Objet du devis</Label>
              <Input value={objet} onChange={(e) => setObjet(e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lignes du devis ({editLines.length})</Label>
                <Button variant="outline" size="sm" onClick={addLine} className="gap-1">
                  <Plus className="h-3 w-3" /> Ajouter
                </Button>
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {editLines.map((line, idx) => (
                  <Card key={idx} className="p-3 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(idx, "description", e.target.value)}
                        placeholder="Description"
                        className="flex-1 text-sm"
                      />
                      <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => removeLine(idx)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="w-20">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, "quantity", Number(e.target.value))}
                          className="text-sm"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">×</span>
                      <div className="w-28">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.unit_price}
                          onChange={(e) => updateLine(idx, "unit_price", Number(e.target.value))}
                          className="text-sm"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">€</span>
                      <span className="text-sm font-medium ml-auto">
                        {(line.quantity * line.unit_price).toFixed(2)} €
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 font-semibold">
              <span>Total HT</span>
              <span>{total.toFixed(2)} €</span>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Vérifiez et ajustez les lignes avant de créer le devis.</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setGenerated(null); setEditLines([]); }}>
                Régénérer
              </Button>
              <Button onClick={() => createDevis.mutate()} disabled={createDevis.isPending || editLines.length === 0} className="gap-2">
                {createDevis.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Création...</>
                ) : (
                  <><Check className="h-4 w-4" /> Créer le devis</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
