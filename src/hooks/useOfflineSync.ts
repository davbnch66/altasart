import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getQueue, removeFromQueue, getQueueCount, type QueuedMutation } from "@/lib/offlineQueue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { toast } from "sonner";

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(getQueueCount());
  const [syncing, setSyncing] = useState(false);

  // Listen for queue changes
  useEffect(() => {
    const handler = (e: Event) => {
      const count = (e as CustomEvent).detail ?? getQueueCount();
      setPendingCount(count);
    };
    window.addEventListener("offline-queue-change", handler);
    return () => window.removeEventListener("offline-queue-change", handler);
  }, []);

  const syncOne = useCallback(async (mutation: QueuedMutation): Promise<boolean> => {
    try {
      const tableName = mutation.table as any;
      if (mutation.operation === "insert") {
        const { error } = await supabase.from(tableName).insert(mutation.data);
        if (error) throw error;
      } else if (mutation.operation === "update") {
        const col = mutation.matchColumn || "id";
        const val = mutation.matchValue || mutation.data.id;
        const { error } = await supabase.from(tableName).update(mutation.data).eq(col, val);
        if (error) throw error;
      } else if (mutation.operation === "delete") {
        const col = mutation.matchColumn || "id";
        const val = mutation.matchValue || mutation.data.id;
        const { error } = await supabase.from(tableName).delete().eq(col, val);
        if (error) throw error;
      }
      removeFromQueue(mutation.id);
      return true;
    } catch (err: any) {
      console.error(`[OfflineSync] Failed to sync mutation ${mutation.id}:`, err);
      return false;
    }
  }, []);

  const syncAll = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;
    setSyncing(true);
    let successCount = 0;
    let failCount = 0;

    for (const mutation of queue) {
      const success = await syncOne(mutation);
      if (success) successCount++;
      else failCount++;
    }

    setSyncing(false);
    if (successCount > 0) {
      toast.success(`${successCount} modification(s) synchronisée(s)`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} modification(s) en échec — elles seront retentées`);
    }
    setPendingCount(getQueueCount());
  }, [syncOne]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncAll();
    }
  }, [isOnline, pendingCount, syncAll]);

  return { isOnline, pendingCount, syncing, syncAll };
}
