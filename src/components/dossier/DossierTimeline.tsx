import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  FolderOpen, ClipboardCheck, FileText, Send, CheckCircle, CalendarDays,
  Cog, HardHat, Receipt, CreditCard, ChevronRight,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface TimelineEvent {
  date: string;
  label: string;
  detail?: string;
  icon: React.ElementType;
  color: string;
  link?: string;
  completed: boolean;
}

const formatDate = (d: string | null) => {
  if (!d) return "";
  try { return format(new Date(d), "dd MMM yyyy", { locale: fr }); } catch { return ""; }
};

interface Props {
  dossierId: string;
  dossier: any;
  devis: any[];
  factures: any[];
  visites: any[];
}

export const DossierTimeline: React.FC<Props> = ({ dossierId, dossier, devis, factures, visites }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const { data: operations = [] } = useQuery({
    queryKey: ["dossier-operations-timeline", dossierId],
    queryFn: async () => {
      const { data } = await supabase
        .from("operations")
        .select("id, operation_number, type, loading_date, delivery_date, completed, lv_bt_number")
        .eq("dossier_id", dossierId)
        .order("sort_order");
      return data || [];
    },
  });

  const { data: reglements = [] } = useQuery({
    queryKey: ["dossier-reglements-timeline", dossierId],
    queryFn: async () => {
      const factureIds = factures.map(f => f.id);
      if (factureIds.length === 0) return [];
      const { data } = await supabase
        .from("reglements")
        .select("id, amount, payment_date, code")
        .in("facture_id", factureIds)
        .order("payment_date");
      return data || [];
    },
    enabled: factures.length > 0,
  });

  // Build timeline events
  const events: TimelineEvent[] = [];

  // 1. Dossier creation
  events.push({
    date: dossier.created_at,
    label: "Dossier créé",
    detail: dossier.code || dossier.title,
    icon: FolderOpen,
    color: "text-primary",
    completed: true,
  });

  // 2. Visites
  visites.forEach((v: any) => {
    events.push({
      date: v.scheduled_date || v.completed_date || dossier.created_at,
      label: v.status === "realisee" ? "Visite réalisée" : "Visite planifiée",
      detail: v.title,
      icon: ClipboardCheck,
      color: v.status === "realisee" ? "text-success" : "text-warning",
      link: `/visites/${v.id}`,
      completed: v.status === "realisee",
    });
  });

  // 3. Devis
  devis.forEach((d: any) => {
    events.push({
      date: d.created_at,
      label: "Devis créé",
      detail: `${d.code || "—"} — ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(d.amount)}`,
      icon: FileText,
      color: "text-info",
      link: `/devis/${d.id}`,
      completed: true,
    });
    if (d.status === "envoye" || d.status === "accepte" || d.status === "refuse") {
      events.push({
        date: d.sent_at || d.created_at,
        label: "Devis envoyé",
        detail: d.code,
        icon: Send,
        color: "text-info",
        link: `/devis/${d.id}`,
        completed: true,
      });
    }
    if (d.status === "accepte") {
      events.push({
        date: d.accepted_at || d.created_at,
        label: "Devis accepté",
        detail: d.code,
        icon: CheckCircle,
        color: "text-success",
        link: `/devis/${d.id}`,
        completed: true,
      });
    }
  });

  // 4. Planification (if stage >= planifie)
  const stageOrder = ["prospect", "devis", "accepte", "planifie", "en_cours", "termine", "facture", "paye"];
  if (stageOrder.indexOf(dossier.stage) >= stageOrder.indexOf("planifie")) {
    events.push({
      date: dossier.confirmation_date || dossier.start_date || dossier.updated_at,
      label: "Chantier planifié",
      detail: dossier.start_date ? `Début : ${formatDate(dossier.start_date)}` : undefined,
      icon: CalendarDays,
      color: "text-primary",
      completed: true,
    });
  }

  // 5. Operations (BT)
  operations.forEach((op: any) => {
    events.push({
      date: op.loading_date || op.delivery_date || dossier.updated_at,
      label: op.completed ? "BT terminé" : "Bon de travail",
      detail: op.lv_bt_number || `BT n°${op.operation_number}`,
      icon: op.completed ? HardHat : Cog,
      color: op.completed ? "text-success" : "text-warning",
      completed: op.completed,
    });
  });

  // 6. Factures
  factures.forEach((f: any) => {
    events.push({
      date: f.created_at,
      label: f.status === "payee" ? "Facture réglée" : f.sent_at ? "Facture envoyée" : "Facture créée",
      detail: `${f.code || "—"} — ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(f.amount)}`,
      icon: Receipt,
      color: f.status === "payee" ? "text-success" : "text-info",
      link: `/finance/${f.id}`,
      completed: f.status === "payee",
    });
  });

  // 7. Reglements
  reglements.forEach((r: any) => {
    events.push({
      date: r.payment_date,
      label: "Règlement reçu",
      detail: `${r.code || "—"} — ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(r.amount)}`,
      icon: CreditCard,
      color: "text-success",
      completed: true,
    });
  });

  // Sort by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (events.length === 0) {
    return <p className="text-center py-8 text-sm text-muted-foreground">Aucun événement</p>;
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-border" />

      {events.map((ev, i) => {
        const Icon = ev.icon;
        return (
          <div
            key={i}
            className={`relative flex items-start gap-3 py-3 ${ev.link ? "cursor-pointer hover:bg-muted/50 rounded-lg -mx-2 px-2" : ""}`}
            onClick={() => ev.link && navigate(ev.link)}
          >
            {/* Dot */}
            <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${ev.completed ? "bg-card border-current" : "bg-muted border-border"} ${ev.color}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2">
                <p className={`font-medium ${isMobile ? "text-xs" : "text-sm"}`}>{ev.label}</p>
                {ev.link && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              {ev.detail && (
                <p className="text-[11px] text-muted-foreground truncate">{ev.detail}</p>
              )}
            </div>

            {/* Date */}
            <span className="text-[10px] text-muted-foreground shrink-0 pt-1">
              {formatDate(ev.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
