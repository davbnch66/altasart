import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Send, Clock, CheckCircle, AlertTriangle, RefreshCw, Plus, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DevisRelancesSectionProps {
  devis: any;
}

const RELANCE_SCHEDULES = [
  { num: 1, label: "1ère relance", days: 3 },
  { num: 2, label: "2ème relance", days: 7 },
  { num: 3, label: "3ème relance", days: 14 },
];

const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "dd MMM yyyy 'à' HH:mm", { locale: fr });
  } catch {
    return "—";
  }
};

export const DevisRelancesSection = ({ devis }: DevisRelancesSectionProps) => {
  const queryClient = useQueryClient();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedRelanceNum, setSelectedRelanceNum] = useState<number>(1);
  const [recipientEmail, setRecipientEmail] = useState(devis.clients?.email || "");
  const [recipientName, setRecipientName] = useState(devis.clients?.name || "");
  const [customMessage, setCustomMessage] = useState("");
  const [aiTone, setAiTone] = useState("cordial");
  const [generatingAi, setGeneratingAi] = useState(false);

  const { data: relances = [] } = useQuery({
    queryKey: ["devis-relances", devis.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devis_relances" as any)
        .select("*")
        .eq("devis_id", devis.id)
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const sendRelanceMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");

      const response = await supabase.functions.invoke("send-devis-relance", {
        body: {
          devisId: devis.id,
          recipientEmail: recipientEmail.trim(),
          recipientName: recipientName.trim() || null,
          relanceNum: selectedRelanceNum,
          customMessage: customMessage.trim() || null,
        },
      });

      if (response.error) throw new Error(response.error.message);
    },
    onSuccess: () => {
      toast.success("Relance envoyée avec succès !");
      queryClient.invalidateQueries({ queryKey: ["devis-relances", devis.id] });
      setSendDialogOpen(false);
      setCustomMessage("");
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de l'envoi"),
  });

  const generateWithAI = async () => {
    setGeneratingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-email-template", {
        body: {
          type: selectedRelanceNum === 1 ? "relance_1" : selectedRelanceNum === 2 ? "relance_2" : "relance_3",
          tone: aiTone,
          companyId: devis.company_id,
          context: { devisCode: devis.code, devisObjet: devis.objet, clientName: devis.clients?.name, relanceNum: selectedRelanceNum },
        },
      });
      if (error) throw error;
      if (data?.body) setCustomMessage(data.body);
      toast.success("Message généré par l'IA");
    } catch (e: any) {
      toast.error("Erreur lors de la génération IA");
    } finally {
      setGeneratingAi(false);
    }
  };

  const sentAt = devis.sent_at ? new Date(devis.sent_at) : null;
  const isAccepted = devis.status === "accepte";
  const isRefused = devis.status === "refuse";
  const daysSinceSent = sentAt ? differenceInDays(new Date(), sentAt) : null;

  // Determine which relances are suggested
  const sentRelanceNums = new Set((relances as any[]).map((r: any) => r.relance_num));
  const suggestedRelance = sentAt && !isAccepted && !isRefused
    ? RELANCE_SCHEDULES.find(s => daysSinceSent !== null && daysSinceSent >= s.days && !sentRelanceNums.has(s.num))
    : null;

  const openSendDialog = (relanceNum: number) => {
    setSelectedRelanceNum(relanceNum);
    setCustomMessage("");
    setSendDialogOpen(true);
  };

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Relances ({(relances as any[]).length})
          </h3>
        </div>
        {!isAccepted && !isRefused && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openSendDialog(Math.min((relances as any[]).length + 1, 3))}
            className="h-7 text-xs gap-1"
          >
            <Plus className="h-3 w-3" />
            Relancer
          </Button>
        )}
      </div>

      {/* Suggestion automatique */}
      {suggestedRelance && (
        <div className="rounded-lg bg-info/5 border border-info/20 p-3 flex items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-info shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-info">Relance suggérée</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {daysSinceSent} jours depuis l'envoi — {suggestedRelance.label} recommandée (J+{suggestedRelance.days})
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => openSendDialog(suggestedRelance.num)}
            className="h-7 text-xs shrink-0"
          >
            <Send className="h-3 w-3 mr-1" />
            Envoyer
          </Button>
        </div>
      )}

      {/* Calendrier des relances */}
      {sentAt && (
        <div className="grid grid-cols-3 gap-2">
          {RELANCE_SCHEDULES.map((schedule) => {
            const sent = (relances as any[]).find((r: any) => r.relance_num === schedule.num);
            const targetDate = new Date(sentAt);
            targetDate.setDate(targetDate.getDate() + schedule.days);
            const isPast = new Date() >= targetDate;
            const isDue = isPast && !sent && !isAccepted && !isRefused;

            return (
              <div
                key={schedule.num}
                className={`rounded-lg border p-3 text-center space-y-1.5 transition-colors ${
                  sent
                    ? "border-success/30 bg-success/5"
                    : isDue
                    ? "border-warning/30 bg-warning/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex justify-center">
                  {sent ? (
                    <CheckCircle className="h-4 w-4 text-success" />
                  ) : isDue ? (
                    <Clock className="h-4 w-4 text-warning" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">{schedule.label}</p>
                <p className="text-[10px] text-muted-foreground">J+{schedule.days}</p>
                {sent ? (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-success/40 text-success">
                    Envoyée
                  </Badge>
                ) : isDue ? (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-warning/40 text-warning">
                    En retard
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">
                    Prévue
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Historique des relances */}
      {(relances as any[]).length > 0 ? (
        <div className="space-y-2">
          {(relances as any[]).map((relance: any) => (
            <div key={relance.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
                <div>
                  <p className="font-medium">Relance #{relance.relance_num}</p>
                  <p className="text-muted-foreground">{relance.recipient_email}</p>
                </div>
              </div>
              <p className="text-muted-foreground shrink-0">{formatDate(relance.sent_at)}</p>
            </div>
          ))}
        </div>
      ) : (
        !sentAt && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Envoyez d'abord le devis pour activer les relances automatiques
          </p>
        )
      )}

      {isAccepted && (
        <div className="flex items-center gap-2 text-xs text-success">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>Devis accepté — pas de relance nécessaire</span>
        </div>
      )}

      {/* Dialog d'envoi */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Envoyer une relance #{selectedRelanceNum}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Un email de relance avec le lien de signature sera envoyé au destinataire.
            </p>

            <div className="space-y-3">
              <div>
                <Label htmlFor="relance-email">Email du destinataire *</Label>
                <Input
                  id="relance-email"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="client@exemple.fr"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="relance-name">Nom du destinataire</Label>
                <Input
                  id="relance-name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="relance-message">Message personnalisé (optionnel)</Label>
                <Textarea
                  id="relance-message"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Ajoutez un message personnalisé pour cette relance..."
                  className="mt-1 min-h-[80px]"
                />
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!recipientEmail.trim() || sendRelanceMutation.isPending}
              onClick={() => sendRelanceMutation.mutate()}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendRelanceMutation.isPending ? "Envoi en cours..." : "Envoyer la relance"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
