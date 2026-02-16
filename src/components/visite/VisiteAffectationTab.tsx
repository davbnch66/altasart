import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertTriangle, MapPin, Package } from "lucide-react";
import { toast } from "sonner";

interface Props {
  visiteId: string;
  companyId: string;
}

export const VisiteAffectationTab = ({ visiteId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const [selectedPiece, setSelectedPiece] = useState<string>("");
  const [selectedMateriel, setSelectedMateriel] = useState<string>("");
  const [qty, setQty] = useState(1);

  const { data: pieces = [] } = useQuery({
    queryKey: ["visite-pieces", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("visite_pieces").select("*").eq("visite_id", visiteId).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: materiel = [] } = useQuery({
    queryKey: ["visite-materiel", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("visite_materiel").select("*").eq("visite_id", visiteId).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: affectations = [] } = useQuery({
    queryKey: ["visite-affectations", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visite_materiel_affectations")
        .select("*, visite_materiel(designation), visite_pieces(name)")
        .eq("company_id", companyId);
      if (error) throw error;
      // Filter to only this visite's affectations
      return (data || []).filter((a: any) =>
        materiel.some((m: any) => m.id === a.materiel_id)
      );
    },
    enabled: materiel.length > 0,
  });

  const addAffectation = useMutation({
    mutationFn: async () => {
      if (!selectedPiece || !selectedMateriel) throw new Error("Sélectionnez pièce et matériel");
      const { error } = await supabase.from("visite_materiel_affectations").insert({
        materiel_id: selectedMateriel,
        piece_id: selectedPiece,
        company_id: companyId,
        quantity: qty,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Affectation ajoutée");
      setSelectedMateriel("");
      setQty(1);
      queryClient.invalidateQueries({ queryKey: ["visite-affectations", visiteId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteAffectation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("visite_materiel_affectations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Affectation supprimée");
      queryClient.invalidateQueries({ queryKey: ["visite-affectations", visiteId] });
    },
  });

  // Compute unassigned material
  const assignedQty = (materielId: string) =>
    affectations.filter((a: any) => a.materiel_id === materielId).reduce((sum: number, a: any) => sum + a.quantity, 0);

  const unassigned = materiel.filter((m: any) => assignedQty(m.id) < m.quantity);

  // Group affectations by piece
  const affectationsByPiece = pieces.map((piece: any) => ({
    ...piece,
    items: affectations.filter((a: any) => a.piece_id === piece.id),
  }));

  if (pieces.length === 0 || materiel.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Vous devez d'abord créer des <strong>pièces/zones</strong> et du <strong>matériel</strong> pour utiliser l'affectation.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Unassigned alert */}
      {unassigned.length > 0 && (
        <Card className="p-3 border-warning bg-warning/5">
          <div className="flex items-center gap-2 text-warning font-medium text-sm">
            <AlertTriangle className="h-4 w-4" />
            {unassigned.length} matériel(s) non entièrement affecté(s)
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {unassigned.map((m: any) => (
              <Badge key={m.id} variant="outline" className="text-xs">
                {m.designation} ({assignedQty(m.id)}/{m.quantity})
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Quick assign */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Affecter du matériel</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <select
              value={selectedPiece}
              onChange={(e) => setSelectedPiece(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">-- Pièce --</option>
              {pieces.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={selectedMateriel}
              onChange={(e) => setSelectedMateriel(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">-- Matériel --</option>
              {materiel.map((m: any) => (
                <option key={m.id} value={m.id}>{m.designation} (qté: {m.quantity})</option>
              ))}
            </select>
          </div>
          <div>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} placeholder="Qté" />
          </div>
          <Button size="sm" onClick={() => addAffectation.mutate()} disabled={!selectedPiece || !selectedMateriel}>
            <Plus className="h-4 w-4 mr-1" /> Affecter
          </Button>
        </div>
      </Card>

      {/* Affectations by piece */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {affectationsByPiece.map((piece: any) => (
          <Card key={piece.id} className="p-4 space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> {piece.name}
            </h4>
            {piece.items.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun matériel affecté</p>
            ) : (
              <ul className="space-y-1">
                {piece.items.map((aff: any) => (
                  <li key={aff.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {aff.visite_materiel?.designation || "—"} × {aff.quantity}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteAffectation.mutate(aff.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
