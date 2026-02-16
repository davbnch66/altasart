import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, Package, Upload, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Props {
  visiteId: string;
  companyId: string;
}

export const VisiteMaterielTab = ({ visiteId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const [newItem, setNewItem] = useState({ designation: "", quantity: 1, dimensions: "", weight: "", unit: "", notes: "" });
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data: materiel = [], isLoading } = useQuery({
    queryKey: ["visite-materiel", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visite_materiel")
        .select("*")
        .eq("visite_id", visiteId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!newItem.designation.trim()) throw new Error("Désignation requise");
      const { error } = await supabase.from("visite_materiel").insert({
        visite_id: visiteId,
        company_id: companyId,
        designation: newItem.designation,
        quantity: newItem.quantity,
        dimensions: newItem.dimensions || null,
        weight: newItem.weight ? Number(newItem.weight) : null,
        unit: newItem.unit || null,
        notes: newItem.notes || null,
        sort_order: materiel.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matériel ajouté");
      setNewItem({ designation: "", quantity: 1, dimensions: "", weight: "", unit: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["visite-materiel", visiteId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("visite_materiel").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matériel supprimé");
      queryClient.invalidateQueries({ queryKey: ["visite-materiel", visiteId] });
    },
  });

  const handleImportAI = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-materiel", {
        body: { text: importText, visite_id: visiteId, company_id: companyId },
      });
      if (error) throw error;
      toast.success(`${data.count || 0} éléments importés`);
      setImportText("");
      setImportOpen(false);
      queryClient.invalidateQueries({ queryKey: ["visite-materiel", visiteId] });
    } catch (e: any) {
      toast.error(e.message || "Erreur import IA");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center gap-2">
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Sparkles className="h-4 w-4 mr-1" /> Import IA
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Import matériel par IA</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Collez un email, une liste ou du texte. L'IA détectera automatiquement les désignations, quantités, dimensions et poids.</p>
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={10}
              placeholder="Collez ici le contenu de l'email, la liste de matériel, etc."
            />
            <Button onClick={handleImportAI} disabled={importing || !importText.trim()}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              {importing ? "Analyse en cours..." : "Analyser et importer"}
            </Button>
          </DialogContent>
        </Dialog>
        <span className="text-sm text-muted-foreground">{materiel.length} élément(s)</span>
      </div>

      {/* Add new item */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Ajouter du matériel</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="col-span-2">
            <Label>Désignation *</Label>
            <Input value={newItem.designation} onChange={(e) => setNewItem((p) => ({ ...p, designation: e.target.value }))} placeholder="Armoire, Carton..." />
          </div>
          <div>
            <Label>Qté</Label>
            <Input type="number" min={1} value={newItem.quantity} onChange={(e) => setNewItem((p) => ({ ...p, quantity: Number(e.target.value) }))} />
          </div>
          <div>
            <Label>Dimensions</Label>
            <Input value={newItem.dimensions} onChange={(e) => setNewItem((p) => ({ ...p, dimensions: e.target.value }))} placeholder="LxlxH" />
          </div>
          <div>
            <Label>Poids (kg)</Label>
            <Input value={newItem.weight} onChange={(e) => setNewItem((p) => ({ ...p, weight: e.target.value }))} placeholder="0" />
          </div>
          <div>
            <Label>Unité</Label>
            <Input value={newItem.unit} onChange={(e) => setNewItem((p) => ({ ...p, unit: e.target.value }))} placeholder="pce, lot..." />
          </div>
        </div>
        <Button size="sm" onClick={() => addItem.mutate()} disabled={addItem.isPending || !newItem.designation.trim()}>
          {addItem.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          Ajouter
        </Button>
      </Card>

      {/* Material list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : materiel.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">Aucun matériel. Ajoutez manuellement ou utilisez l'import IA.</p>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Désignation</th>
                <th className="text-center p-2 font-medium w-16">Qté</th>
                <th className="text-left p-2 font-medium hidden md:table-cell">Dimensions</th>
                <th className="text-right p-2 font-medium hidden md:table-cell w-20">Poids</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {materiel.map((item: any, idx: number) => (
                <tr key={item.id} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                  <td className="p-2 font-medium">{item.designation}</td>
                  <td className="p-2 text-center">{item.quantity}</td>
                  <td className="p-2 hidden md:table-cell text-muted-foreground">{item.dimensions || "—"}</td>
                  <td className="p-2 text-right hidden md:table-cell text-muted-foreground">{item.weight ? `${item.weight} kg` : "—"}</td>
                  <td className="p-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItem.mutate(item.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
