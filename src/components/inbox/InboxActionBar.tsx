import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  UserPlus, FolderPlus, FileText, CalendarPlus, Package, Link, Loader2,
  MapPin, FileCheck, ShieldCheck, UserCheck, Users, Sparkles, Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ScheduleVisiteDialog } from "./ScheduleVisiteDialog";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

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
  link_existing_client: { label: "Associer à un client", icon: UserCheck, color: "text-amber-600", successMsg: "Client associé avec succès" },
  enrich_client: { label: "Enrichir fiche client", icon: Sparkles, color: "text-emerald-600", successMsg: "Fiche client enrichie" },
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
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string>>({});

  if (suggestedActions.length === 0) return null;

  const handleAccept = async (actionId: string, actionType: string, payload?: any) => {
    setLoadingActionId(actionId);
    try {
      const config = actionConfig[actionType];

      // For link_existing_client, we need to pass the selected candidate
      let overridePayload: any = undefined;
      if (actionType === "link_existing_client") {
        const selected = selectedCandidates[actionId];
        if (selected === "__new__") {
          // User chose to create new — reject this and let create_client handle it
          // Actually we execute with a special flag
          overridePayload = { selected_client_id: null, create_new: true };
        } else if (selected) {
          overridePayload = { selected_client_id: selected };
        } else {
          toast.error("Sélectionnez un client ou choisissez 'Créer un nouveau'");
          setLoadingActionId(null);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke("execute-email-action", {
        body: {
          action_id: actionId,
          status: overridePayload?.create_new ? "rejected" : "accepted",
          ...(overridePayload && !overridePayload.create_new ? { override_payload: overridePayload } : {}),
        },
      });
      if (error) {
        let errorMsg = "Erreur lors de l'exécution";
        if (error instanceof Error && 'context' in error) {
          try {
            const ctx = (error as any).context;
            if (ctx?.json) {
              const body = await ctx.json();
              errorMsg = body?.error || errorMsg;
            }
          } catch {}
        }
        toast.error(errorMsg);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // If user chose "create new" from link_existing_client, create the client
      if (overridePayload?.create_new) {
        const action = suggestedActions.find(a => a.id === actionId);
        if (action?.payload?.new_client_data) {
          // Find or create a create_client action
          const { data: newAction, error: insertErr } = await supabase
            .from("email_actions")
            .insert({
              inbound_email_id: action.payload.inbound_email_id || actions[0]?.payload?.inbound_email_id,
              company_id: action.payload.company_id || actions[0]?.payload?.company_id,
              action_type: "create_client",
              payload: action.payload.new_client_data,
              status: "suggested",
            } as any)
            .select("id")
            .single();

          if (!insertErr && newAction) {
            await supabase.functions.invoke("execute-email-action", {
              body: { action_id: newAction.id, status: "accepted" },
            });
          }
        }
        toast.success("Nouveau client créé");
      } else {
        toast.success(config?.successMsg || "Action validée");
      }

      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      queryClient.invalidateQueries({ queryKey: ["visites"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-voirie"] });
      onActionExecuted();

      if (actionType === "attach_arrete" && payload?.arrete_date) {
        toast.info("Programmez l'intervention au planning à la date de l'arrêté", { duration: 5000 });
        navigate(`/planning?date=${payload.arrete_date}&visite_id=${payload.visite_id || ""}`);
      }
    } catch (err) {
      console.error("Action execution failed:", err);
      toast.error("Erreur réseau — vérifiez votre connexion et réessayez");
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleReject = async (actionId: string) => {
    setLoadingActionId(actionId);
    try {
      const { error } = await supabase
        .from("email_actions")
        .update({ status: "rejected" } as any)
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

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (score >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-orange-600 bg-orange-50 border-orange-200";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return "Très probable";
    if (score >= 50) return "Probable";
    return "Possible";
  };

  const renderEnrichmentDetails = (enrichments: string[]) => {
    const labels: Record<string, string> = {
      new_contact: "➕ Ajouter un nouveau contact",
      add_phone: "📞 Compléter le téléphone",
      add_mobile: "📱 Compléter le mobile",
      add_address: "📍 Compléter l'adresse",
    };
    return (
      <div className="space-y-0.5 mt-1">
        {enrichments.map((e) => (
          <p key={e} className="text-xs text-muted-foreground">{labels[e] || e}</p>
        ))}
      </div>
    );
  };

  const handleAcceptAll = async () => {
    setLoadingActionId("all");
    const ordered = [
      ...suggestedActions.filter(a => ["create_client", "link_existing_client"].includes(a.action_type)),
      ...suggestedActions.filter(a => a.action_type === "create_dossier"),
      ...suggestedActions.filter(a => a.action_type === "plan_visite"),
      ...suggestedActions.filter(a => a.action_type === "create_devis"),
      ...suggestedActions.filter(a => !["create_client", "link_existing_client", "create_dossier", "plan_visite", "create_devis"].includes(a.action_type)),
    ];
    for (const action of ordered) {
      try {
        let overridePayload: any = undefined;
        if (action.action_type === "link_existing_client") {
          const best = (action.payload?.candidates || []).sort((a: any, b: any) => (b.score || 0) - (a.score || 0))[0];
          if (best) overridePayload = { selected_client_id: best.client_id };
        }
        await supabase.functions.invoke("execute-email-action", {
          body: {
            action_id: action.id,
            status: "accepted",
            ...(overridePayload ? { override_payload: overridePayload } : {}),
          },
        });
      } catch (err) {
        console.error(`Erreur action ${action.action_type}:`, err);
      }
    }
    toast.success("Toutes les actions ont été validées !");
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    queryClient.invalidateQueries({ queryKey: ["dossiers"] });
    queryClient.invalidateQueries({ queryKey: ["visites"] });
    queryClient.invalidateQueries({ queryKey: ["devis"] });
    queryClient.invalidateQueries({ queryKey: ["dossier-voirie"] });
    setLoadingActionId(null);
    onActionExecuted();
  };

  return (
    <>
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Actions suggérées</h3>

        {suggestedActions.length >= 2 && (
          <Button
            className="w-full gap-2 bg-success hover:bg-success/90 text-success-foreground btn-primary-glow"
            onClick={handleAcceptAll}
            disabled={!!loadingActionId}
          >
            {loadingActionId === "all"
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Check className="h-4 w-4" />
            }
            Valider toutes les actions ({suggestedActions.length})
          </Button>
        )}

        <div className="space-y-2">
          {suggestedActions.map((action) => {
            const config = actionConfig[action.action_type] || { label: action.action_type, icon: Link, color: "", successMsg: "OK" };
            const Icon = config.icon;

            // Special rendering for link_existing_client
            if (action.action_type === "link_existing_client") {
              const candidates = action.payload?.candidates || [];
              const selected = selectedCandidates[action.id];
              return (
                <div key={action.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-sm font-medium">Client existant détecté — Vérifiez la correspondance</p>
                  </div>

                  <RadioGroup
                    value={selected || ""}
                    onValueChange={(val) => setSelectedCandidates(prev => ({ ...prev, [action.id]: val }))}
                    className="space-y-2"
                  >
                    {candidates.map((c: any) => (
                      <div
                        key={c.client_id}
                        className={`flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                          selected === c.client_id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedCandidates(prev => ({ ...prev, [action.id]: c.client_id }))}
                      >
                        <RadioGroupItem value={c.client_id} id={`${action.id}-${c.client_id}`} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`${action.id}-${c.client_id}`} className="text-sm font-medium cursor-pointer">
                              {c.name}
                            </Label>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getScoreColor(c.score)}`}>
                              {c.score}% — {getScoreLabel(c.score)}
                            </Badge>
                          </div>
                          {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(c.reasons || []).map((r: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {selected === c.client_id && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                      </div>
                    ))}

                    {/* Option to create new */}
                    <div
                      className={`flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                        selected === "__new__" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedCandidates(prev => ({ ...prev, [action.id]: "__new__" }))}
                    >
                      <RadioGroupItem value="__new__" id={`${action.id}-new`} />
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor={`${action.id}-new`} className="text-sm cursor-pointer">
                          Créer un nouveau client : <span className="font-medium">{action.payload?.new_client_data?.name || "?"}</span>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>

                  <div className="flex gap-1.5 justify-end">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleReject(action.id)} disabled={!!loadingActionId}>
                      {loadingActionId === action.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ignorer"}
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleAction(action)} disabled={!!loadingActionId || !selected}>
                      {loadingActionId === action.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmer"}
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={action.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{config.label}</p>
                  {action.payload?.name && <p className="text-xs text-muted-foreground truncate">{action.payload.name}</p>}
                  {action.payload?.client_name && action.action_type === "enrich_client" && (
                    <p className="text-xs text-emerald-600 truncate">🔗 {action.payload.client_name}</p>
                  )}
                  {action.payload?.title && <p className="text-xs text-muted-foreground truncate">{action.payload.title}</p>}
                  {action.payload?.objet && <p className="text-xs text-muted-foreground truncate">{action.payload.objet}</p>}
                  {action.action_type === "enrich_client" && action.payload?.enrichments && renderEnrichmentDetails(action.payload.enrichments)}
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
                    {loadingActionId === action.id ? <Loader2 className="h-3 w-3 animate-spin" /> : action.action_type === "plan_visite" ? "Planifier" : action.action_type === "attach_arrete" ? "Intégrer & Programmer" : ["attach_voirie_plan", "attach_pv_roc"].includes(action.action_type) ? "Intégrer" : action.action_type === "enrich_client" ? "Enrichir" : "Valider"}
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
