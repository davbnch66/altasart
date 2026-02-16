import { WifiOff, RefreshCw, CloudOff, Camera } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useOfflinePhotoSync } from "@/hooks/useOfflinePhotoSync";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export const OfflineBanner = () => {
  const { isOnline, pendingCount, syncing, syncAll } = useOfflineSync();
  const { pendingPhotos, syncing: syncingPhotos } = useOfflinePhotoSync();

  const totalPending = pendingCount + pendingPhotos;
  if (isOnline && totalPending === 0) return null;

  const isSyncing = syncing || syncingPhotos;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className={`px-4 py-2 flex items-center justify-between gap-2 text-sm ${
          isOnline
            ? "bg-amber-500/10 text-amber-700 border-b border-amber-500/20"
            : "bg-destructive/10 text-destructive border-b border-destructive/20"
        }`}
      >
        <div className="flex items-center gap-2">
          {isOnline ? (
            isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Synchronisation en cours...</span>
              </>
            ) : (
              <>
                <CloudOff className="h-4 w-4" />
                <span>
                  {pendingCount > 0 && `${pendingCount} modification(s)`}
                  {pendingCount > 0 && pendingPhotos > 0 && " + "}
                  {pendingPhotos > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Camera className="h-3 w-3" /> {pendingPhotos} photo(s)
                    </span>
                  )}
                  {" "}en attente
                </span>
              </>
            )
          ) : (
            <>
              <WifiOff className="h-4 w-4" />
              <span>
                Mode hors-ligne
                {totalPending > 0 && ` — ${totalPending} élément(s) en attente`}
                {pendingPhotos > 0 && (
                  <span className="inline-flex items-center gap-0.5 ml-1">
                    (<Camera className="h-3 w-3" /> {pendingPhotos} photo(s))
                  </span>
                )}
              </span>
            </>
          )}
        </div>
        {isOnline && totalPending > 0 && !isSyncing && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={syncAll}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Synchroniser
          </Button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
