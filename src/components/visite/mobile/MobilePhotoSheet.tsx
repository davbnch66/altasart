import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Image, Loader2, Tag, Pencil } from "lucide-react";
import { toast } from "sonner";

const PHOTO_CATEGORIES = [
  "Accès extérieur", "Passage", "Porte", "Escalier", "Toiture",
  "Matériel existant", "Zone de travail", "Obstacle", "Vue générale",
];

interface Props {
  open: boolean;
  onClose: () => void;
  visiteId: string;
  companyId: string;
  mode: "camera" | "gallery";
  onAnnotate?: (src: string, photoId: string, storagePath: string, pieceId: string) => void;
}

export const MobilePhotoSheet = ({ open, onClose, visiteId, companyId, mode, onAnnotate }: Props) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [caption, setCaption] = useState("");

  const { data: pieces = [] } = useQuery({
    queryKey: ["visite-pieces", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_pieces").select("*").eq("visite_id", visiteId).order("sort_order");
      return data || [];
    },
  });

  const { data: existingPhotos = [] } = useQuery({
    queryKey: ["visite-photos-full", visiteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("visite_photos")
        .select("id, storage_path, piece_id, file_name, caption")
        .eq("visite_id", visiteId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: open,
  });

  const [selectedPieceId, setSelectedPieceId] = useState("");

  const ensureDefaultPiece = async (): Promise<string> => {
    if (selectedPieceId) return selectedPieceId;
    if (pieces.length > 0) return pieces[0].id;
    const { data, error } = await supabase.from("visite_pieces").insert({
      visite_id: visiteId,
      company_id: companyId,
      name: "Général",
      sort_order: 0,
    }).select("id").single();
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["visite-pieces", visiteId] });
    return data.id;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    try {
      const pieceId = await ensureDefaultPiece();
      const path = `${visiteId}/${pieceId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("visite-photos").upload(path, file);
      if (uploadErr) throw uploadErr;
      
      const captionText = [selectedCategory, caption].filter(Boolean).join(" — ");
      
      await supabase.from("visite_photos").insert({
        visite_id: visiteId,
        piece_id: pieceId,
        company_id: companyId,
        storage_path: path,
        file_name: file.name,
        caption: captionText || null,
      });
      toast.success("Photo ajoutée ✓");
      setCaption("");
      setSelectedCategory("");
      queryClient.invalidateQueries({ queryKey: ["visite-photos", visiteId] });
      queryClient.invalidateQueries({ queryKey: ["visite-photos-full", visiteId] });
    } catch (err: any) {
      toast.error(err.message || "Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  const getPhotoUrl = (storagePath: string) => {
    const { data } = supabase.storage.from("visite-photos").getPublicUrl(storagePath);
    return data?.publicUrl || "";
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto pb-safe">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">
            📸 Photos ({existingPhotos.length})
          </SheetTitle>
        </SheetHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture={mode === "camera" ? "environment" : undefined}
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Existing photos grid */}
        {existingPhotos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-3 mb-4">
            {existingPhotos.map((photo: any) => {
              const url = getPhotoUrl(photo.storage_path);
              return (
                <div key={photo.id} className="relative rounded-xl overflow-hidden border border-border/50 aspect-square">
                  <img src={url} alt={photo.caption || ""} className="w-full h-full object-cover" loading="lazy" />
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                      <p className="text-[10px] text-white truncate">{photo.caption}</p>
                    </div>
                  )}
                  {onAnnotate && (
                    <button
                      onClick={() => onAnnotate(url, photo.id, photo.storage_path, photo.piece_id)}
                      className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Piece selector */}
        <div className="space-y-2 mt-2">
          <p className="text-sm font-medium text-muted-foreground">📍 Pièce / Zone</p>
          <div className="flex flex-wrap gap-2">
            {pieces.map((p: any) => (
              <button
                key={p.id}
                onClick={() => setSelectedPieceId(p.id)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedPieceId === p.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {p.name}
              </button>
            ))}
            {pieces.length === 0 && (
              <p className="text-xs text-muted-foreground">Zone "Général" sera créée automatiquement</p>
            )}
          </div>
        </div>

        {/* Category selector */}
        <div className="space-y-2 mt-3">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Catégorie
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PHOTO_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? "" : cat)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Caption */}
        <div className="mt-3">
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Légende / dimensions (optionnel)"
            className="h-11 text-base rounded-xl"
          />
        </div>

        {/* FAB Camera button */}
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-14 w-14 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
