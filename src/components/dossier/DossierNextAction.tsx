import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck, FileText, CalendarDays, Cog, Receipt, CreditCard,
  ArrowRight, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateDevisDialog } from "@/components/forms/CreateDevisDialog";
import { CreateVisiteDialog } from "@/components/forms/CreateVisiteDialog";
import { CreateFactureDialog } from "@/components/forms/CreateFactureDialog";
import { ScheduleChantierDialog } from "@/components/devis/ScheduleChantierDialog";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  dossier: any;
  devis: any[];
  factures: any[];
  visites: any[];
  operationsCount: number;
}

export const DossierNextAction: React.FC<Props> = ({ dossier, devis, factures, visites, operationsCount }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const client = dossier.clients as any;
  const stage = dossier.stage;

  // Determine the next logical action based on workflow
  const hasVisite = visites.length > 0;
  const hasDevis = devis.length > 0;
  const hasAcceptedDevis = devis.some((d: any) => d.status === "accepte");
  const acceptedDevis = devis.find((d: any) => d.status === "accepte");
  const hasOperations = operationsCount > 0;
  const hasFacture = factures.length > 0;
  const allFacturesPaid = factures.length > 0 && factures.every((f: any) => f.status === "payee");

  type ActionConfig = {
    label: string;
    description: string;
    icon: React.ElementType;
    color: string;
    action: React.ReactNode;
  };

  const actions: ActionConfig[] = [];

  // Stage-based suggestions
  if (stage === "prospect" && !hasVisite) {
    actions.push({
      label: "Planifier une visite technique",
      description: "Première étape : réaliser une visite sur site pour évaluer le chantier.",
      icon: ClipboardCheck,
      color: "text-warning",
      action: (
        <CreateVisiteDialog
          preselectedClientId={client?.id}
          preselectedCompanyId={dossier.company_id}
          preselectedDossierId={dossier.id}
          trigger={
            <Button size="sm" className="gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" /> Planifier visite
            </Button>
          }
        />
      ),
    });
  }

  if ((stage === "prospect" || stage === "devis") && !hasDevis) {
    actions.push({
      label: "Créer un devis",
      description: "Établir un devis pour ce dossier.",
      icon: FileText,
      color: "text-info",
      action: (
        <CreateDevisDialog
          preselectedClientId={client?.id}
          preselectedCompanyId={dossier.company_id}
          preselectedDossierId={dossier.id}
          trigger={
            <Button size="sm" variant="outline" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Créer devis
            </Button>
          }
        />
      ),
    });
  }

  if (hasDevis && !hasAcceptedDevis && devis.some((d: any) => d.status === "envoye")) {
    actions.push({
      label: "Attente de validation client",
      description: "Un ou plusieurs devis ont été envoyés, en attente de la réponse du client.",
      icon: FileText,
      color: "text-warning",
      action: (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/devis/${devis.find((d: any) => d.status === "envoye")?.id}`)}>
          <FileText className="h-3.5 w-3.5" /> Voir le devis
        </Button>
      ),
    });
  }

  if (hasAcceptedDevis && !hasOperations && (stage === "accepte" || stage === "devis")) {
    actions.push({
      label: "Programmer le chantier",
      description: "Devis accepté ! Planifiez le chantier et créez le bon de travail.",
      icon: CalendarDays,
      color: "text-primary",
      action: acceptedDevis ? (
        <Button size="sm" className="gap-1.5" onClick={() => setScheduleOpen(true)}>
          <CalendarDays className="h-3.5 w-3.5" /> Programmer
        </Button>
      ) : null,
    });
  }

  if (hasOperations && (stage === "planifie" || stage === "en_cours") && !hasFacture) {
    actions.push({
      label: "Créer la facture",
      description: "Le chantier est en cours ou terminé. Créez la facture.",
      icon: Receipt,
      color: "text-success",
      action: (
        <CreateFactureDialog
          preselectedClientId={client?.id}
          preselectedCompanyId={dossier.company_id}
          preselectedDossierId={dossier.id}
          trigger={
            <Button size="sm" className="gap-1.5">
              <Receipt className="h-3.5 w-3.5" /> Facturer
            </Button>
          }
        />
      ),
    });
  }

  if (hasFacture && !allFacturesPaid && (stage === "facture" || stage === "termine")) {
    const unpaidFacture = factures.find((f: any) => f.status !== "payee");
    actions.push({
      label: "Suivre les règlements",
      description: "Une ou plusieurs factures sont en attente de paiement.",
      icon: CreditCard,
      color: "text-warning",
      action: unpaidFacture ? (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/finance/${unpaidFacture.id}`)}>
          <CreditCard className="h-3.5 w-3.5" /> Voir facture
        </Button>
      ) : null,
    });
  }

  if (allFacturesPaid) {
    return (
      <div className={`rounded-xl border border-success/30 bg-success/5 flex items-center gap-3 ${isMobile ? "p-3" : "p-4"}`}>
        <Sparkles className="h-5 w-5 text-success shrink-0" />
        <div className="flex-1">
          <p className={`font-medium text-success ${isMobile ? "text-xs" : "text-sm"}`}>Dossier terminé et réglé ✓</p>
          <p className="text-[11px] text-muted-foreground">Toutes les factures ont été payées.</p>
        </div>
      </div>
    );
  }

  if (actions.length === 0) return null;

  const primary = actions[0];
  const PrimaryIcon = primary.icon;

  return (
    <div className={`rounded-xl border-2 border-primary/20 bg-primary/5 ${isMobile ? "p-3 space-y-2" : "p-4 space-y-3"}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className={`font-semibold ${isMobile ? "text-xs" : "text-sm"}`}>Prochaine étape</span>
      </div>

      <div className="flex items-center gap-3">
        <div className={`rounded-lg bg-card border flex items-center justify-center shrink-0 ${isMobile ? "h-9 w-9" : "h-10 w-10"}`}>
          <PrimaryIcon className={`h-4 w-4 ${primary.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-medium ${isMobile ? "text-xs" : "text-sm"}`}>{primary.label}</p>
          <p className="text-[11px] text-muted-foreground">{primary.description}</p>
        </div>
        {primary.action}
      </div>

      {/* Secondary actions */}
      {actions.length > 1 && (
        <div className="flex gap-2 flex-wrap pt-1 border-t border-primary/10">
          <span className="text-[10px] text-muted-foreground self-center">Aussi :</span>
          {actions.slice(1).map((a, i) => (
            <React.Fragment key={i}>{a.action}</React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
