import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Camera, Tag, Pencil, Loader2, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { PhotoAnnotationEditor } from "../PhotoAnnotationEditor";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [selectedPieceId, setSelectedPieceId] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [annotatingPhoto, setAnnotatingPhoto] = useState<{ id: string; path: string; url: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; path: string } | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [pieceSelect, setPieceSelect] = useState<string | null>(null);
  const [materielSelect, setMaterielSelect] = useState<string | null>(null);

  const { data: pieces = [] } = useQuery({
    queryKey: ["visite-pieces", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_pieces").select("*").eq("visite_id", visiteId).order("sort_order");
      return data || [];
    },
  });

  const { data: materielList = [] } = useQuery({
    queryKey: ["visite-materiel", visiteId],
    queryFn: async () => {
      const { data } = await supabase.from("visite_materiel").select("*").eq("visite_id", visiteId).order("sort_order");
      return data || [];
    },
    enabled: open,
  });

  const { data: affectations = [] } = useQuery({
    queryKey: ["visite-materiel-affectations", visiteId],
    queryFn: async () => {
      const pieceIds = pieces.map((p: any) => p.id);
      if (!pieceIds.length) return [];
      const { data } = await supabase
        .from("visite_materiel_affectations")
        .select("*")
        .in("piece_id", pieceIds);
      return data || [];
    },
    enabled: open && pieces.length > 0,
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

  // Init captions from DB data
  useEffect(() => {
    if (!existingPhotos.length) return;
    const init: Record<string, string> = {};
    existingPhotos.forEach((p: any) => {
      if (captions[p.id] === undefined) init[p.id] = p.caption || "";
    });
    if (Object.keys(init).length) setCaptions((prev) => ({ ...prev, ...init }));
  }, [existingPhotos]);

  // Generate signed URLs for all photos
  useEffect(() => {
    if (!existingPhotos.length) return;
    const paths = existingPhotos.map((p: any) => p.storage_path).filter((p: string) => !signedUrls[p]);
    if (!paths.length) return;

    const loadUrls = async () => {
      const newUrls: Record<string, string> = {};
      await Promise.all(
        paths.map(async (path: string) => {
          const { data } = await supabase.storage.from("visite-photos").createSignedUrl(path, 3600);
          if (data?.signedUrl) newUrls[path] = data.signedUrl;
        })
      );
      setSignedUrls((prev) => ({ ...prev, ...newUrls }));
    };
    loadUrls();
  }, [existingPhotos]);

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
      invalidatePhotos();
    } catch (err: any) {
      toast.error(err.message || "Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  const invalidatePhotos = () => {
    queryClient.invalidateQueries({ queryKey: ["visite-photos", visiteId] });
    queryClient.invalidateQueries({ queryKey: ["visite-photos-full", visiteId] });
  };

  const handleAnnotateSave = async (blob: Blob) => {
    if (!annotatingPhoto) return;
    try {
      // 1. Convertir le blob en ArrayBuffer pour l'upload
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 2. Uploader en remplaçant le fichier existant (même path, upsert: true)
      const { error: uploadError } = await supabase.storage
        .from("visite-photos")
        .upload(annotatingPhoto.path, uint8Array, {
          contentType: "image/png",
          upsert: true,
          cacheControl: "0",
        });

      if (uploadError) throw uploadError;

      // 3. Forcer le rechargement de l'URL signée en invalidant le cache
      setSignedUrls((prev) => {
        const next = { ...prev };
        delete next[annotatingPhoto.path];
        return next;
      });
      invalidatePhotos();

      // 4. Fermer l'éditeur et confirmer
      setAnnotatingPhoto(null);
      toast.success("Photo annotée sauvegardée");
    } catch (err: any) {
      console.error("Erreur sauvegarde annotation:", err);
      toast.error("Erreur lors de la sauvegarde : " + (err.message || "réessayez"));
    }
  };

  // Caption save on blur
  const handleCaptionBlur = async (photoId: string) => {
    const val = captions[photoId] ?? "";
    try {
      await supabase.from("visite_photos").update({ caption: val || null }).eq("id", photoId);
    } catch {
      // silent
    }
  };

  // Delete photo
  const handleDeletePhoto = async () => {
    if (!deleteConfirm) return;
    try {
      await supabase.storage.from("visite-photos").remove([deleteConfirm.path]);
      await supabase.from("visite_photos").delete().eq("id", deleteConfirm.id);
      toast.success("Photo supprimée");
      invalidatePhotos();
    } catch (err: any) {
      toast.error(err.message || "Erreur suppression");
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Assign piece to photo
  const handleAssignPiece = async (photoId: string, newPieceId: string) => {
    try {
      await supabase.from("visite_photos").update({ piece_id: newPieceId }).eq("id", photoId);
      invalidatePhotos();
      setPieceSelect(null);
    } catch {
      toast.error("Erreur");
    }
  };

  // Assign materiel to the photo's piece
  const handleAssignMateriel = async (photoId: string, materielId: string) => {
    const photo = existingPhotos.find((p: any) => p.id === photoId);
    if (!photo?.piece_id) {
      toast.error("Assignez d'abord une pièce à cette photo");
      setMaterielSelect(null);
      return;
    }
    try {
      // Check if affectation already exists
      const exists = affectations.some(
        (a: any) => a.materiel_id === materielId && a.piece_id === photo.piece_id
      );
      if (!exists) {
        await supabase.from("visite_materiel_affectations").insert({
          materiel_id: materielId,
          piece_id: photo.piece_id,
          company_id: companyId,
          quantity: 1,
        });
        queryClient.invalidateQueries({ queryKey: ["visite-materiel-affectations", visiteId] });
      }
      toast.success("Matériel lié à la pièce ✓");
      setMaterielSelect(null);
    } catch {
      toast.error("Erreur liaison matériel");
    }
  };

  const getPieceName = (pieceId: string | null) => {
    if (!pieceId) return null;
    const p = pieces.find((pc: any) => pc.id === pieceId);
    return p ? p.name : null;
  };

  // Get materiel linked to a photo's piece
  const getMaterielForPiece = (pieceId: string | null) => {
    if (!pieceId) return [];
    const materielIds = affectations
      .filter((a: any) => a.piece_id === pieceId)
      .map((a: any) => a.materiel_id);
    return materielList.filter((m: any) => materielIds.includes(m.id));
  };

  return (
    <>
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
            <div className="grid grid-cols-2 gap-3 mt-3 mb-4">
              {existingPhotos.map((photo: any) => {
                const url = signedUrls[photo.storage_path];
                const pieceName = getPieceName(photo.piece_id);
                const linkedMateriel = getMaterielForPiece(photo.piece_id);
                return (
                  <div key={photo.id} className="flex flex-col gap-1.5">
                    {/* Image with annotate overlay */}
                    <div className="relative rounded-xl overflow-hidden border border-border/50" style={{ height: 160 }}>
                      {url ? (
                        <img src={url} alt={photo.caption || ""} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <Skeleton className="w-full h-full" />
                      )}
                      {url && (
                        <button
                          onClick={() => {
                            if (onAnnotate) {
                              onAnnotate(url, photo.id, photo.storage_path, photo.piece_id);
                            } else {
                              setAnnotatingPhoto({ id: photo.id, path: photo.storage_path, url });
                            }
                          }}
                          className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-90 transition-transform"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {/* Caption input */}
                    <Input
                      value={captions[photo.id] ?? photo.caption ?? ""}
                      onChange={(e) => setCaptions((prev) => ({ ...prev, [photo.id]: e.target.value }))}
                      onBlur={() => handleCaptionBlur(photo.id)}
                      placeholder="Légende..."
                      className="h-8 text-xs rounded-lg"
                    />
                    {/* Piece badge + materiel badge + delete */}
                    <div className="flex items-center flex-wrap gap-1">
                      {pieceSelect === photo.id ? (
                        <div className="flex flex-wrap gap-1 flex-1">
                          {pieces.map((p: any) => (
                            <button
                              key={p.id}
                              onClick={() => handleAssignPiece(photo.id, p.id)}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary"
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => setPieceSelect(photo.id)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            pieceName ? "bg-blue-500/15 text-blue-600" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {pieceName || "+ Pièce"}
                        </button>
                      )}

                      {/* Materiel badge */}
                      {materielSelect === photo.id ? (
                        <div className="flex flex-wrap gap-1 flex-1">
                          {materielList.map((m: any) => (
                            <button
                              key={m.id}
                              onClick={() => handleAssignMateriel(photo.id, m.id)}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-700"
                            >
                              {m.designation}
                            </button>
                          ))}
                          {materielList.length === 0 && (
                            <span className="text-[10px] text-muted-foreground px-1">Aucun matériel</span>
                          )}
                        </div>
                      ) : (
                        <>
                          {linkedMateriel.length > 0 ? (
                            linkedMateriel.slice(0, 2).map((m: any) => (
                              <span key={m.id} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-700">
                                {m.designation}
                              </span>
                            ))
                          ) : null}
                          <button
                            onClick={() => setMaterielSelect(photo.id)}
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground flex items-center gap-0.5"
                          >
                            <Package className="h-2.5 w-2.5" />
                            + Matériel
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setDeleteConfirm({ id: photo.id, path: photo.storage_path })}
                        className="p-1 text-destructive ml-auto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Piece selector for new photos */}
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

          {/* Caption for new photo */}
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

      {/* Inline annotation editor */}
      {annotatingPhoto && (
        <PhotoAnnotationEditor
          open={true}
          onClose={() => setAnnotatingPhoto(null)}
          imageSrc={annotatingPhoto.url}
          onSave={handleAnnotateSave}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette photo ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePhoto} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
