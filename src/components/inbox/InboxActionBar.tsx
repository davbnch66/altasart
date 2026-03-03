import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserPlus, FolderPlus, FileText, CalendarPlus, Package, Link, Loader2, MapPin, FileCheck, ShieldCheck } from "lucide-react";
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
  attach_voirie_plan: { label: "Plan voirie", icon: MapPin, color: "text-blue-600", successMsg: "Plan voirie intégré à la démarche" },
  attach_pv_roc: { label: "PV de ROC", icon: FileCheck, color: "text-amber-600", successMsg: "PV de ROC intégré à la démarche" },
  attach_arrete: { label: "Arrêté municipal", icon: ShieldCheck, color: "text-green-600", successMsg: "Arrêté intégré — Programmez l'intervention au planning" },
};

export const InboxActionBar = ({ actions, onActionExecuted, clientEmail, clientName, emailSubject }: InboxActionBarProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const suggestedActions = actions.filter((a) => a.status === "suggested");
  const [scheduleAction, setScheduleAction] = useState<EmailAction | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  if (suggestedActions.length === 0) return null;

  const handleAccept = async (actionId: string, actionType: string, payload?: any) => {
    setLoadingActionId(actionId);
    try {
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
      queryClient.invalidateQueries({ queryKey: ["dossier-voirie"] });
      onActionExecuted();

      // For arrêté, navigate to planning with pre-filled date
      if (actionType === "attach_arrete" && payload?.arrete_date) {
        toast.info("Programmez l'intervention au planning à la date de l'arrêté", { duration: 5000 });
        navigate(`/planning?date=${payload.arrete_date}&visite_id=${payload.visite_id || ""}`);
      }
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleReject = async (actionId: string) => {
    setLoadingActionId(actionId);
    try {
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
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleAction = (action: EmailAction) => {
    if (action.action_type === "plan_visite") {
      setScheduleAction(action);
    } else {
      handleAccept(action.id, action.action_type, action.payload);
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
                  {action.action_type === "attach_arrete" && action.payload?.arrete_date && (
                    <p className="text-xs text-green-600 truncate">📅 Date d'intervention : {action.payload.arrete_date}</p>
                  )}
                  {["attach_voirie_plan", "attach_pv_roc", "attach_arrete"].includes(action.action_type) && (
                    <p className="text-xs text-muted-foreground truncate">
                      📎 {(action.payload?.attachments || []).length} pièce(s) jointe(s) à intégrer
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleReject(action.id)} disabled={!!loadingActionId}>
                    {loadingActionId === action.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ignorer"}
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={() => handleAction(action)} disabled={!!loadingActionId}>
                    {loadingActionId === action.id ? <Loader2 className="h-3 w-3 animate-spin" /> : action.action_type === "plan_visite" ? "Planifier" : action.action_type === "attach_arrete" ? "Intégrer & Programmer" : ["attach_voirie_plan", "attach_pv_roc"].includes(action.action_type) ? "Intégrer" : "Valider"}
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
