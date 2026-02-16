import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Image, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Props {
  visiteId: string;
  companyId: string;
}

export const VisitePiecesTab = ({ visiteId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const [newPiece, setNewPiece] = useState({ name: "", floor_level: "", dimensions: "", access_comments: "" });
  const [uploading, setUploading] = useState<string | null>(null);

  const { data: pieces = [], isLoading } = useQuery({
    queryKey: ["visite-pieces", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visite_pieces")
        .select("*")
        .eq("visite_id", visiteId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["visite-photos", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visite_photos")
        .select("*")
        .eq("visite_id", visiteId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const addPiece = useMutation({
    mutationFn: async () => {
      if (!newPiece.name.trim()) throw new Error("Nom requis");
      const { error } = await supabase.from("visite_pieces").insert({
        visite_id: visiteId,
        company_id: companyId,
        ...newPiece,
        sort_order: pieces.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pièce ajoutée");
      setNewPiece({ name: "", floor_level: "", dimensions: "", access_comments: "" });
      queryClient.invalidateQueries({ queryKey: ["visite-pieces", visiteId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePiece = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("visite_pieces").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pièce supprimée");
      queryClient.invalidateQueries({ queryKey: ["visite-pieces", visiteId] });
      queryClient.invalidateQueries({ queryKey: ["visite-photos", visiteId] });
    },
  });

  const uploadPhoto = async (pieceId: string, file: File) => {
    setUploading(pieceId);
    try {
      const path = `${visiteId}/${pieceId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("visite-photos").upload(path, file);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from("visite_photos").insert({
        visite_id: visiteId,
        piece_id: pieceId,
        company_id: companyId,
        storage_path: path,
        file_name: file.name,
      });
      if (dbError) throw dbError;
      toast.success("Photo ajoutée");
      queryClient.invalidateQueries({ queryKey: ["visite-photos", visiteId] });
    } catch (e: any) {
      toast.error(e.message || "Erreur upload");
    } finally {
      setUploading(null);
    }
  };

  const deletePhoto = async (photoId: string, storagePath: string) => {
    await supabase.storage.from("visite-photos").remove([storagePath]);
    await supabase.from("visite_photos").delete().eq("id", photoId);
    queryClient.invalidateQueries({ queryKey: ["visite-photos", visiteId] });
    toast.success("Photo supprimée");
  };

  const getPhotoUrl = (path: string) => {
    const { data } = supabase.storage.from("visite-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const piecePhotos = (pieceId: string) => photos.filter((p) => p.piece_id === pieceId);

  return (
    <div className="space-y-4">
      {/* Add new piece */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Ajouter une pièce / zone</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Nom *</Label>
            <Input value={newPiece.name} onChange={(e) => setNewPiece((p) => ({ ...p, name: e.target.value }))} placeholder="Local technique, Terrasse..." />
          </div>
          <div>
            <Label>Niveau / Étage</Label>
            <Input value={newPiece.floor_level} onChange={(e) => setNewPiece((p) => ({ ...p, floor_level: e.target.value }))} placeholder="RDC, 1er..." />
          </div>
          <div>
            <Label>Dimensions</Label>
            <Input value={newPiece.dimensions} onChange={(e) => setNewPiece((p) => ({ ...p, dimensions: e.target.value }))} placeholder="5x3m" />
          </div>
          <div>
            <Label>Accès</Label>
            <Input value={newPiece.access_comments} onChange={(e) => setNewPiece((p) => ({ ...p, access_comments: e.target.value }))} placeholder="Contraintes..." />
          </div>
        </div>
        <Button size="sm" onClick={() => addPiece.mutate()} disabled={addPiece.isPending || !newPiece.name.trim()}>
          {addPiece.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          Ajouter
        </Button>
      </Card>

      {/* List of pieces */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Chargement...</p>
      ) : pieces.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">Aucune pièce ajoutée. Commencez par créer des pièces ou zones.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pieces.map((piece: any) => (
            <Card key={piece.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {piece.name}
                  </h4>
                  {piece.floor_level && <p className="text-xs text-muted-foreground">Étage: {piece.floor_level}</p>}
                  {piece.dimensions && <p className="text-xs text-muted-foreground">Dimensions: {piece.dimensions}</p>}
                  {piece.access_comments && <p className="text-xs text-muted-foreground">Accès: {piece.access_comments}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => deletePiece.mutate(piece.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              {/* Photos */}
              <div className="flex flex-wrap gap-2">
                {piecePhotos(piece.id).map((photo: any) => (
                  <div key={photo.id} className="relative group w-20 h-20 rounded-lg overflow-hidden border">
                    <img src={getPhotoUrl(photo.storage_path)} alt={photo.file_name || ""} className="w-full h-full object-cover" />
                    <button
                      onClick={() => deletePhoto(photo.id, photo.storage_path)}
                      className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="cursor-pointer inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <Image className="h-3 w-3" />
                  {uploading === piece.id ? "Upload..." : "Ajouter photo"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadPhoto(piece.id, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
