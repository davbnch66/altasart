import { Button } from "@/components/ui/button";
import { UserPlus, FolderPlus, FileText, CalendarPlus, Package, Link } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailAction {
  id: string;
  action_type: string;
  status: string;
  payload: any;
}

interface InboxActionBarProps {
  actions: EmailAction[];
  onActionExecuted: () => void;
}

const actionConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  create_client: { label: "Créer client", icon: UserPlus, color: "text-primary" },
  create_dossier: { label: "Créer dossier", icon: FolderPlus, color: "text-info" },
  create_devis: { label: "Créer devis", icon: FileText, color: "text-success" },
  plan_visite: { label: "Planifier visite", icon: CalendarPlus, color: "text-warning" },
  extract_materiel: { label: "Extraire matériel", icon: Package, color: "text-primary" },
  link_dossier: { label: "Associer dossier", icon: Link, color: "text-muted-foreground" },
};

export const InboxActionBar = ({ actions, onActionExecuted }: InboxActionBarProps) => {
  const suggestedActions = actions.filter((a) => a.status === "suggested");
  if (suggestedActions.length === 0) return null;

  const handleAccept = async (actionId: string) => {
    const { error } = await supabase.functions.invoke("execute-email-action", {
      body: { action_id: actionId, status: "accepted" },
    });
    if (error) {
      toast.error("Erreur lors de l'exécution");
      return;
    }
    toast.success("Action validée");
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
    toast.success("Action rejetée");
    onActionExecuted();
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">Actions suggérées</h3>
      <div className="space-y-2">
        {suggestedActions.map((action) => {
          const config = actionConfig[action.action_type] || { label: action.action_type, icon: Link, color: "" };
          const Icon = config.icon;
          return (
            <div key={action.id} className="flex items-center gap-3 rounded-lg border p-3">
              <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{config.label}</p>
                {action.payload?.name && <p className="text-xs text-muted-foreground truncate">{action.payload.name}</p>}
                {action.payload?.title && <p className="text-xs text-muted-foreground truncate">{action.payload.title}</p>}
                {action.payload?.objet && <p className="text-xs text-muted-foreground truncate">{action.payload.objet}</p>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleReject(action.id)}>
                  Ignorer
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={() => handleAccept(action.id)}>
                  Valider
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
