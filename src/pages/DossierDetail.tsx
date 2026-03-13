import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  ArrowLeft, FolderOpen, Pencil, FileText, DollarSign, Eye, User, Building2, ChevronRight, Cog, BarChart3,
  CreditCard, AlertTriangle, Receipt, PiggyBank, Trash2, ShieldAlert, Send, CheckCircle, XCircle, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { EditDossierDialog } from "@/components/forms/EditDossierDialog";
import { CreateDevisDialog } from "@/components/forms/CreateDevisDialog";
import { CreateVisiteDialog } from "@/components/forms/CreateVisiteDialog";
import { CreateFactureDialog } from "@/components/forms/CreateFactureDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { DossierOperationsTab } from "@/components/dossier/DossierOperationsTab";
import { DossierSituationTab } from "@/components/dossier/DossierSituationTab";
import { DossierReglementsTab } from "@/components/dossier/DossierReglementsTab";
import { DossierAvariesTab } from "@/components/dossier/DossierAvariesTab";
import { DetailBreadcrumb, BreadcrumbItem } from "@/components/DetailBreadcrumb";
import { DevisStatusSelect } from "@/components/DevisStatusSelect";
import { DossierCostsTab } from "@/components/dossier/DossierCostsTab";
import { DossierTimeline } from "@/components/dossier/DossierTimeline";
import { DossierNextAction } from "@/components/dossier/DossierNextAction";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";

const stageLabels: Record<string, string> = {
  prospect: "Prospect", devis: "Devis envoyé", accepte: "Accepté", planifie: "Planifié",
  en_cours: "En cours", termine: "Terminé", facture: "Facturé", paye: "Payé",
};
const stageStyles: Record<string, string> = {
  prospect: "bg-muted text-muted-foreground", devis: "bg-info/10 text-info",
  accepte: "bg-success/10 text-success", planifie: "bg-primary/10 text-primary",
  en_cours: "bg-warning/10 text-warning", termine: "bg-success/10 text-success",
  facture: "bg-info/10 text-info", paye: "bg-success/10 text-success",
};
const formatAmount = (amount: number | null) => {
  if (!amount) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
};
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr), "dd/MM/yyyy", { locale: fr }); } catch { return "—"; }
};
const statusLabelsDevis: Record<string, string> = { brouillon: "Brouillon", envoye: "Envoyé", accepte: "Accepté", refuse: "Refusé", expire: "Expiré" };
const statusLabelsFacture: Record<string, string> = { brouillon: "Brouillon", envoyee: "Envoyée", payee: "Payée", en_retard: "En retard", annulee: "Annulée" };
const statusLabelsVisite: Record<string, string> = { planifiee: "Planifiée", realisee: "Réalisée", annulee: "Annulée" };

const DossierDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const operationFromUrl = searchParams.get("operation");
  const [activeTab, setActiveTab] = useState(operationFromUrl ? "operations" : "timeline");
  
  // React to URL changes (e.g. clicking a notification while already on the page)
  useEffect(() => {
    if (operationFromUrl) {
      setActiveTab("operations");
    }
  }, [operationFromUrl]);

  const [editing, setEditing] = useState(false);
  const [deletingFactureId, setDeletingFactureId] = useState<string | null>(null);
  const [deletingDevisId, setDeletingDevisId] = useState<string | null>(null);
  const [deletingVisiteId, setDeletingVisiteId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const fromClient = (location.state as any)?.fromClient === true;
  const fromPipeline = (location.state as any)?.fromPipeline === true;

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
      const { data, error } = await supabase.from("devis").select("id, code, objet, amount, status, created_at").eq("dossier_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: factures = [] } = useQuery({
    queryKey: ["dossier-factures", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("factures").select("id, code, amount, paid_amount, status, created_at, due_date").eq("dossier_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: operations = [] } = useQuery({
    queryKey: ["dossier-operations-count", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("operations").select("id").eq("dossier_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: reglements = [] } = useQuery({
    queryKey: ["dossier-reglements-count", id],
    queryFn: async () => {
      const factureIds = factures.map(f => f.id);
      if (factureIds.length === 0) return [];
      const { data, error } = await supabase.from("reglements").select("id").in("facture_id", factureIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && factures.length > 0,
  });

  const { data: avaries = [] } = useQuery({
    queryKey: ["dossier-avaries-count", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("avaries").select("id").eq("dossier_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: visites = [] } = useQuery({
    queryKey: ["dossier-visites", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("visites").select("id, title, status, scheduled_date, completed_date").eq("dossier_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: voirieVisites = [] } = useQuery({
    queryKey: ["dossier-voirie", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visites")
        .select("id, code, voirie_address, voirie_status, voirie_type, voirie_notes, voirie_requested_at, voirie_obtained_at, needs_voirie, voirie_plan_storage_path, voirie_pv_roc_storage_path, voirie_arrete_storage_path, voirie_arrete_date" as any)
        .eq("dossier_id", id!)
        .eq("needs_voirie", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!id,
  });

  const deleteFactureMutation = useMutation({
    mutationFn: async (factureId: string) => {
      // Delete related reglements first (FK constraint)
      const { error: regError } = await supabase.from("reglements").delete().eq("facture_id", factureId);
      if (regError) throw regError;
      // Unlink operations referencing this facture
      await supabase.from("operations").update({ facture_id: null }).eq("facture_id", factureId);
      const { error } = await supabase.from("factures").delete().eq("id", factureId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Facture supprimée");
      queryClient.invalidateQueries({ queryKey: ["dossier-factures"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-reglements-count"] });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      setDeletingFactureId(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const deleteDevisMutation = useMutation({
    mutationFn: async (devisId: string) => {
      // Delete related lines, relances, signatures first
      await supabase.from("devis_lines").delete().eq("devis_id", devisId);
      await supabase.from("devis_relances").delete().eq("devis_id", devisId);
      await supabase.from("devis_signatures").delete().eq("devis_id", devisId);
      const { error } = await supabase.from("devis").delete().eq("id", devisId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devis supprimé");
      queryClient.invalidateQueries({ queryKey: ["dossier-devis"] });
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      setDeletingDevisId(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const deleteVisiteMutation = useMutation({
    mutationFn: async (visiteId: string) => {
      const { error } = await supabase.from("visites").delete().eq("id", visiteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visite supprimée");
      queryClient.invalidateQueries({ queryKey: ["dossier-visites"] });
      queryClient.invalidateQueries({ queryKey: ["visites"] });
      setDeletingVisiteId(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  if (isLoading) {
    return (
      <div className={`max-w-5xl mx-auto space-y-4 ${isMobile ? "p-3" : "p-6 lg:p-8 space-y-6"}`}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className={`max-w-5xl mx-auto text-center py-20 ${isMobile ? "p-3" : "p-6 lg:p-8"}`}>
        <p className="text-muted-foreground">Dossier introuvable</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/dossiers")}>Retour</Button>
      </div>
    );
  }

  const client = dossier.clients as any;
  const company = dossier.companies as any;
  const totalFacture = factures.reduce((s, f) => s + Number(f.amount), 0);
  const totalRegle = factures.reduce((s, f) => s + Number(f.paid_amount), 0);
  const stageKeys = Object.keys(stageLabels);
  const currentStageIdx = stageKeys.indexOf(dossier.stage);

  const tabItems = [
    { key: "timeline", label: "Chronologie", count: null, icon: BarChart3 },
    { key: "visites", label: "Visites", count: visites.length, icon: Eye },
    { key: "devis", label: "Devis", count: devis.length, icon: FileText },
    { key: "operations", label: "Opérations", count: operations.length, icon: Cog },
    { key: "factures", label: "Factures", count: factures.length, icon: Receipt },
    { key: "reglements", label: "Règlements", count: reglements.length, icon: CreditCard },
    { key: "costs", label: "Rentabilité", count: null, icon: PiggyBank },
    { key: "avaries", label: "Avaries", count: avaries.length, icon: AlertTriangle },
    { key: "situation", label: "Situation", count: null, icon: BarChart3 },
  ];

  return (
    <div className={`max-w-5xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      {/* Breadcrumb */}
      <DetailBreadcrumb items={[
        ...(fromPipeline ? [{ label: "Pipeline", path: "/pipeline" }] : fromClient && client?.id ? [{ label: client.name, path: `/clients/${client.id}` }] : [{ label: "Dossiers", path: "/dossiers" }]),
        { label: dossier.code || "Dossier" },
      ]} />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className={isMobile ? "h-8 w-8" : ""}>
          <ArrowLeft className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className={`font-bold tracking-tight flex items-center gap-2 ${isMobile ? "text-base" : "text-2xl gap-3"}`}>
            {!isMobile && <FolderOpen className="h-6 w-6 text-muted-foreground" />}
            <span className="break-words">{dossier.code || "Dossier"}</span>
          </h1>
          <p className={`text-muted-foreground mt-0.5 break-words ${isMobile ? "text-xs" : ""}`}>{dossier.title}</p>
        </div>
        <Button variant="outline" size={isMobile ? "icon" : "sm"} onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" />
          {!isMobile && <span className="ml-1">Modifier</span>}
        </Button>
      </motion.div>

      {/* Pipeline */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"}`}>
        <div className="flex gap-0.5">
          {stageKeys.map((key, i) => (
            <div key={key} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= currentStageIdx ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-muted-foreground">Prospect</span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${stageStyles[dossier.stage]}`}>
            {stageLabels[dossier.stage]}
          </span>
          <span className="text-[10px] text-muted-foreground">Payé</span>
        </div>
      </motion.div>

      {/* Summary cards */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4 gap-4"}`}>
        {[
          { label: "Montant", value: formatAmount(dossier.amount) },
          { label: "Facturé", value: formatAmount(totalFacture) },
          { label: "Réglé", value: formatAmount(totalRegle), className: "text-success" },
          { label: "Solde", value: formatAmount(totalFacture - totalRegle), className: totalFacture - totalRegle > 0 ? "text-destructive" : "text-success" },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-4"}`}>
            <p className="text-[11px] text-muted-foreground">{card.label}</p>
            <p className={`font-bold mt-0.5 ${isMobile ? "text-sm" : "text-lg"} ${card.className || ""}`}>{card.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Next Action Banner */}
      <DossierNextAction
        dossier={dossier}
        devis={devis}
        factures={factures}
        visites={visites}
        operationsCount={operations.length}
      />

      {/* Info cards */}
      <div className={`grid gap-3 ${isMobile ? "" : "lg:grid-cols-2 gap-4"}`}>
        <div className={`rounded-xl border bg-card space-y-2 ${isMobile ? "p-3" : "p-5 space-y-3"}`}>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Client
          </h3>
          <p className={`font-medium cursor-pointer hover:text-primary transition-colors ${isMobile ? "text-sm" : ""}`} onClick={() => client?.id && navigate(`/clients/${client.id}`)}>
            {client?.name || "—"}
          </p>
          {client?.contact_name && <p className="text-xs text-muted-foreground">{client.contact_name}</p>}
          {client?.email && <p className="text-xs text-muted-foreground truncate">{client.email}</p>}
          {client?.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
        </div>
        <div className={`rounded-xl border bg-card space-y-2 ${isMobile ? "p-3" : "p-5 space-y-3"}`}>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Informations
          </h3>
          <div className={`grid grid-cols-2 gap-2 ${isMobile ? "text-xs" : "text-sm"}`}>
            <div><p className="text-muted-foreground">Société</p><p className="font-medium">{company?.name || "—"}</p></div>
            <div><p className="text-muted-foreground">Début</p><p className="font-medium">{formatDate(dossier.start_date)}</p></div>
            <div><p className="text-muted-foreground">Fin</p><p className="font-medium">{formatDate(dossier.end_date)}</p></div>
            {dossier.address && <div><p className="text-muted-foreground">Adresse</p><p className="font-medium break-words">{dossier.address}</p></div>}
          </div>
        </div>
      </div>

      {/* Voirie section */}
      {voirieVisites.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <ShieldAlert className="h-3.5 w-3.5" /> Démarches voirie
          </h3>
          <div className="space-y-2">
            {voirieVisites.map((v: any) => {
              const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
                a_faire: { label: "À faire", icon: AlertCircle, className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30" },
                demandee: { label: "Demandée", icon: Send, className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
                obtenue: { label: "Obtenue", icon: CheckCircle, className: "bg-green-500/15 text-green-700 border-green-500/30" },
                refusee: { label: "Refusée", icon: XCircle, className: "bg-red-500/15 text-red-700 border-red-500/30" },
                non_requise: { label: "Non requise", icon: AlertCircle, className: "bg-muted text-muted-foreground" },
              };
              const s = statusConfig[v.voirie_status] || statusConfig.a_faire;
              const StatusIcon = s.icon;
              const typeLabels: Record<string, string> = {
                arrete_stationnement: "Arrêté de stationnement",
                plan_voirie: "Plan voirie (1/200ème)",
                emprise: "Emprise voirie",
                autorisation_grue: "Autorisation grue",
                autre: "Autre",
              };
              return (
                <div key={v.id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors ${isMobile ? "text-xs" : "text-sm"}`} onClick={() => navigate(`/visites/${v.id}`)}>
                  <StatusIcon className={`h-4 w-4 shrink-0 ${s.className.includes("text-yellow") ? "text-yellow-600" : s.className.includes("text-blue") ? "text-blue-600" : s.className.includes("text-green") ? "text-green-600" : s.className.includes("text-red") ? "text-red-600" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{v.code || `Visite ${v.id.slice(0, 8)}`}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {v.voirie_address || "—"}
                      {v.voirie_type && ` · ${typeLabels[v.voirie_type] || v.voirie_type}`}
                    </p>
                    {/* Document indicators */}
                    <div className="flex gap-2 mt-1">
                      {v.voirie_plan_storage_path && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">📐 Plan</span>}
                      {v.voirie_pv_roc_storage_path && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">📋 PV ROC</span>}
                      {v.voirie_arrete_storage_path && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">✅ Arrêté</span>}
                      {v.voirie_arrete_date && <span className="text-[10px] text-muted-foreground">📅 {formatDate(v.voirie_arrete_date)}</span>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${s.className}`}>
                    {s.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <Tabs defaultValue={operationFromUrl ? "operations" : "timeline"}>
          {isMobile ? (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-3 px-3 pb-1">
              {tabItems.map((tab) => (
                <TabsList key={tab.key} className="bg-transparent p-0">
                  <TabsTrigger value={tab.key} className="rounded-full px-3 py-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    {tab.label}{tab.count !== null ? ` (${tab.count})` : ""}
                  </TabsTrigger>
                </TabsList>
              ))}
            </div>
          ) : (
            <TabsList>
              {tabItems.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
                  <tab.icon className="h-3.5 w-3.5" /> {tab.label}{tab.count !== null ? ` (${tab.count})` : ""}
                </TabsTrigger>
              ))}
            </TabsList>
          )}

          <TabsContent value="timeline">
            <div className="rounded-xl border bg-card p-4">
              <DossierTimeline
                dossierId={id!}
                dossier={dossier}
                devis={devis}
                factures={factures}
                visites={visites}
              />
            </div>
          </TabsContent>

          <TabsContent value="visites">
            <div className="space-y-3">
              <div className="flex justify-end">
                <CreateVisiteDialog preselectedClientId={client?.id} preselectedCompanyId={dossier.company_id} preselectedDossierId={id} />
              </div>
              <div className="rounded-xl border bg-card divide-y">
              {visites.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">Aucune visite liée</div>
              ) : visites.map((v) => (
                <div key={v.id} className={`flex items-center gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${isMobile ? "px-3 py-2.5" : "px-5 py-3.5"}`} onClick={() => navigate(`/visites/${v.id}`, { state: { fromDossier: id, fromClient: (location.state as any)?.fromClient } })}>
                  <Eye className="h-4 w-4 text-warning shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium break-words ${isMobile ? "text-xs" : "text-sm"}`}>{v.title}</p>
                    <p className="text-[11px] text-muted-foreground">{v.scheduled_date ? formatDate(v.scheduled_date) : "Non planifiée"}</p>
                  </div>
                  <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted font-medium shrink-0">{statusLabelsVisite[v.status] || v.status}</span>
                  <Button variant={deletingVisiteId === v.id ? "destructive" : "ghost"} size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); if (deletingVisiteId === v.id) { deleteVisiteMutation.mutate(v.id); } else { setDeletingVisiteId(v.id); } }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  {isMobile && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>
              ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="devis">
            <div className="space-y-3">
              <div className="flex justify-end">
                <CreateDevisDialog preselectedClientId={client?.id} preselectedCompanyId={dossier.company_id} preselectedDossierId={id} />
              </div>
              <div className="rounded-xl border bg-card divide-y">
              {devis.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">Aucun devis lié</div>
              ) : devis.map((d) => (
                <div key={d.id} className={`flex items-center gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${isMobile ? "px-3 py-2.5" : "px-5 py-3.5"}`} onClick={() => navigate(`/devis/${d.id}`, { state: { fromDossier: id, fromClient: (location.state as any)?.fromClient } })}>
                  <FileText className="h-4 w-4 text-info shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium break-words ${isMobile ? "text-xs" : "text-sm"}`}>{d.code} — {d.objet}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(d.created_at)}</p>
                  </div>
                  <DevisStatusSelect devisId={d.id} currentStatus={d.status} size="xs" />
                  {!isMobile && <span className="text-sm font-semibold shrink-0">{formatAmount(d.amount)}</span>}
                  <Button variant={deletingDevisId === d.id ? "destructive" : "ghost"} size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); if (deletingDevisId === d.id) { deleteDevisMutation.mutate(d.id); } else { setDeletingDevisId(d.id); } }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  {isMobile && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>
              ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="operations">
            <DossierOperationsTab dossierId={id!} companyId={dossier.company_id} initialOperationId={operationFromUrl} />
          </TabsContent>

          <TabsContent value="factures">
            <div className="space-y-3">
              <div className="flex justify-end">
                <CreateFactureDialog preselectedClientId={client?.id} preselectedCompanyId={dossier.company_id} preselectedDossierId={id} />
              </div>
              <div className="rounded-xl border bg-card divide-y">
                {factures.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-muted-foreground">Aucune facture liée</div>
                ) : factures.map((f) => (
                  <div key={f.id} className={`flex items-center gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${isMobile ? "px-3 py-2.5" : "px-5 py-3.5"}`} onClick={() => navigate(`/finance/${f.id}`, { state: { fromDossier: id, fromClient: (location.state as any)?.fromClient } })}>
                    <DollarSign className="h-4 w-4 text-success shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium break-words ${isMobile ? "text-xs" : "text-sm"}`}>{f.code || "Facture"}</p>
                      <p className="text-[11px] text-muted-foreground">Éch.: {formatDate(f.due_date)}</p>
                    </div>
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted font-medium shrink-0">{statusLabelsFacture[f.status] || f.status}</span>
                    {!isMobile && <span className="text-sm font-semibold shrink-0">{formatAmount(f.amount)}</span>}
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); setDeletingFactureId(f.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {isMobile && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reglements">
            <DossierReglementsTab dossierId={id!} />
          </TabsContent>

          <TabsContent value="costs">
            <DossierCostsTab dossierId={id!} companyId={dossier.company_id} dossierAmount={dossier.amount || 0} />
          </TabsContent>

          <TabsContent value="avaries">
            <DossierAvariesTab dossierId={id!} companyId={dossier.company_id} clientId={client?.id || ""} />
          </TabsContent>

          <TabsContent value="situation">
            <DossierSituationTab dossierId={id!} dossierAmount={dossier.amount || 0} dossierCost={(dossier as any).cost || 0} />
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Notes */}
      {(dossier.description || dossier.notes) && (
        <div className={`rounded-xl border bg-card space-y-2 ${isMobile ? "p-3" : "p-5 space-y-3"}`}>
          {dossier.description && (
            <>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Description</h3>
              <p className="text-xs whitespace-pre-wrap">{dossier.description}</p>
            </>
          )}
          {dossier.notes && (
            <>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Notes</h3>
              <p className="text-xs whitespace-pre-wrap">{dossier.notes}</p>
            </>
          )}
        </div>
      )}

      {editing && <EditDossierDialog dossier={dossier} open={editing} onOpenChange={(v) => !v && setEditing(false)} />}

      <DeleteConfirmDialog
        open={!!deletingFactureId}
        onOpenChange={(v) => !v && setDeletingFactureId(null)}
        onConfirm={() => { if (deletingFactureId) deleteFactureMutation.mutate(deletingFactureId); }}
        title="Supprimer la facture"
        description="Voulez-vous vraiment supprimer cette facture ? Les règlements associés seront également supprimés. Cette action est irréversible."
        isPending={deleteFactureMutation.isPending}
      />
    </div>
  );
};

export default DossierDetail;
