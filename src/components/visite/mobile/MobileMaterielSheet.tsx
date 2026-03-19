import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, Package, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const DESIGNATIONS_COURANTES = [
  "Armoire haute", "Armoire basse", "Bureau", "Canapé", "Carton standard",
  "Chaise", "Coffre-fort", "Commode", "Étagère", "Fauteuil",
  "Lit 2 places", "Machine à laver", "Matelas", "Meuble TV",
  "Piano droit", "Réfrigérateur", "Table", "Table basse",
];

interface Props {
  open: boolean;
  onClose: () => void;
  visiteId: string;
  companyId: string;
}

export const MobileMaterielSheet = ({ open, onClose, visiteId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [quantity, setQuantity] = useState(1);

  const { data: catalog = [] } = useQuery({
    queryKey: ["materiel-catalog", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("materiel_catalog").select("*").eq("company_id", companyId).order("designation");
      return data || [];
    },
  });

  const { data: materiel = [] } = useQuery({
    queryKey: ["visite-materiel", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_materiel").select("*").eq("visite_id", visiteId).order("sort_order");
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (designation: string) => {
      const catalogItem = catalog.find((c: any) => c.designation === designation);
      await supabase.from("visite_materiel").insert({
        visite_id: visiteId,
        company_id: companyId,
        designation,
        quantity,
        weight: catalogItem?.default_weight || null,
        dimensions: catalogItem?.default_dimensions || null,
        sort_order: materiel.length,
      });
    },
    onSuccess: () => {
      toast.success("Matériel ajouté ✓");
      setSearch("");
      setQuantity(1);
      queryClient.invalidateQueries({ queryKey: ["visite-materiel", visiteId] });
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("visite_materiel").delete().eq("id", id);
    },
    onSuccess: () => {
      toast.success("Supprimé");
      queryClient.invalidateQueries({ queryKey: ["visite-materiel", visiteId] });
    },
  });

  const allDesignations = [
    ...catalog.map((c: any) => c.designation),
    ...DESIGNATIONS_COURANTES.filter((d) => !catalog.some((c: any) => c.designation === d)),
  ];

  const filtered = search.trim()
    ? allDesignations.filter((d) => d.toLowerCase().includes(search.toLowerCase()))
    : allDesignations;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col pb-safe">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">📦 Ajouter du matériel</SheetTitle>
        </SheetHeader>

        {/* Search */}
        <div className="flex gap-2 items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher ou saisir..."
            className="h-12 text-base rounded-xl flex-1"
            autoFocus
          />
          <div className="flex items-center gap-1 bg-muted rounded-xl px-2">
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="text-lg font-bold px-2 py-2 text-muted-foreground">−</button>
            <span className="text-base font-bold min-w-[24px] text-center">{quantity}</span>
            <button onClick={() => setQuantity(quantity + 1)} className="text-lg font-bold px-2 py-2 text-muted-foreground">+</button>
          </div>
        </div>

        {/* Custom entry */}
        {search.trim() && !allDesignations.some((d) => d.toLowerCase() === search.toLowerCase()) && (
          <Button
            onClick={() => addMutation.mutate(search.trim())}
            disabled={addMutation.isPending}
            className="w-full h-12 rounded-xl mt-2 gap-2"
          >
            <Plus className="h-5 w-5" /> Ajouter "{search.trim()}" × {quantity}
          </Button>
        )}

        {/* Suggestions */}
        <div className="flex-1 overflow-y-auto mt-3 space-y-1">
          {filtered.slice(0, 20).map((d) => (
            <button
              key={d}
              onClick={() => addMutation.mutate(d)}
              disabled={addMutation.isPending}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border/50 active:scale-[0.98] transition-transform"
            >
              <span className="text-sm font-medium">{d}</span>
              <Plus className="h-4 w-4 text-primary" />
            </button>
          ))}
        </div>

        {/* Current items */}
        {materiel.length > 0 && (
          <div className="border-t pt-3 mt-2 max-h-[200px] overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-2">{materiel.length} élément(s) ajouté(s)</p>
            <div className="space-y-1">
              {materiel.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 text-sm">
                  <span>{item.designation} × {item.quantity}</span>
                  <button onClick={() => deleteMutation.mutate(item.id)} className="p-1 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
