import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, Download, DollarSign, CreditCard, CheckCircle2, AlertTriangle, FileText, FolderOpen } from "lucide-react";
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
import { Trash2 } from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);

const statusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
  en_retard: "En retard",
  annulee: "Annulée",
};

const statusClass: Record<string, string> = {
  payee: "bg-success/10 text-success",
  envoyee: "bg-info/10 text-info",
  en_retard: "bg-destructive/10 text-destructive",
  brouillon: "bg-muted text-muted-foreground",
  annulee: "bg-muted text-muted-foreground",
};

const FactureDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editReglement, setEditReglement] = useState<any>(null);
  const [deleteReglement, setDeleteReglement] = useState<any>(null);

  const { data: facture, isLoading } = useQuery({
    queryKey: ["facture-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factures")
        .select("*, clients(id, name, code), dossiers(id, code, title), devis(id, code, objet)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: reglements, isLoading: regLoading } = useQuery({
    queryKey: ["facture-reglements", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reglements")
        .select("*")
        .eq("facture_id", id!)
        .order("payment_date", { ascending: false });
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
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!facture) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto text-center">
        <p className="text-muted-foreground">Facture introuvable</p>
        <Button variant="outline" onClick={() => navigate("/finance")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  const solde = Number(facture.amount) - Number(facture.paid_amount);
  const totalReglements = (reglements ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const client = facture.clients as any;
  const dossier = facture.dossiers as any;
  const devis = facture.devis as any;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/finance")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Facture {facture.code || ""}
            </h1>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass[facture.status] || "bg-muted text-muted-foreground"}`}>
              {statusLabels[facture.status] || facture.status}
            </span>
          </div>
          {client && (
            <p
              className="text-muted-foreground mt-1 cursor-pointer hover:text-primary transition-colors"
              onClick={() => navigate(`/clients/${client.id}`)}
            >
              {client.name} {client.code ? `(${client.code})` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateFacturePdf(facture.id).catch(() => toast.error("Erreur PDF"))}
          >
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Modifier
          </Button>
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-5 space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" /> Montant HT
          </div>
          <p className="text-2xl font-bold">{fmt(Number(facture.amount))}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" /> Réglé
          </div>
          <p className="text-2xl font-bold text-success">{fmt(totalReglements)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {solde > 0 ? <AlertTriangle className="h-4 w-4 text-warning" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
            Solde restant
          </div>
          <p className={`text-2xl font-bold ${solde > 0 ? "text-warning" : "text-success"}`}>{fmt(solde)}</p>
        </div>
      </div>

      {/* Info grid */}
      <div className="rounded-xl border bg-card p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Date de création</span>
          <p className="font-medium">{format(new Date(facture.created_at), "d MMMM yyyy", { locale: fr })}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Échéance</span>
          <p className="font-medium">{facture.due_date ? format(new Date(facture.due_date), "d MMMM yyyy", { locale: fr }) : "—"}</p>
        </div>
        {dossier && (
          <div>
            <span className="text-muted-foreground">Dossier</span>
            <p
              className="font-medium cursor-pointer hover:text-primary transition-colors flex items-center gap-1"
              onClick={() => navigate(`/dossiers/${dossier.id}`)}
            >
              <FolderOpen className="h-3.5 w-3.5" /> {dossier.code || dossier.title}
            </p>
          </div>
        )}
        {devis && (
          <div>
            <span className="text-muted-foreground">Devis</span>
            <p
              className="font-medium cursor-pointer hover:text-primary transition-colors flex items-center gap-1"
              onClick={() => navigate(`/devis/${devis.id}`)}
            >
              <FileText className="h-3.5 w-3.5" /> {devis.code || devis.objet}
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
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Règlements ({reglements?.length ?? 0})
          </h2>
          <CreateReglementDialog preselectedFactureId={facture.id} preselectedCompanyId={facture.company_id} />
        </div>
        {regLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : reglements && reglements.length > 0 ? (
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
                      <button onClick={() => setEditReglement(reg)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteReglement(reg)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucun règlement enregistré</div>
        )}
      </div>

      {/* Dialogs */}
      {editOpen && (
        <EditFactureDialog facture={facture} open={editOpen} onOpenChange={setEditOpen} />
      )}
      {editReglement && (
        <EditReglementDialog reglement={editReglement} open={!!editReglement} onOpenChange={(o) => !o && setEditReglement(null)} />
      )}
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
