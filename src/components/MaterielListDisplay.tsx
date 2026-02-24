import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package } from "lucide-react";

interface Props {
  /** Direct visite ID */
  visiteId?: string | null;
  /** Dossier ID — will find visite via devis */
  dossierId?: string | null;
  /** Compact mode for inline display */
  compact?: boolean;
  className?: string;
}

/**
 * Displays the material list from a visite (dynamic link).
 * Accepts either a visiteId directly or a dossierId (finds visite via devis).
 */
export const MaterielListDisplay = ({ visiteId, dossierId, compact = false, className = "" }: Props) => {
  // If dossierId provided, find the visite_id via devis
  const { data: resolvedVisiteId } = useQuery({
    queryKey: ["resolve-visite-from-dossier", dossierId],
    queryFn: async () => {
      if (!dossierId) return null;
      const { data } = await supabase
        .from("devis")
        .select("visite_id")
        .eq("dossier_id", dossierId)
        .not("visite_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0]?.visite_id || null;
    },
    enabled: !!dossierId && !visiteId,
  });

  const effectiveVisiteId = visiteId || resolvedVisiteId;

  const { data: materiel = [], isLoading } = useQuery({
    queryKey: ["visite-materiel-display", effectiveVisiteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visite_materiel")
        .select("id, designation, quantity, weight, dimensions")
        .eq("visite_id", effectiveVisiteId!)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveVisiteId,
  });

  const totalWeight = materiel.reduce((sum, m) => sum + (m.weight || 0) * (m.quantity || 1), 0);

  if (!effectiveVisiteId && !isLoading) {
    return (
      <div className={`rounded-lg border border-dashed bg-muted/30 p-3 ${className}`}>
        <div className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground italic">Aucune visite liée — liste matériel non disponible</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`rounded-lg border bg-card p-3 ${className}`}>
        <p className="text-[10px] text-muted-foreground animate-pulse">Chargement du matériel…</p>
      </div>
    );
  }

  if (materiel.length === 0) {
    return (
      <div className={`rounded-lg border border-dashed bg-muted/30 p-3 ${className}`}>
        <div className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground italic">Aucun matériel dans la visite</span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="flex items-center gap-1.5 mb-1">
          <Package className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Matériel ({materiel.length})
          </span>
          {totalWeight > 0 && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              Total : {totalWeight >= 1000 ? `${(totalWeight / 1000).toFixed(2)} t` : `${totalWeight} kg`}
            </span>
          )}
        </div>
        {materiel.map((m) => (
          <div key={m.id} className="flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded bg-muted/50">
            <span className="truncate flex-1">{m.designation} × {m.quantity}</span>
            {m.weight != null && <span className="text-muted-foreground ml-2 shrink-0">{m.weight} kg</span>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border bg-card p-3 space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-primary" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
            Liste matériel ({materiel.length})
          </h4>
        </div>
        {totalWeight > 0 && (
          <span className="text-xs font-medium text-muted-foreground">
            Poids total : {totalWeight >= 1000 ? `${(totalWeight / 1000).toFixed(2)} t` : `${totalWeight} kg`}
          </span>
        )}
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-2 py-1.5 text-[10px] font-medium text-muted-foreground">Désignation</th>
              <th className="text-center px-2 py-1.5 text-[10px] font-medium text-muted-foreground w-12">Qté</th>
              <th className="text-right px-2 py-1.5 text-[10px] font-medium text-muted-foreground w-16">Poids</th>
              <th className="text-right px-2 py-1.5 text-[10px] font-medium text-muted-foreground w-20">Dimensions</th>
            </tr>
          </thead>
          <tbody>
            {materiel.map((m) => (
              <tr key={m.id} className="border-b last:border-b-0">
                <td className="px-2 py-1.5 text-xs">{m.designation}</td>
                <td className="px-2 py-1.5 text-center text-xs">{m.quantity}</td>
                <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">
                  {m.weight != null ? `${m.weight} kg` : "—"}
                </td>
                <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">
                  {m.dimensions || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
