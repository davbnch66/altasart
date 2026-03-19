import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Loader2, Download, MoreVertical, Phone, MapPin, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MobileQuickActions } from "./MobileQuickActions";
import { MobilePhotoSheet } from "./MobilePhotoSheet";
import { MobileMaterielSheet } from "./MobileMaterielSheet";
import { MobilePieceSheet } from "./MobilePieceSheet";
import { MobileContraintesSheet } from "./MobileContraintesSheet";
import { MobileMoyensSheet } from "./MobileMoyensSheet";
import { MobileNotesSheet } from "./MobileNotesSheet";
import { MobileVisiteSummary } from "./MobileVisiteSummary";
import { VisiteSmartAlerts } from "../VisiteSmartAlerts";
import { generateVisitePdf } from "@/lib/generateVisitePdf";
import { PdfPreviewDialog } from "../PdfPreviewDialog";

interface Props {
  visite: any;
  editData: any;
  updateField: (field: string, value: any) => void;
  handleSave: () => Promise<boolean>;
  saving: boolean;
  isDirty: boolean;
}

const statusLabels: Record<string, string> = {
  planifiee: "Planifiée",
  realisee: "Réalisée",
  annulee: "Annulée",
};

const statusColors: Record<string, string> = {
  planifiee: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  realisee: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  annulee: "bg-red-500/15 text-red-600 border-red-500/30",
};

