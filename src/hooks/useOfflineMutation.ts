import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addToQueue } from "@/lib/offlineQueue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { toast } from "sonner";

interface OfflineMutationOptions {
  table: string;
  operation: "insert" | "update" | "delete";
  invalidateKeys?: string[][];
  matchColumn?: string;
  successMessage?: string;
}

/**
 * A mutation hook that falls back to offline queue when there's no connection.
 * When online, it behaves like a normal Supabase mutation.
 * When offline, it queues the mutation and optimistically updates the UI.
 */
export function useOfflineMutation<TData extends Record<string, any>>(
  options: OfflineMutationOptions
) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  return useMutation({
    mutationFn: async (data: TData) => {
      if (!isOnline) {
        // Queue for later sync
        addToQueue({
          table: options.table,
          operation: options.operation,
          data,
          matchColumn: options.matchColumn,
          matchValue: options.matchColumn ? (data as any)[options.matchColumn] : (data as any).id,
        });
        toast.info("Sauvegardé hors-ligne — sera synchronisé au retour de la connexion");
        return data;
      }

      // Online: execute normally
      const tableName = options.table as any;
      if (options.operation === "insert") {
        const { data: result, error } = await supabase.from(tableName).insert(data).select().single();
        if (error) throw error;
        return result;
      } else if (options.operation === "update") {
        const col = options.matchColumn || "id";
        const val = (data as any)[col];
        const { data: result, error } = await supabase.from(tableName).update(data).eq(col, val).select().single();
        if (error) throw error;
        return result;
      } else if (options.operation === "delete") {
        const col = options.matchColumn || "id";
        const val = (data as any)[col];
        const { error } = await supabase.from(tableName).delete().eq(col, val);
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      if (options.successMessage && isOnline) {
        toast.success(options.successMessage);
      }
      if (options.invalidateKeys) {
        options.invalidateKeys.forEach((key) =>
          queryClient.invalidateQueries({ queryKey: key })
        );
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur");
    },
  });
}
