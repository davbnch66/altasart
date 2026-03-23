import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  ArrowLeft, FolderOpen, Pencil, FileText, DollarSign, Eye, User, Building2, ChevronRight, Cog, BarChart3,
  CreditCard, AlertTriangle, Receipt, PiggyBank, Trash2, ShieldAlert, Send, CheckCircle, XCircle, AlertCircle, MapPin,
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
import { DetailBreadcrumb } from "@/components/DetailBreadcrumb";
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

  useEffect(() => {
    if (operationFromUrl) setActiveTab("operations");
  }, [operationFromUrl]);

  const [editing, setEditing] = useState(false);
  const [deletingFactureId, setDeletingFactureId] = useState<string | null>(null);
  const [deletingDevisId, setDeletingDevisId] = useState<string | null>(null);
  const [deletingVisiteId, setDeletingVisiteId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const fromClient = (location.state as any)?.fromClient === true;
  const fromPipeline = (location.state as any)?.fromPipeline === true;

  // ── Queries (unchanged) ──
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

  // ── Mutations (unchanged) ──
  const deleteFactureMutation = useMutation({
    mutationFn: async (factureId: string) => {
      const { error: regError } = await supabase.from("reglements").delete().eq("facture_id", factureId);
      if (regError) throw regError;
      await supabase.from("operations").update({ facture_id: null }).eq("facture_id", factureId);
      const { error } = await supabase.from("factures").delete().eq("id", factureId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Facture supprimée");
      queryClient.invalidateQueries({ queryKey: ["dossier-factures"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-operations"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-reglements-count"] });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      setDeletingFactureId(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const deleteDevisMutation = useMutation({
    mutationFn: async (devisId: string) => {
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

  // ── Loading / Not found ──
  if (isLoading) {
    return (
      <div className={`max-w-6xl mx-auto space-y-4 ${isMobile ? "p-3" : "p-6 lg:p-8"}`}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className={`max-w-6xl mx-auto text-center py-20 ${isMobile ? "p-3" : "p-6 lg:p-8"}`}>
        <p className="text-muted-foreground">Dossier introuvable</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/dossiers")}>Retour</Button>
      </div>
    );
  }

  const client = dossier.clients as any;
  const company = dossier.companies as any;
  const totalFacture = factures.reduce((s, f) => s + Number(f.amount), 0);
  const totalRegle = factures.reduce((s, f) => s + Number(f.paid_amount), 0);

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

  const breadcrumbItems = [
    ...(fromPipeline ? [{ label: "Pipeline", path: "/pipeline" }] : fromClient && client?.id ? [{ label: client.name, path: `/clients/${client.id}` }] : [{ label: "Dossiers", path: "/dossiers" }]),
    { label: dossier.code || "Dossier" },
  ];

  // ── Sidebar content (shared between desktop sticky and mobile inline) ──
  const SidebarContent = () => (
    <div className="space-y-4">
      {/* Main card */}
      <div className="card-elevated p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${stageStyles[dossier.stage]}`}>
            {stageLabels[dossier.stage]}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{dossier.code}</span>
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight leading-tight">{dossier.title}</h1>
          {dossier.address && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
              <MapPin className="h-3 w-3 shrink-0" />{dossier.address}
            </p>
          )}
        </div>
        {dossier.amount && (
          <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Montant</p>
            <p className="text-2xl font-black tabular-nums text-primary">{formatAmount(dossier.amount)}</p>
          </div>
        )}
        {client && (
          <div>
            <p className="section-label mb-2">Client</p>
            <button
              onClick={() => navigate(`/clients/${client.id}`)}
              className="w-full flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/50 transition-colors text-left group"
            >
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {client.name?.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{client.name}</p>
                {client.email && <p className="text-xs text-muted-foreground truncate">{client.email}</p>}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-muted-foreground mb-0.5">Créé le</p>
            <p className="font-medium">{formatDate(dossier.created_at)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-muted-foreground mb-0.5">Modifié</p>
            <p className="font-medium">{formatDate(dossier.updated_at)}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Devis", value: devis.length, icon: FileText, color: "text-info", tab: "devis" },
          { label: "Factures", value: factures.length, icon: DollarSign, color: "text-success", tab: "factures" },
          { label: "Opérations", value: operations.length, icon: Cog, color: "text-warning", tab: "operations" },
          { label: "Visites", value: visites.length, icon: Eye, color: "text-purple-500", tab: "visites" },
        ].map(stat => (
          <button
            key={stat.label}
            onClick={() => setActiveTab(stat.tab)}
            className={`card-interactive p-3 text-left space-y-1 ${activeTab === stat.tab ? "ring-2 ring-primary" : ""}`}
          >
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
            <p className="text-xl font-black tabular-nums">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card-elevated p-4 space-y-2">
        <p className="section-label mb-3">Actions rapides</p>
        <CreateDevisDialog
          preselectedClientId={client?.id}
          preselectedCompanyId={dossier.company_id}
          preselectedDossierId={id}
          trigger={
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-9">
              <FileText className="h-3.5 w-3.5 text-info" /> Nouveau devis
            </Button>
          }
        />
        <CreateVisiteDialog
          preselectedClientId={client?.id}
          preselectedCompanyId={dossier.company_id}
          preselectedDossierId={id}
          trigger={
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-9">
              <Eye className="h-3.5 w-3.5 text-warning" /> Nouvelle visite
            </Button>
          }
        />
        <CreateFactureDialog
          preselectedClientId={client?.id}
          preselectedCompanyId={dossier.company_id}
          preselectedDossierId={id}
          trigger={
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-9">
              <DollarSign className="h-3.5 w-3.5 text-success" /> Nouvelle facture
            </Button>
          }
        />
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-9" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" /> Modifier le dossier
        </Button>
      </div>

      {/* Description / Notes */}
      {(dossier.description || dossier.notes) && (
        <div className="card-elevated p-4 space-y-3">
          {dossier.description && (
            <div>
              <p className="section-label mb-1.5">Description</p>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{dossier.description}</p>
            </div>
          )}
          {dossier.notes && (
            <div>
              <p className="section-label mb-1.5">Notes</p>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{dossier.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── Tabs content (shared) ──
  const TabsArea = () => (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
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
        <TabsList className="flex flex-wrap gap-1.5 h-auto bg-transparent p-0 mb-5 border-b pb-4">
          {tabItems.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="rounded-lg px-3 py-1.5 text-xs font-medium h-auto gap-1.5
                data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm
                data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground
                hover:data-[state=inactive]:bg-muted/80 transition-colors"
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className="rounded-full bg-current/20 px-1.5 text-[9px] font-bold leading-4">{tab.count}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      )}

      <TabsContent value="timeline">
        <div className="rounded-xl border bg-card p-4">
          <DossierTimeline dossierId={id!} dossier={dossier} devis={devis} factures={factures} visites={visites} />
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
        <DossierSituationTab dossierId={id!} dossierAmount={dossier.amount || 0} dossierCost={(dossier as any).cost || 0} companyId={dossier.company_id} clientId={client?.id || ""} />
      </TabsContent>
    </Tabs>
  );

  // ── Voirie section ──
  const VoirieSection = () => {
    if (voirieVisites.length === 0) return null;
    return (
      <div className={`rounded-xl border bg-card ${isMobile ? "p-3" : "p-5"}`}>
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
      </div>
    );
  };

  return (
    <div className={`max-w-6xl mx-auto animate-fade-in ${isMobile ? "p-3 pb-20 space-y-4" : "p-6 lg:p-8 space-y-5"}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <DetailBreadcrumb items={breadcrumbItems} />
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> {!isMobile && "Modifier"}
          </Button>
        </div>
      </div>

      {/* Next Action Banner */}
      <DossierNextAction dossier={dossier} devis={devis} factures={factures} visites={visites} operationsCount={operations.length} />

      {/* Desktop: 2-column layout */}
      {!isMobile && (
        <div className="grid grid-cols-[300px_1fr] gap-6 items-start">
          <div className="sticky top-6">
            <SidebarContent />
          </div>
          <div className="min-w-0">
            <VoirieSection />
            {voirieVisites.length > 0 && <div className="h-5" />}
            <TabsArea />
          </div>
        </div>
      )}

      {/* Mobile: single column */}
      {isMobile && (
        <div className="space-y-4">
          <SidebarContent />
          <VoirieSection />
          <TabsArea />
        </div>
      )}

      {/* Dialogs */}
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
