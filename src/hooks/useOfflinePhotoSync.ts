import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAllOfflinePhotos, removeOfflinePhoto, getOfflinePhotoCount, type OfflinePhoto } from "@/lib/offlinePhotoDB";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { toast } from "sonner";

/**
 * Syncs offline photos to Supabase Storage + visite_photos table when back online.
 */
export function useOfflinePhotoSync() {
  const isOnline = useOnlineStatus();
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    const count = await getOfflinePhotoCount();
    setPendingPhotos(count);
  }, []);

  // Listen for changes
  useEffect(() => {
    const handler = () => { refreshCount(); };
    window.addEventListener("offline-photos-change", handler);
    refreshCount();
    return () => window.removeEventListener("offline-photos-change", handler);
  }, [refreshCount]);

  const syncOnePhoto = useCallback(async (photo: OfflinePhoto): Promise<boolean> => {
    try {
      const path = `${photo.visiteId}/${photo.pieceId || "general"}/${photo.timestamp}_${photo.fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("visite-photos")
        .upload(path, photo.blob, { contentType: photo.mimeType });
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("visite_photos").insert({
        visite_id: photo.visiteId,
        piece_id: photo.pieceId,
        company_id: photo.companyId,
        storage_path: path,
        file_name: photo.fileName,
        caption: photo.caption || null,
      });
      if (dbError) throw dbError;

      await removeOfflinePhoto(photo.id);
      return true;
    } catch (err) {
      console.error(`[OfflinePhotoSync] Failed to sync photo ${photo.id}:`, err);
      return false;
    }
  }, []);

  const syncAllPhotos = useCallback(async () => {
    const photos = await getAllOfflinePhotos();
    if (photos.length === 0) return;

    setSyncing(true);
    let success = 0;
    let fail = 0;

    for (const photo of photos) {
      const ok = await syncOnePhoto(photo);
      if (ok) success++;
      else fail++;
    }

    setSyncing(false);
    if (success > 0) toast.success(`${success} photo(s) synchronisée(s)`);
    if (fail > 0) toast.error(`${fail} photo(s) en échec — seront retentées`);
    await refreshCount();
  }, [syncOnePhoto, refreshCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingPhotos > 0 && !syncing) {
      syncAllPhotos();
    }
  }, [isOnline, pendingPhotos, syncing, syncAllPhotos]);

  return { pendingPhotos, syncing, syncAllPhotos };
}
