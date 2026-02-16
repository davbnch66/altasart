import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FolderOpen,
  Pencil,
  FileText,
  DollarSign,
  Eye,
  MapPin,
  Calendar,
  User,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { EditDossierDialog } from "@/components/forms/EditDossierDialog";

const stageLabels: Record<string, string> = {
  prospect: "Prospect",
  devis: "Devis envoyé",
  accepte: "Accepté",
  planifie: "Planifié",
  en_cours: "En cours",
  termine: "Terminé",
  facture: "Facturé",
  paye: "Payé",
};

const stageStyles: Record<string, string> = {
  prospect: "bg-muted text-muted-foreground",
  devis: "bg-info/10 text-info",
  accepte: "bg-success/10 text-success",
  planifie: "bg-primary/10 text-primary",
  en_cours: "bg-warning/10 text-warning",
  termine: "bg-success/10 text-success",
  facture: "bg-info/10 text-info",
  paye: "bg-success/10 text-success",
};

const formatAmount = (amount: number | null) => {
  if (!amount) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: fr });
  } catch {
    return "—";
  }
};

const statusLabelsDevis: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
};

const statusLabelsFacture: Record<string, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
  en_retard: "En retard",
  annulee: "Annulée",
};

const statusLabelsVisite: Record<string, string> = {
  planifiee: "Planifiée",
  realisee: "Réalisée",
  annulee: "Annulée",
};

const DossierDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const { data: dossier, isLoading } = useQuery({
    queryKey: ["dossier-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossiers")
        .select("*, clients(id, name, email, phone, address, city, postal_code, contact_name), companies(short_name, name, color)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: devis = [] } = useQuery({
    queryKey: ["dossier-devis", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devis")
        .select("id, code, objet, amount, status, created_at")
        .eq("dossier_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: factures = [] } = useQuery({
    queryKey: ["dossier-factures", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factures")
        .select("id, code, amount, paid_amount, status, created_at, due_date")
        .eq("dossier_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: visites = [] } = useQuery({
    queryKey: ["dossier-visites", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visites")
        .select("id, title, status, scheduled_date, completed_date")
        .eq("dossier_id", id!)
        .order("created_at", { ascending: false });
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

  if (!dossier) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto text-center py-20">
        <p className="text-muted-foreground">Dossier introuvable</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/dossiers")}>
          Retour
        </Button>
      </div>
    );
  }

  const client = dossier.clients as any;
  const company = dossier.companies as any;
  const totalFacture = factures.reduce((s, f) => s + Number(f.amount), 0);
  const totalRegle = factures.reduce((s, f) => s + Number(f.paid_amount), 0);

  // Pipeline progress
  const stageKeys = Object.keys(stageLabels);
  const currentStageIdx = stageKeys.indexOf(dossier.stage);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dossiers")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <FolderOpen className="h-6 w-6 text-muted-foreground" />
            {dossier.code || `Dossier`}
          </h1>
          <p className="text-muted-foreground mt-0.5">{dossier.title}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4 mr-2" /> Modifier
        </Button>
      </motion.div>

      {/* Pipeline progress bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="rounded-xl border bg-card p-4">
        <div className="flex gap-1">
          {stageKeys.map((key, i) => (
            <div
              key={key}
              className={`flex-1 h-2 rounded-full transition-colors ${
                i <= currentStageIdx ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-muted-foreground">Prospect</span>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${stageStyles[dossier.stage]}`}>
            {stageLabels[dossier.stage]}
          </span>
          <span className="text-xs text-muted-foreground">Payé</span>
        </div>
      </motion.div>

      {/* Summary cards */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Montant dossier</p>
          <p className="text-lg font-bold mt-1">{formatAmount(dossier.amount)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Facturé</p>
          <p className="text-lg font-bold mt-1">{formatAmount(totalFacture)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Réglé</p>
          <p className="text-lg font-bold mt-1 text-success">{formatAmount(totalRegle)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Solde</p>
          <p className={`text-lg font-bold mt-1 ${totalFacture - totalRegle > 0 ? "text-destructive" : "text-success"}`}>
            {formatAmount(totalFacture - totalRegle)}
          </p>
        </div>
      </motion.div>

      {/* Info cards */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <User className="h-4 w-4" /> Client
          </h3>
          <p
            className="font-medium cursor-pointer hover:text-primary transition-colors"
            onClick={() => client?.id && navigate(`/clients/${client.id}`)}
          >
            {client?.name || "—"}
          </p>
          {client?.contact_name && <p className="text-sm text-muted-foreground">{client.contact_name}</p>}
          {client?.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
          {client?.phone && <p className="text-sm text-muted-foreground">{client.phone}</p>}
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Informations
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Société</p>
              <p className="font-medium">{company?.name || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Début</p>
              <p className="font-medium">{formatDate(dossier.start_date)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fin</p>
              <p className="font-medium">{formatDate(dossier.end_date)}</p>
            </div>
            {dossier.address && (
              <div>
                <p className="text-muted-foreground">Adresse</p>
                <p className="font-medium">{dossier.address}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs: Devis, Factures, Visites */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <Tabs defaultValue="devis">
          <TabsList>
            <TabsTrigger value="devis" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Devis ({devis.length})
            </TabsTrigger>
            <TabsTrigger value="factures" className="gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Factures ({factures.length})
            </TabsTrigger>
            <TabsTrigger value="visites" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Visites ({visites.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="devis">
            <div className="rounded-xl border bg-card divide-y">
              {devis.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucun devis lié</div>
              ) : (
                devis.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/devis/${d.id}`)}
                  >
                    <FileText className="h-4 w-4 text-info" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.code} — {d.objet}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(d.created_at)}</p>
                    </div>
                    <span className="text-xs rounded-full px-2 py-0.5 bg-muted font-medium">
                      {statusLabelsDevis[d.status] || d.status}
                    </span>
                    <span className="text-sm font-semibold">{formatAmount(d.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="factures">
            <div className="rounded-xl border bg-card divide-y">
              {factures.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune facture liée</div>
              ) : (
                factures.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors"
                  >
                    <DollarSign className="h-4 w-4 text-success" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.code || "Facture"}</p>
                      <p className="text-xs text-muted-foreground">Échéance: {formatDate(f.due_date)}</p>
                    </div>
                    <span className="text-xs rounded-full px-2 py-0.5 bg-muted font-medium">
                      {statusLabelsFacture[f.status] || f.status}
                    </span>
                    <span className="text-sm font-semibold">{formatAmount(f.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="visites">
            <div className="rounded-xl border bg-card divide-y">
              {visites.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune visite liée</div>
              ) : (
                visites.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors"
                  >
                    <Eye className="h-4 w-4 text-warning" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.scheduled_date ? formatDate(v.scheduled_date) : "Non planifiée"}
                      </p>
                    </div>
                    <span className="text-xs rounded-full px-2 py-0.5 bg-muted font-medium">
                      {statusLabelsVisite[v.status] || v.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Notes / Description */}
      {(dossier.description || dossier.notes) && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          {dossier.description && (
            <>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Description</h3>
              <p className="text-sm whitespace-pre-wrap">{dossier.description}</p>
            </>
          )}
          {dossier.notes && (
            <>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Notes</h3>
              <p className="text-sm whitespace-pre-wrap">{dossier.notes}</p>
            </>
          )}
        </div>
      )}

      {editing && (
        <EditDossierDialog dossier={dossier} open={editing} onOpenChange={(v) => !v && setEditing(false)} />
      )}
    </div>
  );
};

export default DossierDetail;
