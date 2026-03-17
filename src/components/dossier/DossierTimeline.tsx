import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  FolderOpen, ClipboardCheck, FileText, Send, CheckCircle, CalendarDays,
  Cog, HardHat, Receipt, CreditCard, ChevronRight, Eye, Download, Loader2,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { GenericPdfPreviewDialog } from "@/components/shared/GenericPdfPreviewDialog";
import { generateDevisPdf } from "@/lib/generateDevisPdf";
import { generateFacturePdf } from "@/lib/generateFacturePdf";
import { generateBTReportPdf } from "@/lib/generateBTReportPdf";
import { toast } from "sonner";

interface TimelineEvent {
  date: string;
  label: string;
  detail?: string;
  icon: React.ElementType;
  color: string;
  link?: string;
  completed: boolean;
  docType?: "devis" | "facture" | "bt";
  docId?: string;
  docCode?: string;
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
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<{ open: boolean; blobUrl: string | null; dataUri: string | null; fileName: string }>({
    open: false, blobUrl: null, dataUri: null, fileName: "",
  });

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

  const handlePreview = async (docType: string, docId: string, docCode?: string) => {
    const key = `${docType}-${docId}`;
    setLoadingDoc(key);
    try {
      if (docType === "devis") {
        const result = await generateDevisPdf(docId, false, true);
        if (result && typeof result === "object" && "blobUrl" in result) {
          setPreviewState({ open: true, blobUrl: result.blobUrl, dataUri: result.dataUri, fileName: result.fileName });
        }
      } else if (docType === "facture") {
        const result = await generateFacturePdf(docId, true);
        if (result && typeof result === "object" && "blobUrl" in result) {
          setPreviewState({ open: true, blobUrl: result.blobUrl, dataUri: result.dataUri, fileName: result.fileName });
        }
      } else if (docType === "bt") {
        const result = await generateBTReportPdf(docId);
        if (result) {
          const byteChars = atob(result.pdfBase64);
          const byteArray = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
          const blob = new Blob([byteArray], { type: "application/pdf" });
          const blobUrl = URL.createObjectURL(blob);
          const dataUri = `data:application/pdf;base64,${result.pdfBase64}`;
          setPreviewState({ open: true, blobUrl, dataUri, fileName: result.fileName });
        }
      }
    } catch (e) {
      toast.error("Erreur lors de la génération du document");
    } finally {
      setLoadingDoc(null);
    }
  };

  const handleDownload = async (docType: string, docId: string) => {
    const key = `dl-${docType}-${docId}`;
    setLoadingDoc(key);
    try {
      if (docType === "devis") {
        await generateDevisPdf(docId);
      } else if (docType === "facture") {
        await generateFacturePdf(docId);
      } else if (docType === "bt") {
        const result = await generateBTReportPdf(docId);
        if (result) {
          const byteChars = atob(result.pdfBase64);
          const byteArray = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
          const blob = new Blob([byteArray], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = result.fileName;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (e) {
      toast.error("Erreur lors du téléchargement");
    } finally {
      setLoadingDoc(null);
    }
  };

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
      docType: "devis",
      docId: d.id,
      docCode: d.code,
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
        docType: "devis",
        docId: d.id,
        docCode: d.code,
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
        docType: "devis",
        docId: d.id,
        docCode: d.code,
      });
    }
  });

  // 4. Planification
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
      docType: "bt",
      docId: op.id,
      docCode: op.lv_bt_number || `BT-${op.operation_number}`,
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
      docType: "facture",
      docId: f.id,
      docCode: f.code,
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
    <>
      <div className="relative space-y-0">
        {/* Vertical line */}
        <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-border" />

        {events.map((ev, i) => {
          const Icon = ev.icon;
          const hasDoc = !!ev.docType && !!ev.docId;
          const previewLoading = loadingDoc === `${ev.docType}-${ev.docId}`;
          const downloadLoading = loadingDoc === `dl-${ev.docType}-${ev.docId}`;

          return (
            <div
              key={i}
              className="relative flex items-start gap-3 py-3 group"
            >
              {/* Dot */}
              <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${ev.completed ? "bg-card border-current" : "bg-muted border-border"} ${ev.color}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>

              {/* Content */}
              <div
                className={`flex-1 min-w-0 pt-0.5 ${ev.link ? "cursor-pointer" : ""}`}
                onClick={() => ev.link && navigate(ev.link)}
              >
                <div className="flex items-center gap-2">
                  <p className={`font-medium ${isMobile ? "text-xs" : "text-sm"}`}>{ev.label}</p>
                  {ev.link && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                {ev.detail && (
                  <p className="text-[11px] text-muted-foreground truncate">{ev.detail}</p>
                )}
              </div>

              {/* Doc actions */}
              {hasDoc && (
                <div className={`flex items-center gap-1 shrink-0 ${isMobile ? "" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Aperçu"
                    disabled={previewLoading}
                    onClick={(e) => { e.stopPropagation(); handlePreview(ev.docType!, ev.docId!); }}
                  >
                    {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Télécharger"
                    disabled={downloadLoading}
                    onClick={(e) => { e.stopPropagation(); handleDownload(ev.docType!, ev.docId!); }}
                  >
                    {downloadLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              )}

              {/* Date */}
              <span className="text-[10px] text-muted-foreground shrink-0 pt-1">
                {formatDate(ev.date)}
              </span>
            </div>
          );
        })}
      </div>

      <GenericPdfPreviewDialog
        open={previewState.open}
        onClose={() => setPreviewState({ open: false, blobUrl: null, dataUri: null, fileName: "" })}
        blobUrl={previewState.blobUrl}
        dataUri={previewState.dataUri}
        fileName={previewState.fileName}
      />
    </>
  );
};
