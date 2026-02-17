import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, FolderPlus, FileText, CalendarPlus, Package, Link } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ScheduleVisiteDialog } from "./ScheduleVisiteDialog";

interface EmailAction {
  id: string;
  action_type: string;
  status: string;
  payload: any;
}

interface InboxActionBarProps {
  actions: EmailAction[];
  onActionExecuted: () => void;
  clientEmail?: string | null;
  clientName?: string | null;
  emailSubject?: string;
}

const actionConfig: Record<string, { label: string; icon: React.ElementType; color: string; successMsg: string }> = {
  create_client: { label: "Créer client", icon: UserPlus, color: "text-primary", successMsg: "Client créé avec succès" },
  create_dossier: { label: "Créer dossier", icon: FolderPlus, color: "text-info", successMsg: "Dossier créé avec succès" },
  create_devis: { label: "Créer devis", icon: FileText, color: "text-success", successMsg: "Devis créé avec succès" },
  plan_visite: { label: "Planifier visite", icon: CalendarPlus, color: "text-warning", successMsg: "Visite planifiée avec succès" },
  extract_materiel: { label: "Extraire matériel", icon: Package, color: "text-primary", successMsg: "Matériel extrait avec succès" },
  link_dossier: { label: "Associer dossier", icon: Link, color: "text-muted-foreground", successMsg: "Dossier associé" },
};

export const InboxActionBar = ({ actions, onActionExecuted, clientEmail, clientName, emailSubject }: InboxActionBarProps) => {
  const queryClient = useQueryClient();
  const suggestedActions = actions.filter((a) => a.status === "suggested");
  const [scheduleAction, setScheduleAction] = useState<EmailAction | null>(null);

  if (suggestedActions.length === 0) return null;

  const handleAccept = async (actionId: string, actionType: string) => {
    const config = actionConfig[actionType];
    const { data, error } = await supabase.functions.invoke("execute-email-action", {
      body: { action_id: actionId, status: "accepted" },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Erreur lors de l'exécution");
      return;
    }
    toast.success(config?.successMsg || "Action validée");
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    queryClient.invalidateQueries({ queryKey: ["dossiers"] });
    queryClient.invalidateQueries({ queryKey: ["devis"] });
    queryClient.invalidateQueries({ queryKey: ["visites"] });
    onActionExecuted();
  };

  const handleReject = async (actionId: string) => {
    const { error } = await supabase
      .from("email_actions")
      .update({ status: "rejected" })
      .eq("id", actionId);
    if (error) {
      toast.error("Erreur");
      return;
    }
    toast.success("Action ignorée");
    onActionExecuted();
  };

  const handleAction = (action: EmailAction) => {
    if (action.action_type === "plan_visite") {
      setScheduleAction(action);
    } else {
      handleAccept(action.id, action.action_type);
    }
  };

  return (
    <>
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Actions suggérées</h3>
        <div className="space-y-2">
          {suggestedActions.map((action) => {
            const config = actionConfig[action.action_type] || { label: action.action_type, icon: Link, color: "", successMsg: "OK" };
            const Icon = config.icon;
            return (
              <div key={action.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{config.label}</p>
                  {action.payload?.name && <p className="text-xs text-muted-foreground truncate">{action.payload.name}</p>}
                  {action.payload?.title && <p className="text-xs text-muted-foreground truncate">{action.payload.title}</p>}
                  {action.payload?.objet && <p className="text-xs text-muted-foreground truncate">{action.payload.objet}</p>}
                  {action.action_type === "plan_visite" && action.payload?.date_souhaitee && (
                    <p className="text-xs text-warning truncate">📅 Date souhaitée : {action.payload.date_souhaitee}</p>
                  )}
                  {action.action_type === "plan_visite" && action.payload?.periode && (
                    <p className="text-xs text-warning truncate">📅 Période : {action.payload.periode}</p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleReject(action.id)}>
                    Ignorer
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={() => handleAction(action)}>
                    {action.action_type === "plan_visite" ? "Planifier" : "Valider"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {scheduleAction && (
        <ScheduleVisiteDialog
          open={!!scheduleAction}
          onOpenChange={(open) => { if (!open) setScheduleAction(null); }}
          actionId={scheduleAction.id}
          payload={scheduleAction.payload}
          emailSubject={emailSubject}
          clientEmail={clientEmail}
          clientName={clientName}
          onDone={onActionExecuted}
        />
      )}
    </>
  );
};
