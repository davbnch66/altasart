import { WifiOff, RefreshCw, CloudOff, CheckCircle2 } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export const OfflineBanner = () => {
  const { isOnline, pendingCount, syncing, syncAll } = useOfflineSync();

  if (isOnline && pendingCount === 0) return null;

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
            syncing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Synchronisation en cours...</span>
              </>
            ) : (
              <>
                <CloudOff className="h-4 w-4" />
                <span>{pendingCount} modification(s) en attente</span>
              </>
            )
          ) : (
            <>
              <WifiOff className="h-4 w-4" />
              <span>
                Mode hors-ligne
                {pendingCount > 0 && ` — ${pendingCount} modification(s) en attente`}
              </span>
            </>
          )}
        </div>
        {isOnline && pendingCount > 0 && !syncing && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={syncAll}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Synchroniser
          </Button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
