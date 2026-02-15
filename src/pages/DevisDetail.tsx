import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DevisLinesManager } from "@/components/DevisLinesManager";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Pencil, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useState } from "react";
import { EditDevisDialog } from "@/components/forms/EditDevisDialog";
import { generateDevisPdf } from "@/lib/generateDevisPdf";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
};

const statusStyles: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-info/10 text-info",
  accepte: "bg-success/10 text-success",
  refuse: "bg-destructive/10 text-destructive",
  expire: "bg-warning/10 text-warning",
};

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr), "dd/MM/yyyy"); } catch { return "—"; }
};

const DevisDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const { data: devis, isLoading } = useQuery({
    queryKey: ["devis-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devis")
        .select("*, clients(name, email, phone, address, city, postal_code), companies(short_name, name, color)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["devis-lines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devis_lines")
        .select("*")
        .eq("devis_id", id!)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!devis) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto text-center py-20">
        <p className="text-muted-foreground">Devis introuvable</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/devis")}>Retour</Button>
      </div>
    );
  }

  const client = devis.clients as any;
  const company = devis.companies as any;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/devis")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
            {devis.code || `Devis ${devis.id.slice(0, 8)}`}
          </h1>
          <p className="text-muted-foreground mt-0.5">{devis.objet}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => generateDevisPdf(devis.id).catch(() => toast.error("Erreur PDF"))}>
            <Download className="h-4 w-4 mr-2" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Modifier
          </Button>
        </div>
      </motion.div>

      {/* Status + montant */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Statut</p>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium mt-2 ${statusStyles[devis.status] || ""}`}>
            {statusLabels[devis.status] || devis.status}
          </span>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Montant</p>
          <p className="text-lg font-bold mt-1">{formatAmount(devis.amount)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Date de création</p>
          <p className="text-sm font-medium mt-1">{formatDate(devis.created_at)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Validité</p>
          <p className="text-sm font-medium mt-1">{formatDate(devis.valid_until)}</p>
        </div>
      </motion.div>

      {/* Client + Société */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Client</h3>
          <p className="font-medium">{client?.name || "—"}</p>
          {client?.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
          {client?.phone && <p className="text-sm text-muted-foreground">{client.phone}</p>}
          {client?.address && <p className="text-sm text-muted-foreground">{client.address}{client.postal_code ? `, ${client.postal_code}` : ""}{client.city ? ` ${client.city}` : ""}</p>}
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Société</h3>
          <p className="font-medium">{company?.name || company?.short_name || "—"}</p>
        </div>
      </div>

      {/* Lignes du devis */}
      <DevisLinesManager devisId={devis.id} lines={lines} totalAmount={devis.amount} />

      {/* Notes */}
      {devis.notes && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</h3>
          <p className="text-sm whitespace-pre-wrap">{devis.notes}</p>
        </div>
      )}

      {editing && (
        <EditDevisDialog devis={devis} open={editing} onOpenChange={(v) => !v && setEditing(false)} />
      )}
    </div>
  );
};

export default DevisDetail;