export const VisiteMobileView = ({ visite, editData, updateField, handleSave, saving, isDirty }: Props) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<any>(null);

  const client = visite.clients as any;
  const dossier = visite.dossiers as any;

  // Counts for badges
  const { data: photos = [] } = useQuery({
    queryKey: ["visite-photos", visite.id],
    queryFn: async () => {
      const { data } = await supabase.from("visite_photos").select("id").eq("visite_id", visite.id);
      return data || [];
    },
  });

  const { data: pieces = [] } = useQuery({
    queryKey: ["visite-pieces", visite.id],
    queryFn: async () => {
      const { data } = await supabase.from("visite_pieces").select("id").eq("visite_id", visite.id);
      return data || [];
    },
  });

  const { data: materiel = [] } = useQuery({
    queryKey: ["visite-materiel", visite.id],
    queryFn: async () => {
      const { data } = await supabase.from("visite_materiel").select("id").eq("visite_id", visite.id);
      return data || [];
    },
  });

  const { data: rh = [] } = useQuery({
    queryKey: ["visite-rh", visite.id],
    queryFn: async () => {
      const { data } = await supabase.from("visite_ressources_humaines").select("id").eq("visite_id", visite.id);
      return data || [];
    },
  });

  const { data: vehicules = [] } = useQuery({
    queryKey: ["visite-vehicules", visite.id],
    queryFn: async () => {
      const { data } = await supabase.from("visite_vehicules").select("id").eq("visite_id", visite.id);
      return data || [];
    },
  });

  const handleAction = (action: string) => {
    setActiveSheet(action);
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const result = await generateVisitePdf(visite.id, { photosPerRow: 1 });
      setPdfPreview(result);
    } catch (e: any) {
      toast.error(e.message || "Erreur export PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleStatusChange = () => {
    const statuses = ["planifiee", "realisee", "annulee"];
    const currentIdx = statuses.indexOf(editData.status);
    const next = statuses[(currentIdx + 1) % statuses.length];
    updateField("status", next);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            {isDirty && (
              <Button size="sm" onClick={handleSave} disabled={saving} className="h-9 rounded-xl gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Sauver
              </Button>
            )}
            <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={handleExportPdf} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4 pt-4">
        {/* ── Visit card ── */}
        <div className="rounded-2xl bg-card border p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold tracking-tight leading-tight">
                {visite.code ? `#${visite.code}` : visite.title}
              </h1>
              {visite.code && <p className="text-sm text-muted-foreground mt-0.5">{visite.title}</p>}
            </div>
            <button
              onClick={handleStatusChange}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${statusColors[editData.status] || ""}`}
            >
              {statusLabels[editData.status] || editData.status}
            </button>
          </div>

          {/* Client */}
          {client && (
            <div
              className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 -mx-1"
              onClick={() => navigate(`/clients/${client.id}`)}
            >
              <div className="bg-primary/10 rounded-lg p-2">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{client.name}</p>
                <p className="text-xs text-muted-foreground truncate">{client.address || client.city || "—"}</p>
              </div>
              {client.mobile || client.phone ? (
                <a
                  href={`tel:${client.mobile || client.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-primary rounded-full p-2 text-primary-foreground shrink-0"
                >
                  <Phone className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          )}

          {/* Date */}
          {visite.scheduled_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {format(new Date(visite.scheduled_date), "EEEE d MMMM yyyy", { locale: fr })}
                {visite.scheduled_time ? ` à ${visite.scheduled_time.slice(0, 5)}` : ""}
              </span>
            </div>
          )}

          {/* Dossier */}
          {dossier && (
            <button
              onClick={() => navigate(`/dossiers/${dossier.id}`)}
              className="text-xs text-primary font-medium"
            >
              📁 {dossier.code || dossier.title} →
            </button>
          )}
        </div>

        {/* ── Smart alerts ── */}
        <VisiteSmartAlerts visiteId={visite.id} companyId={visite.company_id} />

        {/* ── Quick actions ── */}
        <MobileQuickActions
          onAction={handleAction}
          counts={{
            photos: photos.length,
            pieces: pieces.length,
            materiel: materiel.length,
            rh: rh.length,
            vehicules: vehicules.length,
          }}
        />

        {/* ── Photo gallery preview ── */}
        {photos.length > 0 && (
          <div className="rounded-2xl bg-card border p-4">
            <p className="text-sm font-medium mb-2">📸 {photos.length} photo(s)</p>
            <p className="text-xs text-muted-foreground">Ouvrez l'onglet Photos pour les voir et les annoter.</p>
          </div>
        )}
      </div>

      {/* ── Sheets ── */}
      <MobilePhotoSheet
        open={activeSheet === "photo"}
        onClose={() => setActiveSheet(null)}
        visiteId={visite.id}
        companyId={visite.company_id}
        mode="camera"
      />
      <MobilePhotoSheet
        open={activeSheet === "gallery"}
        onClose={() => setActiveSheet(null)}
        visiteId={visite.id}
        companyId={visite.company_id}
        mode="gallery"
      />
      <MobileMaterielSheet
        open={activeSheet === "materiel"}
        onClose={() => setActiveSheet(null)}
        visiteId={visite.id}
        companyId={visite.company_id}
      />
      <MobilePieceSheet
        open={activeSheet === "piece"}
        onClose={() => setActiveSheet(null)}
        visiteId={visite.id}
        companyId={visite.company_id}
      />
      <MobileContraintesSheet
        open={activeSheet === "contraintes"}
        onClose={() => setActiveSheet(null)}
        visiteId={visite.id}
        companyId={visite.company_id}
      />
      <MobileMoyensSheet
        open={activeSheet === "moyens"}
        onClose={() => setActiveSheet(null)}
        visiteId={visite.id}
        companyId={visite.company_id}
      />
      <MobileNotesSheet
        open={activeSheet === "notes"}
        onClose={() => setActiveSheet(null)}
        notes={editData.notes || ""}
        instructions={editData.instructions || ""}
        comment={editData.comment || ""}
        onSave={(data) => {
          updateField("notes", data.notes);
          updateField("instructions", data.instructions);
          updateField("comment", data.comment);
        }}
        saving={saving}
      />
      <MobileVisiteSummary
        open={activeSheet === "summary"}
        onClose={() => setActiveSheet(null)}
        visiteId={visite.id}
        companyId={visite.company_id}
        visite={visite}
        onExportPdf={handleExportPdf}
        exporting={exporting}
      />

      <PdfPreviewDialog
        open={!!pdfPreview}
        onClose={() => setPdfPreview(null)}
        blobUrl={pdfPreview?.blobUrl || null}
        dataUri={pdfPreview?.dataUri || null}
        fileName={pdfPreview?.fileName || ""}
        clientEmail={client?.email || ""}
        clientName={client?.name || ""}
        visiteCode={visite.code || ""}
        visiteTitle={visite.title || ""}
        visiteId={visite.id}
        companyId={visite.company_id}
      />
    </div>
  );
};
