import { useState } from "react";
import { CalendarPlus, Clock, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ScheduleVisiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionId: string;
  payload: any;
  emailSubject?: string;
  clientEmail?: string | null;
  clientName?: string | null;
  onDone: () => void;
}

const timeSlots = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00",
];

export const ScheduleVisiteDialog = ({
  open, onOpenChange, actionId, payload, emailSubject, clientEmail, clientName, onDone,
}: ScheduleVisiteDialogProps) => {
  const queryClient = useQueryClient();

  // Pre-fill from AI analysis
  const suggestedDate = payload?.date_souhaitee || "";
  const suggestedPeriod = payload?.periode || "";

  const [date, setDate] = useState(suggestedDate ? suggestedDate.split("T")[0] : "");
  const [time, setTime] = useState("09:00");
  const [sendConfirmation, setSendConfirmation] = useState(!!clientEmail);
  const [confirmationBody, setConfirmationBody] = useState("");
  const [executing, setExecuting] = useState(false);
  const [draftingEmail, setDraftingEmail] = useState(false);

  const generateConfirmation = async () => {
    setDraftingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: {
          context: {
            clientName: clientName || payload?.contact_name || "le client",
            subject: `Confirmation visite — ${emailSubject || ""}`,
          },
          tone: "cordial",
          intent: "confirmation",
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erreur IA");
      setConfirmationBody(data.draft);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDraftingEmail(false);
    }
  };

  const handleSchedule = async () => {
    if (!date) {
      toast.error("Veuillez sélectionner une date");
      return;
    }
    setExecuting(true);
    try {
      // Execute the plan_visite action with the selected date/time
      const { data, error } = await supabase.functions.invoke("execute-email-action", {
        body: {
          action_id: actionId,
          status: "accepted",
          override_payload: {
            ...payload,
            scheduled_date: `${date}T${time}:00`,
            scheduled_time: time,
          },
        },
      });

      if (error || data?.error) throw new Error(data?.error || "Erreur lors de la planification");

      // Send confirmation email if requested
      if (sendConfirmation && clientEmail && confirmationBody.trim()) {
        const dateFormatted = new Date(`${date}T${time}`).toLocaleDateString("fr-FR", {
          weekday: "long", day: "numeric", month: "long", year: "numeric",
        });

        await supabase.functions.invoke("send-visite-email", {
          body: {
            to: clientEmail,
            subject: `Confirmation de visite — ${dateFormatted} à ${time}`,
            body: confirmationBody,
          },
        });
        toast.success("Visite planifiée et confirmation envoyée");
      } else {
        toast.success("Visite planifiée avec succès");
      }

      queryClient.invalidateQueries({ queryKey: ["visites"] });
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-warning" />
            Planifier la visite
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info from AI */}
          {(suggestedDate || suggestedPeriod) && (
            <div className="rounded-lg border bg-warning/5 p-3 text-sm">
              <p className="text-xs font-medium text-warning mb-1">Suggestion IA</p>
              {suggestedDate && <p className="text-xs">Date souhaitée : {suggestedDate}</p>}
              {suggestedPeriod && <p className="text-xs">Période : {suggestedPeriod}</p>}
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Heure</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location info */}
          {(payload?.address || payload?.ville) && (
            <div className="text-xs text-muted-foreground">
              📍 {[payload.address, payload.code_postal, payload.ville].filter(Boolean).join(", ")}
            </div>
          )}

          {/* Confirmation email toggle */}
          {clientEmail && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Email de confirmation</p>
                  <p className="text-xs text-muted-foreground">Envoyer à {clientEmail}</p>
                </div>
                <Switch checked={sendConfirmation} onCheckedChange={setSendConfirmation} />
              </div>

              {sendConfirmation && (
                <>
                  <Textarea
                    placeholder="Contenu de l'email de confirmation…"
                    value={confirmationBody}
                    onChange={(e) => setConfirmationBody(e.target.value)}
                    rows={5}
                    className="text-sm resize-none"
                  />
                  <Button
                    variant="outline" size="sm" className="text-xs"
                    onClick={generateConfirmation} disabled={draftingEmail}
                  >
                    {draftingEmail ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Clock className="h-3 w-3 mr-1" />}
                    Générer avec l'IA
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSchedule} disabled={executing || !date}>
            {executing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Planifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
