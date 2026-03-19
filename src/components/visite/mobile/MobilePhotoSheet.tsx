import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Image, X, Loader2, PenTool, Trash2, Tag } from "lucide-react";
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
    } catch (err: any) {
      toast.error(err.message || "Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  const triggerInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto pb-safe">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">
            {mode === "camera" ? "📸 Prendre une photo" : "🖼 Choisir depuis la galerie"}
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

        {/* Piece selector */}
        <div className="space-y-3 mt-2">
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
        <div className="space-y-3 mt-4">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Catégorie
          </p>
          <div className="flex flex-wrap gap-2">
            {PHOTO_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? "" : cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
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
        <div className="mt-4">
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Légende / dimensions (optionnel)"
            className="h-12 text-base rounded-xl"
          />
        </div>

        {/* Action button */}
        <Button
          onClick={triggerInput}
          disabled={uploading}
          className="w-full h-14 text-base rounded-2xl mt-4 gap-2"
          size="lg"
        >
          {uploading ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Upload en cours...</>
          ) : mode === "camera" ? (
            <><Camera className="h-5 w-5" /> Prendre la photo</>
          ) : (
            <><Image className="h-5 w-5" /> Choisir une image</>
          )}
        </Button>
      </SheetContent>
    </Sheet>
  );
};
