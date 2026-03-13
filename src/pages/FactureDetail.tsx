import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, Download, DollarSign, CreditCard, CheckCircle2, AlertTriangle, FileText, FolderOpen, ChevronRight, Trash2, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { EditFactureDialog } from "@/components/forms/EditFactureDialog";
import { CreateReglementDialog } from "@/components/forms/CreateReglementDialog";
import { EditReglementDialog } from "@/components/forms/EditReglementDialog";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { generateFacturePdf } from "@/lib/generateFacturePdf";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { DetailBreadcrumb } from "@/components/DetailBreadcrumb";
import { DownloadWordButton } from "@/components/shared/DownloadWordButton";
import { GenericPdfPreviewDialog } from "@/components/shared/GenericPdfPreviewDialog";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);

const statusLabels: Record<string, string> = {
  brouillon: "Brouillon", envoyee: "Envoyée", payee: "Payée", en_retard: "En retard", annulee: "Annulée",
};
const statusClass: Record<string, string> = {
  payee: "bg-success/10 text-success", envoyee: "bg-info/10 text-info",
  en_retard: "bg-destructive/10 text-destructive", brouillon: "bg-muted text-muted-foreground", annulee: "bg-muted text-muted-foreground",
};

const FactureDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const fromClient = (location.state as any)?.fromClient === true;
  const fromDossier = (location.state as any)?.fromDossier as string | undefined;
  const [editOpen, setEditOpen] = useState(false);
  const [editReglement, setEditReglement] = useState<any>(null);
  const [deleteReglement, setDeleteReglement] = useState<any>(null);
  const [pdfPreview, setPdfPreview] = useState<{ blobUrl: string; fileName: string; dataUri: string } | null>(null);

  const { data: facture, isLoading } = useQuery({
    queryKey: ["facture-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("factures").select("*, clients(id, name, code), dossiers(id, code, title), devis(id, code, objet)").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: reglements, isLoading: regLoading } = useQuery({
    queryKey: ["facture-reglements", id],
    queryFn: async () => {
      const { data } = await supabase.from("reglements").select("*").eq("facture_id", id!).order("payment_date", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const deleteReglementMutation = useMutation({
    mutationFn: async (regId: string) => {
      const { error } = await supabase.from("reglements").delete().eq("id", regId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Règlement supprimé");
      queryClient.invalidateQueries({ queryKey: ["facture-reglements", id] });
      queryClient.invalidateQueries({ queryKey: ["facture-detail", id] });
      setDeleteReglement(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  if (isLoading) {
    return (
      <div className={`max-w-5xl mx-auto space-y-4 ${isMobile ? "p-3" : "p-6 lg:p-8 space-y-6"}`}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!facture) {
    return (
      <div className={`max-w-5xl mx-auto text-center ${isMobile ? "p-3" : "p-6 lg:p-8"}`}>
        <p className="text-muted-foreground">Facture introuvable</p>
        <Button variant="outline" onClick={() => navigate("/finance")} className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" /> Retour</Button>
      </div>
    );
  }

  const paidAmount = Number(facture.paid_amount);
  const solde = Number(facture.amount) - paidAmount;
  const client = facture.clients as any;
  const dossier = facture.dossiers as any;
  const devis = facture.devis as any;

  return (
    <div className={`max-w-5xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      {/* Breadcrumb */}
      <DetailBreadcrumb items={[
        ...(fromClient && client?.id ? [{ label: client.name, path: `/clients/${client.id}` }] : []),
        ...(fromDossier && dossier ? [{ label: dossier.code || dossier.title, path: `/dossiers/${fromDossier}`, state: { fromClient } }] : !fromClient ? [{ label: "Factures", path: "/finance" }] : []),
        { label: `Facture ${facture.code || ""}` },
      ]} />

      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className={isMobile ? "h-8 w-8" : ""}>
          <ArrowLeft className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className={`font-bold tracking-tight truncate ${isMobile ? "text-base" : "text-2xl"}`}>
              Facture {facture.code || ""}
            </h1>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${statusClass[facture.status] || "bg-muted text-muted-foreground"}`}>
              {statusLabels[facture.status] || facture.status}
            </span>
          </div>
          {client && (
            <p className={`text-muted-foreground mt-0.5 cursor-pointer hover:text-primary transition-colors truncate ${isMobile ? "text-xs" : ""}`} onClick={() => navigate(`/clients/${client.id}`)}>
              {client.name} {client.code ? `(${client.code})` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size={isMobile ? "icon" : "sm"} onClick={() => generateFacturePdf(facture.id).catch(() => toast.error("Erreur PDF"))}>
            <Download className="h-4 w-4" />
            {!isMobile && <span className="ml-1">PDF</span>}
          </Button>
          <DownloadWordButton
            companyId={facture.company_id}
            documentType="facture"
            documentId={facture.id}
            fileName={`Facture_${facture.code || facture.id.slice(0, 8)}.docx`}
            size={isMobile ? "sm" : "sm"}
          />
          <Button variant="outline" size={isMobile ? "icon" : "sm"} onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            {!isMobile && <span className="ml-1">Modifier</span>}
          </Button>
        </div>
      </div>

      {/* Financial summary */}
      <div className={`grid gap-3 ${isMobile ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3 gap-4"}`}>
        <div className={`rounded-xl border bg-card space-y-0.5 ${isMobile ? "p-3" : "p-5 space-y-1"}`}>
          <div className={`flex items-center gap-1.5 text-muted-foreground ${isMobile ? "text-[10px]" : "text-sm"}`}>
            <DollarSign className="h-3.5 w-3.5" /> Montant
          </div>
          <p className={`font-bold ${isMobile ? "text-sm" : "text-2xl"}`}>{fmt(Number(facture.amount))}</p>
        </div>
        <div className={`rounded-xl border bg-card space-y-0.5 ${isMobile ? "p-3" : "p-5 space-y-1"}`}>
          <div className={`flex items-center gap-1.5 text-muted-foreground ${isMobile ? "text-[10px]" : "text-sm"}`}>
            <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Réglé
          </div>
          <p className={`font-bold text-success ${isMobile ? "text-sm" : "text-2xl"}`}>{fmt(paidAmount)}</p>
        </div>
        <div className={`rounded-xl border bg-card space-y-0.5 ${isMobile ? "p-3" : "p-5 space-y-1"}`}>
          <div className={`flex items-center gap-1.5 text-muted-foreground ${isMobile ? "text-[10px]" : "text-sm"}`}>
            {solde > 0 ? <AlertTriangle className="h-3.5 w-3.5 text-warning" /> : <CheckCircle2 className="h-3.5 w-3.5 text-success" />} Solde
          </div>
          <p className={`font-bold ${solde > 0 ? "text-warning" : "text-success"} ${isMobile ? "text-sm" : "text-2xl"}`}>{fmt(solde)}</p>
        </div>
      </div>

      {/* Info grid */}
      <div className={`rounded-xl border bg-card grid gap-3 ${isMobile ? "p-3 grid-cols-2 text-xs" : "p-5 grid-cols-2 md:grid-cols-4 gap-4 text-sm"}`}>
        <div>
          <span className="text-muted-foreground">Création</span>
          <p className="font-medium">{format(new Date(facture.created_at), isMobile ? "d MMM yy" : "d MMMM yyyy", { locale: fr })}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Échéance</span>
          <p className="font-medium">{facture.due_date ? format(new Date(facture.due_date), isMobile ? "d MMM yy" : "d MMMM yyyy", { locale: fr }) : "—"}</p>
        </div>
        {dossier && (
          <div>
            <span className="text-muted-foreground">Dossier</span>
            <p className="font-medium cursor-pointer hover:text-primary transition-colors flex items-center gap-1 truncate" onClick={() => navigate(`/dossiers/${dossier.id}`)}>
              <FolderOpen className="h-3 w-3 shrink-0" /> <span className="truncate">{dossier.code || dossier.title}</span>
            </p>
          </div>
        )}
        {devis && (
          <div>
            <span className="text-muted-foreground">Devis</span>
            <p className="font-medium cursor-pointer hover:text-primary transition-colors flex items-center gap-1 truncate" onClick={() => navigate(`/devis/${devis.id}`)}>
              <FileText className="h-3 w-3 shrink-0" /> <span className="truncate">{devis.code || devis.objet}</span>
            </p>
          </div>
        )}
        {facture.notes && (
          <div className="col-span-2 md:col-span-4">
            <span className="text-muted-foreground">Notes</span>
            <p className="font-medium">{facture.notes}</p>
          </div>
        )}
      </div>

      {/* Reglements */}
      <div className="rounded-xl border bg-card">
        <div className={`border-b flex items-center justify-between ${isMobile ? "px-3 py-2" : "p-5"}`}>
          <h2 className={`font-semibold flex items-center gap-2 ${isMobile ? "text-sm" : ""}`}>
            <CreditCard className="h-4 w-4" /> Règlements ({reglements?.length ?? 0})
          </h2>
          <CreateReglementDialog preselectedFactureId={facture.id} preselectedCompanyId={facture.company_id} />
        </div>
        {regLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : reglements && reglements.length > 0 ? (
          isMobile ? (
            <div className="divide-y">
              {reglements.map((reg) => (
                <div key={reg.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-xs">{fmt(Number(reg.amount))}</p>
                      {reg.code && <span className="text-[10px] font-mono text-muted-foreground">{reg.code}</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(reg.payment_date), "d MMM yyyy", { locale: fr })} {reg.bank ? `· ${reg.bank}` : ""}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditReglement(reg)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><Pencil className="h-3 w-3" /></button>
                    <button onClick={() => setDeleteReglement(reg)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Code</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Montant</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Date paiement</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Banque</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Référence</th>
                  <th className="text-right font-medium text-muted-foreground px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reglements.map((reg) => (
                  <tr key={reg.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs">{reg.code || "—"}</td>
                    <td className="px-5 py-3 font-semibold">{fmt(Number(reg.amount))}</td>
                    <td className="px-5 py-3 text-muted-foreground">{format(new Date(reg.payment_date), "d MMM yyyy", { locale: fr })}</td>
                    <td className="px-5 py-3">{reg.bank || "—"}</td>
                    <td className="px-5 py-3">{reg.reference || "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditReglement(reg)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setDeleteReglement(reg)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <div className={`text-center text-sm text-muted-foreground ${isMobile ? "px-3 py-6" : "px-5 py-8"}`}>Aucun règlement enregistré</div>
        )}
      </div>

      {/* Dialogs */}
      {editOpen && <EditFactureDialog facture={facture} open={editOpen} onOpenChange={setEditOpen} />}
      {editReglement && <EditReglementDialog reglement={editReglement} open={!!editReglement} onOpenChange={(o) => !o && setEditReglement(null)} />}
      {deleteReglement && (
        <DeleteConfirmDialog
          open={!!deleteReglement}
          onOpenChange={(o) => !o && setDeleteReglement(null)}
          title="Supprimer le règlement"
          description={`Supprimer le règlement ${deleteReglement.code || ""} de ${fmt(Number(deleteReglement.amount))} ?`}
          onConfirm={() => deleteReglementMutation.mutate(deleteReglement.id)}
          isPending={deleteReglementMutation.isPending}
        />
      )}
    </div>
  );
};

export default FactureDetail;
