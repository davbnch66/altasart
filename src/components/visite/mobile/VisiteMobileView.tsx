import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Save, Loader2, Download, Phone, MapPin, Calendar,
  CheckCircle2, Camera, Package, StickyNote, ShieldAlert, Wrench, Home, FileText, Pencil
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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
import { PhotoAnnotationEditor } from "../PhotoAnnotationEditor";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [finishConfirm, setFinishConfirm] = useState(false);
  const [annotatingPhoto, setAnnotatingPhoto] = useState<{ src: string; photoId: string; storagePath: string; pieceId: string } | null>(null);

  const client = visite.clients as any;
  const dossier = visite.dossiers as any;

  // Counts for badges
  const { data: photosData = [] } = useQuery({
    queryKey: ["visite-photos-full", visite.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("visite_photos")
        .select("id, storage_path, piece_id, file_name, caption")
        .eq("visite_id", visite.id)
        .order("created_at", { ascending: false });
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

  const { data: contraintes = [] } = useQuery({
    queryKey: ["visite-contraintes-count", visite.id],
    queryFn: async () => {
      const { data } = await supabase.from("visite_contraintes").select("id").eq("visite_id", visite.id);
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

  const handleFinishVisite = async () => {
    updateField("status", "realisee");
    const ok = await handleSave();
    setFinishConfirm(false);
    if (ok) {
      toast.success("Visite terminée ✓", {
        action: { label: "Générer PDF", onClick: handleExportPdf },
      });
    }
  };

  // Get photo public URLs
  const getPhotoUrl = (storagePath: string) => {
    const { data } = supabase.storage.from("visite-photos").getPublicUrl(storagePath);
    return data?.publicUrl || "";
  };

  const actionTiles = [
    { key: "photo", icon: Camera, label: "Photos", badge: photosData.length, bgClass: "bg-blue-50 dark:bg-blue-500/10", iconClass: "text-blue-600" },
    { key: "notes", icon: StickyNote, label: "Notes", badge: null, preview: (editData.notes || editData.comment || "").slice(0, 50), bgClass: "bg-amber-50 dark:bg-amber-500/10", iconClass: "text-amber-600" },
    { key: "materiel", icon: Package, label: "Matériel", badge: materiel.length, bgClass: "bg-orange-50 dark:bg-orange-500/10", iconClass: "text-orange-600" },
    { key: "piece", icon: Home, label: "Pièces/Zones", badge: pieces.length, bgClass: "bg-green-50 dark:bg-green-500/10", iconClass: "text-green-600" },
    { key: "contraintes", icon: ShieldAlert, label: "Contraintes", badge: contraintes.length, bgClass: "bg-red-50 dark:bg-red-500/10", iconClass: "text-red-600" },
    { key: "moyens", icon: Wrench, label: "Moyens RH", badge: rh.length + vehicules.length, bgClass: "bg-purple-50 dark:bg-purple-500/10", iconClass: "text-purple-600" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* ── Header sticky ── */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button onClick={() => navigate(-1)} className="p-1.5 -ml-1 rounded-xl shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-lg font-bold truncate">{client?.name || visite.title}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleStatusChange}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusColors[editData.status] || ""}`}
            >
              {statusLabels[editData.status] || editData.status}
            </button>
            {(client?.mobile || client?.phone) && (
              <a
                href={`tel:${client.mobile || client.phone}`}
                className="h-9 w-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            {isDirty && (
              <Button size="icon" onClick={handleSave} disabled={saving} className="h-9 w-9 rounded-xl">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 space-y-3 pt-3">
        {/* ── Compact client info ── */}
        {client && (
          <div className="flex items-center gap-3 rounded-2xl bg-card border p-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{client.name}</p>
              <p className="text-xs text-muted-foreground truncate">{[client.address, client.city].filter(Boolean).join(", ") || "—"}</p>
            </div>
            {(client.address || client.city) && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent([client.address, client.postal_code, client.city].filter(Boolean).join(" "))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MapPin className="h-4 w-4 text-primary" />
              </a>
            )}
            {visite.scheduled_date && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(visite.scheduled_date), "dd/MM", { locale: fr })}
              </div>
            )}
          </div>
        )}

        {/* ── Smart alerts ── */}
        <VisiteSmartAlerts visiteId={visite.id} companyId={visite.company_id} />

        {/* ── Action tiles grid ── */}
        <div className="grid grid-cols-2 gap-3">
          {actionTiles.map((tile) => (
            <button
              key={tile.key}
              onClick={() => setActiveSheet(tile.key)}
              className={`relative rounded-2xl border border-border/50 p-4 text-left active:scale-[0.97] transition-transform ${tile.bgClass}`}
              style={{ minHeight: 90 }}
            >
              <div className="flex items-start justify-between">
                <tile.icon className={`h-6 w-6 ${tile.iconClass}`} />
                {tile.badge != null && tile.badge > 0 && (
                  <span className="bg-foreground/10 text-foreground text-[11px] font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5">
                    {tile.badge}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-foreground mt-2">{tile.label}</p>
              {tile.preview && (
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{tile.preview}</p>
              )}
            </button>
          ))}
        </div>

        {/* ── Photo strip preview ── */}
        {photosData.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Photos récentes
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3">
              {photosData.slice(0, 12).map((photo: any) => {
                const url = getPhotoUrl(photo.storage_path);
                return (
                  <button
                    key={photo.id}
                    onClick={() => setAnnotatingPhoto({ src: url, photoId: photo.id, storagePath: photo.storage_path, pieceId: photo.piece_id })}
                    className="relative rounded-xl overflow-hidden shrink-0 active:scale-95 transition-transform border border-border/50"
                    style={{ width: 80, height: 80 }}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute bottom-0 right-0 bg-black/50 rounded-tl-lg p-1">
                      <Pencil className="h-3 w-3 text-white" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary / PDF button */}
        <button
          onClick={() => setActiveSheet("summary")}
          className="w-full rounded-2xl bg-card border p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="bg-primary/10 rounded-xl p-2.5">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">Synthèse & Rapport</p>
            <p className="text-xs text-muted-foreground">Générer le PDF de visite</p>
          </div>
        </button>

        {/* Dossier link */}
        {dossier && (
          <button
            onClick={() => navigate(`/dossiers/${dossier.id}`)}
            className="text-xs text-primary font-medium px-1"
          >
            📁 {dossier.code || dossier.title} →
          </button>
        )}
      </div>

      {/* ── Finish button — only when planifiee ── */}
      {editData.status === "planifiee" && (
        <div className="fixed bottom-20 left-4 right-4 z-30">
          <Button
            onClick={() => setFinishConfirm(true)}
            className="w-full h-[52px] rounded-2xl text-base gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
          >
            <CheckCircle2 className="h-5 w-5" />
            Terminer la visite
          </Button>
        </div>
      )}

      {/* Finish confirmation dialog */}
      <AlertDialog open={finishConfirm} onOpenChange={setFinishConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminer cette visite ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le statut passera à "Réalisée" et les données seront sauvegardées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinishVisite} className="bg-emerald-600 hover:bg-emerald-700">
              Terminer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Annotation editor ── */}
      {annotatingPhoto && (
        <PhotoAnnotationEditor
          open={true}
          onClose={() => setAnnotatingPhoto(null)}
          imageSrc={annotatingPhoto.src}
          onSave={async (blob) => {
            try {
              const file = new File([blob], `annotated-${Date.now()}.jpg`, { type: "image/jpeg" });
              const path = `${visite.id}/${annotatingPhoto.pieceId}/${file.name}`;
              const { error } = await supabase.storage.from("visite-photos").upload(path, file);
              if (error) throw error;
              await supabase.from("visite_photos").insert({
                visite_id: visite.id,
                piece_id: annotatingPhoto.pieceId,
                company_id: visite.company_id,
                storage_path: path,
                file_name: file.name,
              });
              toast.success("Photo annotée sauvegardée ✓");
              queryClient.invalidateQueries({ queryKey: ["visite-photos-full", visite.id] });
              queryClient.invalidateQueries({ queryKey: ["visite-photos", visite.id] });
              setAnnotatingPhoto(null);
            } catch (err: any) {
              toast.error(err.message || "Erreur sauvegarde");
            }
          }}
        />
      )}

      {/* ── Sheets ── */}
      <MobilePhotoSheet
        open={activeSheet === "photo"}
        onClose={() => setActiveSheet(null)}
        visiteId={visite.id}
        companyId={visite.company_id}
        mode="camera"
        onAnnotate={(src, photoId, storagePath, pieceId) => {
          setActiveSheet(null);
          setAnnotatingPhoto({ src, photoId, storagePath, pieceId });
        }}
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
