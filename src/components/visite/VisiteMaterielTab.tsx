import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, Package, Sparkles, GripVertical, ChevronUp, ChevronDown, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSortableList } from "@/hooks/useSortableList";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";

const DESIGNATIONS_COURANTES = [
  "Armoire haute",
  "Armoire basse",
  "Bahut",
  "Bibliothèque",
  "Bureau",
  "Caisson",
  "Canapé",
  "Carton standard",
  "Carton livres",
  "Chaise",
  "Coffre-fort",
  "Commode",
  "Console",
  "Étagère",
  "Fauteuil",
  "Lit 1 place",
  "Lit 2 places",
  "Machine à laver",
  "Matelas",
  "Meuble TV",
  "Piano droit",
  "Piano à queue",
  "Réfrigérateur",
  "Sèche-linge",
  "Sommier",
  "Table",
  "Table basse",
];

interface Props {
  visiteId: string;
  companyId: string;
}

export const VisiteMaterielTab = ({ visiteId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [newItem, setNewItem] = useState({ designation: "", quantity: 1, dimensions: "", weight: "", unit: "", notes: "" });
  const [customDesignation, setCustomDesignation] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Catalogue matériel pour auto-complétion
  const { data: catalog = [] } = useQuery({
    queryKey: ["materiel-catalog", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiel_catalog")
        .select("*")
        .eq("company_id", companyId)
        .order("designation");
      if (error) throw error;
      return data;
    },
  });

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

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      const promises = updates.map(({ id, sort_order }) =>
        supabase.from("visite_materiel").update({ sort_order }).eq("id", id)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visite-materiel", visiteId] });
    },
    onError: () => toast.error("Erreur de réordonnement"),
  });

  const handleReorder = useCallback(
    (updates: { id: string; sort_order: number }[]) => {
      reorderMutation.mutate(updates);
    },
    [reorderMutation]
  );

  const { dragIndex, overIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd, moveItem } =
    useSortableList(materiel, handleReorder);

  const addItem = useMutation({
    mutationFn: async () => {
      if (!newItem.designation.trim()) throw new Error("Désignation requise");
      const insertData = {
        visite_id: visiteId,
        company_id: companyId,
        designation: newItem.designation,
        quantity: newItem.quantity,
        dimensions: newItem.dimensions || null,
        weight: newItem.weight ? Number(newItem.weight) : null,
        unit: newItem.unit || null,
        notes: newItem.notes || null,
        sort_order: materiel.length,
      };
      if (!isOnline) {
        addToQueue({ table: "visite_materiel", operation: "insert", data: { ...insertData, id: crypto.randomUUID() } });
        return;
      }
      const { error } = await supabase.from("visite_materiel").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isOnline ? "Matériel ajouté" : "Matériel sauvegardé hors-ligne");
      setNewItem({ designation: "", quantity: 1, dimensions: "", weight: "", unit: "", notes: "" });
      setCustomDesignation(false);
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

  const handleDesignationSelect = (value: string) => {
    if (value === "__custom__") {
      setCustomDesignation(true);
      setNewItem((p) => ({ ...p, designation: "" }));
    } else {
      setCustomDesignation(false);
      // Auto-complétion depuis le catalogue
      const catalogItem = catalog.find((c: any) => c.designation === value);
      if (catalogItem) {
        setNewItem((p) => ({
          ...p,
          designation: value,
          weight: catalogItem.default_weight ? String(catalogItem.default_weight) : p.weight,
          dimensions: catalogItem.default_dimensions || p.dimensions,
          unit: p.unit,
        }));
      } else {
        setNewItem((p) => ({ ...p, designation: value }));
      }
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

      {/* Add new item with dropdown */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Ajouter du matériel</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="col-span-2">
            <Label>Désignation *</Label>
            {customDesignation ? (
              <div className="flex gap-1">
                <Input value={newItem.designation} onChange={(e) => setNewItem((p) => ({ ...p, designation: e.target.value }))} placeholder="Saisie libre..." />
                <Button variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => setCustomDesignation(false)}>Liste</Button>
              </div>
            ) : (
              <select
                value={newItem.designation}
                onChange={(e) => handleDesignationSelect(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">— Choisir —</option>
                {catalog.length > 0 && (
                  <optgroup label="📦 Catalogue entreprise">
                    {catalog.map((c: any) => (
                      <option key={c.id} value={c.designation}>
                        {c.designation}{c.default_weight ? ` (${c.default_weight}kg)` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="📋 Désignations courantes">
                  {DESIGNATIONS_COURANTES.filter(d => !catalog.some((c: any) => c.designation === d)).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </optgroup>
                <option value="__custom__">✏️ Autre (saisie libre)</option>
              </select>
            )}
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
                <th className="w-10"></th>
                <th className="text-left p-2 font-medium">Désignation</th>
                <th className="text-center p-2 font-medium w-16">Qté</th>
                <th className="text-left p-2 font-medium hidden md:table-cell">Dimensions</th>
                <th className="text-right p-2 font-medium hidden md:table-cell w-20">Poids</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {materiel.map((item: any, idx: number) => (
                <tr
                  key={item.id}
                  className={`${idx % 2 === 0 ? "" : "bg-muted/20"} transition-all ${
                    dragIndex === idx ? "opacity-50" : ""
                  } ${overIndex === idx && dragIndex !== idx ? "ring-2 ring-inset ring-primary" : ""}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                >
                  <td className="p-2">
                    <div className="flex flex-col items-center">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                      <div className="flex flex-col md:hidden">
                        <button
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          disabled={idx === 0}
                          onClick={() => moveItem(idx, "up")}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          disabled={idx === materiel.length - 1}
                          onClick={() => moveItem(idx, "down")}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </td>
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
