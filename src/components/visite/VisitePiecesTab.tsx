import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Image, Loader2, MapPin, GripVertical, ChevronUp, ChevronDown, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useSortableList } from "@/hooks/useSortableList";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { saveOfflinePhoto, getOfflinePhotosByVisite, removeOfflinePhoto, updateOfflinePhotoCaption, type OfflinePhoto } from "@/lib/offlinePhotoDB";

interface Props {
  visiteId: string;
  companyId: string;
}

export const VisitePiecesTab = ({ visiteId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [newPiece, setNewPiece] = useState({ name: "", floor_level: "", dimensions: "", access_comments: "" });
  const [uploading, setUploading] = useState<string | null>(null);
  const [offlinePhotos, setOfflinePhotos] = useState<OfflinePhoto[]>([]);

  // Load offline photos for this visite
  useEffect(() => {
    const load = async () => {
      const photos = await getOfflinePhotosByVisite(visiteId);
      setOfflinePhotos(photos);
    };
    load();
    const handler = () => { load(); };
    window.addEventListener("offline-photos-change", handler);
    return () => window.removeEventListener("offline-photos-change", handler);
  }, [visiteId]);

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

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      const promises = updates.map(({ id, sort_order }) =>
        supabase.from("visite_pieces").update({ sort_order }).eq("id", id)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visite-pieces", visiteId] });
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
    useSortableList(pieces, handleReorder);

  const addPiece = useMutation({
    mutationFn: async () => {
      if (!newPiece.name.trim()) throw new Error("Nom requis");
      const insertData = {
        visite_id: visiteId,
        company_id: companyId,
        ...newPiece,
        sort_order: pieces.length,
      };
      if (!isOnline) {
        addToQueue({ table: "visite_pieces", operation: "insert", data: { ...insertData, id: crypto.randomUUID() } });
        return;
      }
      const { error } = await supabase.from("visite_pieces").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isOnline ? "Pièce ajoutée" : "Pièce sauvegardée hors-ligne");
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
    if (!isOnline) {
      // Store offline in IndexedDB
      try {
        const blob = file.slice(0, file.size, file.type);
        await saveOfflinePhoto({
          id: crypto.randomUUID(),
          visiteId,
          pieceId,
          companyId,
          fileName: file.name,
          mimeType: file.type,
          blob,
          timestamp: Date.now(),
        });
        toast.info("Photo sauvegardée hors-ligne — sera uploadée au retour de la connexion");
      } catch (e: any) {
        toast.error(e.message || "Erreur sauvegarde locale");
      }
      return;
    }

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

  const deleteOfflinePhotoHandler = async (id: string) => {
    await removeOfflinePhoto(id);
    toast.success("Photo hors-ligne supprimée");
  };

  const updateOfflineCaption = async (id: string, caption: string) => {
    await updateOfflinePhotoCaption(id, caption);
    const photos = await getOfflinePhotosByVisite(visiteId);
    setOfflinePhotos(photos);
  };

  const updateCaption = async (photoId: string, caption: string) => {
    const { error } = await supabase.from("visite_photos").update({ caption }).eq("id", photoId);
    if (error) {
      toast.error("Erreur mise à jour légende");
    }
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
          {pieces.map((piece: any, idx: number) => (
            <Card
              key={piece.id}
              className={`p-4 space-y-3 transition-all ${
                dragIndex === idx ? "opacity-50 scale-95" : ""
              } ${overIndex === idx && dragIndex !== idx ? "ring-2 ring-primary" : ""}`}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col items-center gap-0.5 pt-1">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                    <div className="flex flex-col md:hidden">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={idx === 0}
                        onClick={() => moveItem(idx, "up")}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={idx === pieces.length - 1}
                        onClick={() => moveItem(idx, "down")}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {piece.name}
                    </h4>
                    {piece.floor_level && <p className="text-xs text-muted-foreground">Étage: {piece.floor_level}</p>}
                    {piece.dimensions && <p className="text-xs text-muted-foreground">Dimensions: {piece.dimensions}</p>}
                    {piece.access_comments && <p className="text-xs text-muted-foreground">Accès: {piece.access_comments}</p>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deletePiece.mutate(piece.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              {/* Photos with captions */}
              <div className="space-y-2">
                {piecePhotos(piece.id).map((photo: any) => (
                  <div key={photo.id} className="space-y-1">
                    <div className="relative group w-full max-w-[200px] aspect-square rounded-lg overflow-hidden border">
                      <img src={getPhotoUrl(photo.storage_path)} alt={photo.file_name || ""} className="w-full h-full object-cover" />
                      <button
                        onClick={() => deletePhoto(photo.id, photo.storage_path)}
                        className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <Input
                      defaultValue={photo.caption || ""}
                      onBlur={(e) => updateCaption(photo.id, e.target.value)}
                      placeholder="Légende / description..."
                      className="text-xs h-7"
                    />
                  </div>
                ))}
                {/* Offline photos for this piece */}
                {offlinePhotos.filter(p => p.pieceId === piece.id).map((op) => (
                  <div key={op.id} className="space-y-1">
                    <div className="relative group w-full max-w-[200px] aspect-square rounded-lg overflow-hidden border border-amber-500/50">
                      <img src={URL.createObjectURL(op.blob)} alt={op.fileName} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-amber-500/80 text-white text-[10px] px-1 py-0.5 flex items-center gap-1">
                        <WifiOff className="h-2.5 w-2.5" />
                        Hors-ligne
                      </div>
                      <button
                        onClick={() => deleteOfflinePhotoHandler(op.id)}
                        className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <Input
                      defaultValue={op.caption || ""}
                      onBlur={async (e) => {
                        const val = e.target.value;
                        if (val !== (op.caption || "")) {
                          await updateOfflineCaption(op.id, val);
                        }
                      }}
                      placeholder="Légende (hors-ligne)..."
                      className="text-xs h-7"
                    />
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
