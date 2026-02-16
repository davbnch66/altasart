import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FileText, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const statusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  brouillon: "secondary",
  envoye: "default",
  accepte: "default",
  refuse: "destructive",
  expire: "outline",
};

interface Props {
  visiteId: string;
}

export const VisiteDevisHistory = ({ visiteId }: Props) => {
  const navigate = useNavigate();

  const { data: devisList, isLoading } = useQuery({
    queryKey: ["visite-devis-history", visiteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devis")
        .select("id, code, objet, amount, status, created_at")
        .eq("visite_id", visiteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">Chargement...</div>;
  }

  if (!devisList || devisList.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Aucun devis généré par IA pour cette visite</p>
      </div>
    );
  }

  const amounts = devisList.map((d) => d.amount);
  const maxAmount = Math.max(...amounts);
  const minAmount = Math.min(...amounts);
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      {devisList.length > 1 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Min</p>
            <p className="text-lg font-bold text-destructive">{minAmount.toLocaleString("fr-FR")} €</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Moyenne</p>
            <p className="text-lg font-bold">{avgAmount.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Max</p>
            <p className="text-lg font-bold text-success">{maxAmount.toLocaleString("fr-FR")} €</p>
          </Card>
        </div>
      )}

      {/* Devis list */}
      <div className="space-y-2">
        {devisList.map((devis, idx) => {
          const prev = devisList[idx + 1];
          const diff = prev ? ((devis.amount - prev.amount) / prev.amount) * 100 : null;

          return (
            <Card
              key={devis.id}
              className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/devis/${devis.id}`)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm truncate">
                      {devis.code || devis.objet}
                    </span>
                    <Badge variant={statusVariant[devis.status] || "secondary"} className="text-[10px]">
                      {statusLabels[devis.status] || devis.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(devis.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold">{devis.amount.toLocaleString("fr-FR")} €</p>
                  {diff !== null && (
                    <div className={`flex items-center justify-end gap-1 text-xs ${diff > 0 ? "text-destructive" : diff < 0 ? "text-success" : "text-muted-foreground"}`}>
                      {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      <span>{diff > 0 ? "+" : ""}{diff.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
