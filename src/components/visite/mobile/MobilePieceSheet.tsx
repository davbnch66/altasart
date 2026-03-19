import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, MapPin, Trash2, Image } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

const PIECE_SUGGESTIONS = [
  "Salon", "Chambre", "Cuisine", "Bureau", "Terrasse", "Cave",
  "Garage", "Grenier", "Local technique", "Couloir", "Hall d'entrée",
  "Salle de bain", "Balcon", "Sous-sol", "Toiture", "Extérieur",
];

interface Props {
  open: boolean;
  onClose: () => void;
  visiteId: string;
  companyId: string;
}

export const MobilePieceSheet = ({ open, onClose, visiteId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");

  const { data: pieces = [] } = useQuery({
    queryKey: ["visite-pieces", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_pieces").select("*").eq("visite_id", visiteId).order("sort_order");
      return data || [];
    },
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["visite-photos", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_photos").select("id, piece_id").eq("visite_id", visiteId);
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      await supabase.from("visite_pieces").insert({
        visite_id: visiteId,
        company_id: companyId,
        name,
        sort_order: pieces.length,
      });
    },
    onSuccess: () => {
      toast.success("Pièce ajoutée ✓");
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["visite-pieces", visiteId] });
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("visite_pieces").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visite-pieces", visiteId] });
      queryClient.invalidateQueries({ queryKey: ["visite-photos", visiteId] });
      toast.success("Pièce supprimée");
    },
  });

  const photoCount = (pieceId: string) => photos.filter((p) => p.piece_id === pieceId).length;

  const existingNames = pieces.map((p: any) => p.name.toLowerCase());
  const suggestions = PIECE_SUGGESTIONS.filter((s) => !existingNames.includes(s.toLowerCase()));

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col pb-safe">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">🏗 Pièces & Zones</SheetTitle>
        </SheetHeader>

        {/* Quick add */}
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom de la pièce..."
            className="h-12 text-base rounded-xl flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                addMutation.mutate(newName.trim());
              }
            }}
          />
          <Button
            onClick={() => newName.trim() && addMutation.mutate(newName.trim())}
            disabled={!newName.trim() || addMutation.isPending}
            size="lg"
            className="h-12 rounded-xl px-4"
          >
            {addMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>
        </div>

        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {suggestions.slice(0, 12).map((s) => (
            <button
              key={s}
              onClick={() => addMutation.mutate(s)}
              className="px-3 py-1.5 rounded-full text-xs bg-muted text-muted-foreground active:bg-primary active:text-primary-foreground transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>

        {/* Current pieces */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-2">
          {pieces.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              Aucune pièce. Créez-en une ci-dessus ou utilisez les suggestions.
            </p>
          ) : (
            pieces.map((piece: any) => (
              <div
                key={piece.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border/50"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 rounded-lg p-2">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{piece.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {piece.floor_level && <span>Étage: {piece.floor_level}</span>}
                      <span className="flex items-center gap-0.5">
                        <Image className="h-3 w-3" /> {photoCount(piece.id)}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => deleteMutation.mutate(piece.id)} className="p-2 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
