import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
};

const statusStyles: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-info/10 text-info",
  accepte: "bg-success/10 text-success",
  refuse: "bg-destructive/10 text-destructive",
  expire: "bg-warning/10 text-warning",
};

interface DevisStatusSelectProps {
  devisId: string;
  currentStatus: string;
  size?: "xs" | "sm";
}

export const DevisStatusSelect = ({ devisId, currentStatus, size = "sm" }: DevisStatusSelectProps) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const updates: Record<string, any> = { status: newStatus };
      if (newStatus === "envoye") updates.sent_at = new Date().toISOString();
      if (newStatus === "accepte") updates.accepted_at = new Date().toISOString();
      const { error } = await supabase.from("devis").update(updates).eq("id", devisId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut mis à jour");
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      queryClient.invalidateQueries({ queryKey: ["client-devis"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-devis"] });
      queryClient.invalidateQueries({ queryKey: ["devis-detail"] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const sizeClasses = size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex rounded-full font-medium cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all ${sizeClasses} ${statusStyles[currentStatus] || ""}`}
        >
          {statusLabels[currentStatus] || currentStatus}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {Object.entries(statusLabels).map(([key, label]) => (
          <DropdownMenuItem
            key={key}
            disabled={key === currentStatus}
            onClick={() => mutation.mutate(key)}
            className="text-xs"
          >
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium mr-2 ${statusStyles[key]}`}>{label}</span>
            {key === currentStatus && "✓"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
