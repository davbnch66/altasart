import { useState, useRef } from "react";
import { Camera, X, Image as ImageIcon, Loader2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BTPhotoUploadProps {
  btId: string;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
}

export function BTPhotoUpload({ btId, photos, onPhotosChange }: BTPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const loadSignedUrl = async (path: string) => {
    if (photoUrls[path]) return;
    const { data } = await supabase.storage.from("operation-photos").createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      setPhotoUrls(prev => ({ ...prev, [path]: data.signedUrl }));
    }
  };

  // Load URLs for existing photos
  useState(() => {
    photos.forEach(p => loadSignedUrl(p));
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    const newPaths: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${btId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        
        const { error } = await supabase.storage.from("operation-photos").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) throw error;
        newPaths.push(path);

        const { data: urlData } = await supabase.storage.from("operation-photos").createSignedUrl(path, 3600);
        if (urlData?.signedUrl) {
          setPhotoUrls(prev => ({ ...prev, [path]: urlData.signedUrl }));
        }
      }

      const updated = [...photos, ...newPaths];
      const { error: updateErr } = await supabase
        .from("operations")
        .update({ photos: updated })
        .eq("id", btId);
      if (updateErr) throw updateErr;

      onPhotosChange(updated);
      toast.success(`${newPaths.length} photo(s) ajoutée(s)`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const removePhoto = async (path: string) => {
    try {
      await supabase.storage.from("operation-photos").remove([path]);
      const updated = photos.filter(p => p !== path);
      await supabase.from("operations").update({ photos: updated }).eq("id", btId);
      onPhotosChange(updated);
      setPhotoUrls(prev => {
        const copy = { ...prev };
        delete copy[path];
        return copy;
      });
      toast.success("Photo supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => cameraRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Camera className="h-3.5 w-3.5 mr-1" />}
          Prendre photo
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => galleryRef.current?.click()}
          disabled={uploading}
        >
          <ImagePlus className="h-3.5 w-3.5 mr-1" />
          Galerie
        </Button>
        {photos.length > 0 && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <ImageIcon className="h-3 w-3" /> {photos.length}
          </span>
        )}
      </div>

      {/* Camera input - uses capture to open camera directly */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleUpload}
      />

      {/* Gallery input - no capture attribute so it opens file picker / gallery */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((path) => (
            <div key={path} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
              {photoUrls[path] ? (
                <img src={photoUrls[path]} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              <button
                onClick={() => removePhoto(path)}
                className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
