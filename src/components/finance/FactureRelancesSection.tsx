import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Send, Loader2, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  factureId: string;
  factureCode: string;
  clientEmail?: string | null;
  clientName?: string | null;
  montantDu: number;
  companyId: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);

const statusIcon: Record<string, React.ReactNode> = {
  sent: <CheckCircle2 className="h-3 w-3 text-success" />,
  pending: <Clock className="h-3 w-3 text-warning" />,
  error: <AlertTriangle className="h-3 w-3 text-destructive" />,
};

export const FactureRelancesSection = ({ factureId, factureCode, clientEmail, clientName, montantDu, companyId }: Props) => {
  const queryClient = useQueryClient();

  const { data: relances = [] } = useQuery({
    queryKey: ["facture-relances", factureId],
    queryFn: async () => {
      const { data } = await supabase
        .from("facture_relances")
        .select("*")
        .eq("facture_id", factureId)
        .order("relance_num");
      return data || [];
    },
  });

  const sendRelance = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-facture-relance", {
        body: { facture_ids: [factureId] },
      });
      if (error) throw new Error(error.message || "Erreur");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Relance envoyée");
      queryClient.invalidateQueries({ queryKey: ["facture-relances", factureId] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de l'envoi"),
  });

  const nextNum = relances.length + 1;

  return (
    <Card className="overflow-hidden">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Relances ({relances.length})
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => sendRelance.mutate()}
          disabled={sendRelance.isPending || !clientEmail}
          title={!clientEmail ? "Aucun email client" : undefined}
        >
          {sendRelance.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Envoyer relance n°{nextNum}
        </Button>
      </div>

      {relances.length > 0 ? (
        <div className="divide-y">
          {relances.map((r: any) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                N°{r.relance_num}
              </Badge>
              <div className="flex-1 min-w-0">
                <span className="text-muted-foreground text-xs">
                  {format(new Date(r.sent_at), "d MMM yyyy à HH:mm", { locale: fr })}
                </span>
                {r.recipient_email && (
                  <span className="text-muted-foreground text-xs ml-2">→ {r.recipient_email}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {statusIcon[r.status] || statusIcon.sent}
                <span className="text-[10px] text-muted-foreground capitalize">{r.status}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-xs text-muted-foreground py-6">
          Aucune relance envoyée — {fmt(montantDu)} en attente
        </div>
      )}
    </Card>
  );
};
