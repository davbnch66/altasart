import { useState } from "react";
import { motion } from "framer-motion";
import { ClientContactsTab } from "@/components/client/ClientContactsTab";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Mail, Phone, MapPin, Building2, User, FileText, Receipt, CreditCard,
  FolderOpen, ClipboardCheck, Pencil, Trash2, ChevronRight, Euro, MessageSquare,
  Plus, StickyNote, Calendar, Send, Users, Tag, HardHat,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CreateDevisDialog } from "@/components/forms/CreateDevisDialog";
import { CreateDossierDialog } from "@/components/forms/CreateDossierDialog";
import { CreateFactureDialog } from "@/components/forms/CreateFactureDialog";
import { CreateVisiteDialog } from "@/components/forms/CreateVisiteDialog";
import { EditClientDialog } from "@/components/forms/EditClientDialog";
import { EditDossierDialog } from "@/components/forms/EditDossierDialog";
import { EditDevisDialog } from "@/components/forms/EditDevisDialog";
import { DeleteConfirmDialog } from "@/components/forms/DeleteConfirmDialog";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { ClientCommunicationPanel } from "@/components/client/ClientCommunicationPanel";
import { DevisStatusSelect } from "@/components/DevisStatusSelect";

type TabKey = "infos" | "contacts" | "dossiers" | "chantiers" | "echanges" | "factures" | "devis" | "reglements" | "visites";

const desktopTabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "infos", label: "Infos", icon: User },
  { key: "contacts", label: "Contacts", icon: Users },
  { key: "dossiers", label: "Dossiers", icon: FolderOpen },
  { key: "chantiers", label: "Chantiers", icon: HardHat },
  { key: "factures", label: "Factures", icon: Receipt },
  { key: "devis", label: "Devis", icon: FileText },
  { key: "reglements", label: "Règlements", icon: CreditCard },
  { key: "visites", label: "Visites", icon: ClipboardCheck },
];

const mobileTabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "infos", label: "Infos", icon: User },
  { key: "contacts", label: "Contacts", icon: Users },
  { key: "dossiers", label: "Dossiers", icon: FolderOpen },
  { key: "chantiers", label: "Chantiers", icon: HardHat },
  { key: "echanges", label: "Échanges", icon: MessageSquare },
  { key: "factures", label: "Factures", icon: Receipt },
  { key: "devis", label: "Devis", icon: FileText },
  { key: "reglements", label: "Règlements", icon: CreditCard },
  { key: "visites", label: "Visites", icon: ClipboardCheck },
];

const invoiceStatus: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoyee: "bg-info/10 text-info",
  payee: "bg-success/10 text-success",
  en_retard: "bg-destructive/10 text-destructive",
  annulee: "bg-muted text-muted-foreground",
};
const invoiceLabels: Record<string, string> = { brouillon: "Brouillon", envoyee: "Envoyée", payee: "Payée", en_retard: "En retard", annulee: "Annulée" };
const devisStatusStyles: Record<string, string> = { brouillon: "bg-muted text-muted-foreground", envoye: "bg-info/10 text-info", accepte: "bg-success/10 text-success", refuse: "bg-destructive/10 text-destructive", expire: "bg-muted text-muted-foreground" };
const devisLabels: Record<string, string> = { brouillon: "Brouillon", envoye: "Envoyé", accepte: "Accepté", refuse: "Refusé", expire: "Expiré" };
const dossierStageStyles: Record<string, string> = { prospect: "bg-muted text-muted-foreground", devis: "bg-info/10 text-info", accepte: "bg-success/10 text-success", planifie: "bg-primary/10 text-primary", en_cours: "bg-warning/10 text-warning", termine: "bg-success/10 text-success", facture: "bg-info/10 text-info", paye: "bg-success/10 text-success" };
const dossierStageLabels: Record<string, string> = { prospect: "Prospect", devis: "Devis", accepte: "Accepté", planifie: "Planifié", en_cours: "En cours", termine: "Terminé", facture: "Facturé", paye: "Payé" };
const visiteLabels: Record<string, string> = { planifiee: "Planifiée", realisee: "Réalisée", annulee: "Annulée" };
const clientStatusLabels: Record<string, string> = { nouveau_lead: "Prospect", actif: "Actif", inactif: "Inactif", relance: "À relancer" };
const clientStatusStyles: Record<string, string> = { nouveau_lead: "bg-info/10 text-info", actif: "bg-success/10 text-success", inactif: "bg-muted text-muted-foreground", relance: "bg-warning/10 text-warning" };

const formatAmount = (amount: number | null) => {
  if (!amount && amount !== 0) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
};
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR");
};

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabKey>("infos");
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [deleteClientOpen, setDeleteClientOpen] = useState(false);
  const [editingDossier, setEditingDossier] = useState<any>(null);
  const [deletingDossier, setDeletingDossier] = useState<any>(null);
  const [editingDevis, setEditingDevis] = useState<any>(null);
  const [deletingDevis, setDeletingDevis] = useState<any>(null);

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, companies(short_name, color)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: dossiers = [] } = useQuery({
    queryKey: ["client-dossiers", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("dossiers").select("*").eq("client_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: devis = [] } = useQuery({
    queryKey: ["client-devis", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("devis").select("*, dossiers(id, code, title)").eq("client_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: factures = [] } = useQuery({
    queryKey: ["client-factures", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("factures").select("*").eq("client_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: reglements = [] } = useQuery({
    queryKey: ["client-reglements", id],
    queryFn: async () => {
      if (factures.length === 0) return [];
      const factureIds = factures.map((f) => f.id);
      const { data, error } = await supabase.from("reglements").select("*, factures(code)").in("facture_id", factureIds).order("payment_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: factures.length > 0,
  });

  const { data: visites = [] } = useQuery({
    queryKey: ["client-visites", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("visites").select("*, resources:technician_id(name)").eq("client_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Prochaine action: next scheduled visite or earliest unpaid facture
  const nextVisite = visites.find((v) => v.status === "planifiee" && v.scheduled_date);
  const nextFactureImpayee = factures.find((f) => f.status !== "payee" && f.due_date);

  const deleteClientMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client supprimé");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      navigate("/clients");
    },
    onError: () => toast.error("Erreur lors de la suppression. Vérifiez qu'il n'a pas de données liées."),
  });

  const deleteDossierMutation = useMutation({
    mutationFn: async (dossierId: string) => {
      const { error } = await supabase.from("dossiers").delete().eq("id", dossierId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dossier supprimé");
      queryClient.invalidateQueries({ queryKey: ["client-dossiers"] });
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      setDeletingDossier(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const deleteDevisMutation = useMutation({
    mutationFn: async (devisId: string) => {
      const { error } = await supabase.from("devis").delete().eq("id", devisId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devis supprimé");
      queryClient.invalidateQueries({ queryKey: ["client-devis"] });
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      queryClient.invalidateQueries({ queryKey: ["dossier-devis"] });
      setDeletingDevis(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  if (clientLoading) {
    return (
      <div className={`max-w-7xl mx-auto space-y-4 ${isMobile ? "p-3" : "p-6 lg:p-8 space-y-6"}`}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-3 gap-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      </div>
    );
  }

  if (!client) return <div className="p-8">Client introuvable</div>;

  const totalFacture = factures.reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalRegle = factures.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
  const solde = totalFacture - totalRegle;
  const soldeColor = solde > 0 ? "text-destructive" : "text-success";

  const tabs = isMobile ? mobileTabs : desktopTabs;

  return (
    <div className={`mx-auto ${isMobile ? "p-3 pb-20 space-y-3 max-w-7xl" : "p-6 lg:p-8 space-y-6 max-w-[1600px]"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>

        {isMobile ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {client.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight break-words">{client.name}</h1>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${clientStatusStyles[client.status] || ""}`}>
                    {clientStatusLabels[client.status] || client.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground break-words">
                  {client.code || "—"} · {client.contact_name || "—"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs hover:bg-muted transition-colors">
                  <Mail className="h-3.5 w-3.5" /> Email
                </a>
              )}
              {(client.phone || client.mobile) && (
                <a href={`tel:${client.phone || client.mobile}`} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs hover:bg-muted transition-colors">
                  <Phone className="h-3.5 w-3.5" /> Appeler
                </a>
              )}
              <button onClick={() => setEditClientOpen(true)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs hover:bg-muted transition-colors">
                <Pencil className="h-3.5 w-3.5" /> Modifier
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                {client.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${clientStatusStyles[client.status] || ""}`}>
                    {clientStatusLabels[client.status] || client.status}
                  </span>
                  {client.companies && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground border">
                      <Building2 className="h-3 w-3" />
                      {(client.companies as any).short_name}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  Code : {client.code || "—"} · {client.contact_name || "—"}
                  {client.email && <> · {client.email}</>}
                  {client.phone && <> · {client.phone}</>}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditClientOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" /> Modifier
              </Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteClientOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Supprimer
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Financial summary + prochaine action */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className={`grid gap-2 md:gap-4 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}>
        <div className={`rounded-xl border bg-card text-center ${isMobile ? "p-2.5" : "p-4"}`}>
          <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Facturé</p>
          <p className={`font-bold text-foreground ${isMobile ? "text-sm" : "text-xl"}`}>{formatAmount(totalFacture)}</p>
        </div>
        <div className={`rounded-xl border bg-card text-center ${isMobile ? "p-2.5" : "p-4"}`}>
          <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Réglé</p>
          <p className={`font-bold text-info ${isMobile ? "text-sm" : "text-xl"}`}>{formatAmount(totalRegle)}</p>
        </div>
        <div className={`rounded-xl border bg-card text-center ${isMobile ? "p-2.5" : "p-4"}`}>
          <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Solde</p>
          <p className={`font-bold ${soldeColor} ${isMobile ? "text-sm" : "text-xl"}`}>{formatAmount(solde)}</p>
        </div>
        <div className={`rounded-xl border bg-card text-center ${isMobile ? "p-2.5 col-span-2" : "p-4"}`}>
          <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Prochaine action</p>
          <p className={`font-medium ${isMobile ? "text-xs" : "text-sm"}`}>
            {nextVisite
              ? `📅 Visite ${formatDate(nextVisite.scheduled_date)}`
              : nextFactureImpayee
                ? `💰 Échéance ${formatDate(nextFactureImpayee.due_date)}`
                : "Aucune"}
          </p>
        </div>
      </motion.div>

      {/* Quick actions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div className={`flex gap-2 overflow-x-auto scrollbar-none ${isMobile ? "-mx-3 px-3" : ""}`}>
          <CreateDossierDialog preselectedClientId={id} preselectedCompanyId={client.company_id} trigger={
            <Button variant="outline" size="sm" className="shrink-0 text-xs">
              <FolderOpen className="h-3.5 w-3.5 mr-1" /> Dossier
            </Button>
          } />
          <CreateDevisDialog preselectedClientId={id} preselectedCompanyId={client.company_id} trigger={
            <Button variant="outline" size="sm" className="shrink-0 text-xs">
              <FileText className="h-3.5 w-3.5 mr-1" /> Devis
            </Button>
          } />
          <CreateVisiteDialog preselectedClientId={id} preselectedCompanyId={client.company_id} trigger={
            <Button variant="outline" size="sm" className="shrink-0 text-xs">
              <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Visite
            </Button>
          } />
          <CreateFactureDialog preselectedClientId={id} preselectedCompanyId={client.company_id} trigger={
            <Button variant="outline" size="sm" className="shrink-0 text-xs">
              <Receipt className="h-3.5 w-3.5 mr-1" /> Facture
            </Button>
          } />
          <Button variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => isMobile ? setActiveTab("echanges") : undefined}>
            <StickyNote className="h-3.5 w-3.5 mr-1" /> Note
          </Button>
          {client.email && (
            <a href={`mailto:${client.email}`}>
              <Button variant="outline" size="sm" className="shrink-0 text-xs">
                <Send className="h-3.5 w-3.5 mr-1" /> Email
              </Button>
            </a>
          )}
        </div>
      </motion.div>

      {/* Two-column layout: tabs+content left, communication panel right */}
      <div className={isMobile ? "space-y-3" : "flex gap-6 items-start"}>
        {/* Left column: Tabs + Tab content */}
        <div className={isMobile ? "" : "flex-1 min-w-0 space-y-4"}>
          {/* Tabs */}
          <div className={`flex gap-1 overflow-x-auto scrollbar-none ${isMobile ? "-mx-3 px-3 pb-1" : "border-b"}`}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 shrink-0 font-medium transition-colors ${
                  isMobile
                    ? `px-3 py-1.5 rounded-full text-xs ${activeTab === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`
                    : `px-4 py-2.5 text-sm border-b-2 ${activeTab === tab.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`
                }`}
              >
                <tab.icon className={isMobile ? "h-3.5 w-3.5" : "h-4 w-4"} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <motion.div key={activeTab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeTab === "infos" && (
          <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "md:grid-cols-2 gap-6"}`}>
            <div className={`rounded-xl border bg-card space-y-3 ${isMobile ? "p-3" : "p-5 space-y-4"}`}>
              <h3 className="font-semibold text-sm">Informations client</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2.5"><Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><div className="min-w-0"><p className="font-medium break-words">{client.name}</p><p className="text-xs text-muted-foreground">Code : {client.code || "—"} · Type : {(client as any).client_type === "particulier" ? "Particulier" : "Société"}</p></div></div>
                <div className="flex items-start gap-2.5"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><div className="min-w-0"><p className="break-words">{client.address || "—"}</p><p className="text-xs text-muted-foreground">{client.postal_code} {client.city}</p></div></div>
                <div className="flex items-center gap-2.5"><Mail className="h-4 w-4 text-muted-foreground shrink-0" /><span className="break-words text-xs">{client.email || "—"}</span></div>
                <div className="flex items-center gap-2.5"><Phone className="h-4 w-4 text-muted-foreground shrink-0" /><span className="text-xs">{client.phone || "—"}</span></div>
                {client.mobile && <div className="flex items-center gap-2.5"><Phone className="h-4 w-4 text-muted-foreground shrink-0" /><span className="text-xs">{client.mobile} (mobile)</span></div>}
                {(client as any).tags?.length > 0 && (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                    {(client as any).tags.map((t: string) => (
                      <span key={t} className="inline-flex rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className={`rounded-xl border bg-card space-y-3 ${isMobile ? "p-3" : "p-5 space-y-4"}`}>
              <h3 className="font-semibold text-sm">Facturation</h3>
              <div className="space-y-2.5 text-sm">
                <div><p className="text-xs text-muted-foreground">Adresse de facturation</p><p className="font-medium text-xs">{client.billing_address || client.address || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Mode de règlement</p><p className="font-medium text-xs">{client.payment_terms || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Conseiller</p><p className="font-medium text-xs">{client.advisor || "—"}</p></div>
              </div>
            </div>
            {client.notes && (
              <div className={`rounded-xl border bg-card space-y-2 ${isMobile ? "p-3" : "p-5"} md:col-span-2`}>
                <h3 className="font-semibold text-sm">Notes</h3>
                <p className="text-xs whitespace-pre-wrap text-muted-foreground">{client.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "contacts" && (
          <ClientContactsTab clientId={id!} companyId={client.company_id} />
        )}

        {activeTab === "dossiers" && (
          isMobile ? (
            <div className="space-y-2">
              <div className="flex justify-end">
                <CreateDossierDialog preselectedClientId={id} preselectedCompanyId={client.company_id} trigger={
                  <Button size="sm" className="text-xs"><FolderOpen className="h-3.5 w-3.5 mr-1" /> Nouveau dossier</Button>
                } />
              </div>
              {dossiers.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Aucun dossier</p>
              ) : dossiers.map((d) => (
                <div key={d.id} className="rounded-xl border bg-card p-3 cursor-pointer" onClick={() => navigate(`/dossiers/${d.id}`, { state: { fromClient: true } })}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-medium">{d.code || "—"}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${dossierStageStyles[d.stage] || ""}`}>{dossierStageLabels[d.stage] || d.stage}</span>
                  </div>
                  <p className="text-sm font-medium break-words">{d.title}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span>{formatDate(d.start_date || d.created_at)}</span>
                    <span className="font-semibold text-foreground">{formatAmount(d.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Dossiers du client</h3>
                <CreateDossierDialog preselectedClientId={id} preselectedCompanyId={client.company_id} />
              </div>
              {dossiers.length === 0 ? (
                <p className="px-4 py-12 text-center text-muted-foreground">Aucun dossier</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/30">
                    <th className="text-left font-medium text-muted-foreground px-4 py-2.5">N°</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Intitulé</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Date</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-2.5">Montant</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Statut</th>
                    <th className="px-4 py-2.5"></th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {dossiers.map((d) => (
                      <tr key={d.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/dossiers/${d.id}`, { state: { fromClient: true } })}>
                         <td className="px-4 py-3 font-mono text-xs">{d.code || "—"}</td>
                         <td className="px-4 py-3 font-medium">{d.title}</td>
                         <td className="px-4 py-3 text-muted-foreground">{formatDate(d.start_date || d.created_at)}</td>
                         <td className="px-4 py-3 text-right font-semibold">{formatAmount(d.amount)}</td>
                         <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${dossierStageStyles[d.stage] || ""}`}>{dossierStageLabels[d.stage] || d.stage}</span></td>
                         <td className="px-4 py-3">
                           <div className="flex gap-1">
                             <button onClick={(e) => { e.stopPropagation(); setEditingDossier(d); }} className="p-1 rounded hover:bg-muted" title="Modifier"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                             <button onClick={(e) => { e.stopPropagation(); setDeletingDossier(d); }} className="p-1 rounded hover:bg-muted" title="Supprimer"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                           </div>
                         </td>
                       </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        )}

        {activeTab === "chantiers" && (() => {
          const activeStages = ["planifie", "en_cours", "termine", "accepte"];
          const chantiersEnCours = dossiers.filter((d) => activeStages.includes(d.stage));
          return (
            <div className={`${isMobile ? "space-y-2" : "rounded-xl border bg-card overflow-hidden"}`}>
              {!isMobile && (
                <div className="p-4 border-b">
                  <h3 className="font-semibold">Chantiers en cours ({chantiersEnCours.length})</h3>
                </div>
              )}
              {chantiersEnCours.length === 0 ? (
                <p className={`text-center text-muted-foreground text-sm ${isMobile ? "py-8" : "px-4 py-12"}`}>Aucun chantier en cours</p>
              ) : (
                <div className={isMobile ? "space-y-2" : "divide-y"}>
                  {chantiersEnCours.map((d) => {
                    const stageKeys = ["prospect", "devis", "accepte", "planifie", "en_cours", "termine", "facture", "paye"];
                    const progress = ((stageKeys.indexOf(d.stage) + 1) / stageKeys.length) * 100;
                    return (
                      <div
                        key={d.id}
                        className={`cursor-pointer transition-colors ${isMobile ? "rounded-xl border bg-card p-3" : "px-5 py-4 hover:bg-muted/30"}`}
                        onClick={() => navigate(`/dossiers/${d.id}`, { state: { fromClient: true } })}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs font-medium shrink-0">{d.code || "—"}</span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${dossierStageStyles[d.stage] || ""}`}>
                              {dossierStageLabels[d.stage] || d.stage}
                            </span>
                          </div>
                          <span className="font-semibold text-sm shrink-0">{formatAmount(d.amount)}</span>
                        </div>
                        <p className={`font-medium break-words ${isMobile ? "text-xs" : "text-sm"}`}>{d.title}</p>
                        <div className="flex gap-0.5 mt-2">
                          {stageKeys.map((key, i) => (
                            <div key={key} className={`flex-1 h-1 rounded-full ${i <= stageKeys.indexOf(d.stage) ? "bg-primary" : "bg-muted"}`} />
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-muted-foreground">{formatDate(d.start_date || d.created_at)}</span>
                          {d.end_date && <span className="text-[10px] text-muted-foreground">→ {formatDate(d.end_date)}</span>}
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === "echanges" && isMobile && (
          <ClientCommunicationPanel
            clientId={id!}
            clientName={client?.name || ""}
            clientEmail={client?.email}
            clientPhone={client?.phone}
            clientMobile={client?.mobile}
            companyId={client.company_id}
            dossiers={dossiers.map((d) => ({ id: d.id, title: d.title, code: d.code }))}
          />
        )}

        {activeTab === "factures" && (
          isMobile ? (
            <div className="space-y-2">
              <div className="flex justify-end">
                <CreateFactureDialog preselectedClientId={id} preselectedCompanyId={client.company_id} trigger={
                  <Button size="sm" className="text-xs"><Receipt className="h-3.5 w-3.5 mr-1" /> Nouvelle facture</Button>
                } />
              </div>
              {factures.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Aucune facture</p>
              ) : factures.map((f) => (
                <div key={f.id} className="rounded-xl border bg-card p-3 cursor-pointer" onClick={() => navigate(`/finance/${f.id}`, { state: { fromClient: true } })}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-medium">{f.code || "—"}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${invoiceStatus[f.status] || ""}`}>{invoiceLabels[f.status] || f.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(f.created_at)}</span>
                    <span className="font-semibold text-foreground">{formatAmount(f.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                    <span>Réglé : {formatAmount(f.paid_amount)}</span>
                    <span className="font-medium">Solde : {formatAmount(f.amount - f.paid_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Factures du client</h3>
                <CreateFactureDialog preselectedClientId={id} preselectedCompanyId={client.company_id} />
              </div>
              {factures.length === 0 ? (
                <p className="px-4 py-12 text-center text-muted-foreground">Aucune facture</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/30">
                    <th className="text-left font-medium text-muted-foreground px-4 py-2.5">N°</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Date</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-2.5">Montant</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-2.5">Réglé</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-2.5">Solde</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Statut</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {factures.map((f) => (
                      <tr key={f.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/finance/${f.id}`, { state: { fromClient: true } })}>
                        <td className="px-4 py-3 font-mono text-xs">{f.code || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(f.created_at)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatAmount(f.amount)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatAmount(f.paid_amount)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatAmount(f.amount - f.paid_amount)}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${invoiceStatus[f.status] || ""}`}>{invoiceLabels[f.status] || f.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        )}

        {activeTab === "devis" && (
          isMobile ? (
            <div className="space-y-2">
              <div className="flex justify-end">
                <CreateDevisDialog preselectedClientId={id} preselectedCompanyId={client.company_id} trigger={
                  <Button size="sm" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1" /> Nouveau devis</Button>
                } />
              </div>
              {devis.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Aucun devis</p>
              ) : devis.map((d) => (
                <div key={d.id} className="rounded-xl border bg-card p-3 cursor-pointer" onClick={() => navigate(`/devis/${d.id}`, { state: { fromClient: true } })}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-medium">{d.code || "—"}</span>
                    <DevisStatusSelect devisId={d.id} currentStatus={d.status} size="xs" />
                  </div>
                  <p className="text-sm font-medium break-words">{d.objet}</p>
                  {(d as any).dossiers && <p className="text-[11px] text-muted-foreground">Dossier : {(d as any).dossiers.code || (d as any).dossiers.title}</p>}
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span>{formatDate(d.created_at)}</span>
                    <span className="font-semibold text-foreground">{formatAmount(d.amount)}</span>
                  </div>
                  <div className="flex gap-1 mt-2 justify-end">
                    <button onClick={(e) => { e.stopPropagation(); setEditingDevis(d); }} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeletingDevis(d); }} className="p-1.5 rounded hover:bg-muted"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Devis du client</h3>
                <CreateDevisDialog preselectedClientId={id} preselectedCompanyId={client.company_id} />
              </div>
              {devis.length === 0 ? (
                <p className="px-4 py-12 text-center text-muted-foreground">Aucun devis</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/30">
                     <th className="text-left font-medium text-muted-foreground px-4 py-2.5">N°</th>
                     <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Dossier</th>
                     <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Date</th>
                     <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Objet</th>
                     <th className="text-right font-medium text-muted-foreground px-4 py-2.5">Montant</th>
                     <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Statut</th>
                     <th className="px-4 py-2.5"></th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {devis.map((d) => (
                      <tr key={d.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/devis/${d.id}`, { state: { fromClient: true } })}>
                         <td className="px-4 py-3 font-mono text-xs">{d.code || "—"}</td>
                         <td className="px-4 py-3 text-xs text-muted-foreground">{(d as any).dossiers ? ((d as any).dossiers.code || (d as any).dossiers.title) : "—"}</td>
                         <td className="px-4 py-3 text-muted-foreground">{formatDate(d.created_at)}</td>
                         <td className="px-4 py-3 font-medium">{d.objet}</td>
                         <td className="px-4 py-3 text-right font-semibold">{formatAmount(d.amount)}</td>
                         <td className="px-4 py-3"><DevisStatusSelect devisId={d.id} currentStatus={d.status} /></td>
                         <td className="px-4 py-3">
                           <div className="flex gap-1">
                             <button onClick={(e) => { e.stopPropagation(); setEditingDevis(d); }} className="p-1 rounded hover:bg-muted" title="Modifier"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                             <button onClick={(e) => { e.stopPropagation(); setDeletingDevis(d); }} className="p-1 rounded hover:bg-muted" title="Supprimer"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                           </div>
                         </td>
                       </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        )}

        {activeTab === "reglements" && (
          isMobile ? (
            <div className="space-y-2">
              {reglements.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Aucun règlement</p>
              ) : reglements.map((r) => (
                <div key={r.id} className="rounded-xl border bg-card p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-medium">{r.code || "—"}</span>
                    <span className="font-semibold text-sm">{formatAmount(r.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(r.payment_date)}</span>
                    <span>{r.bank || "—"}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Facture : {(r.factures as any)?.code || "—"}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Règlements du client</h3>
              </div>
              {reglements.length === 0 ? (
                <p className="px-4 py-12 text-center text-muted-foreground">Aucun règlement</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/30">
                    <th className="text-left font-medium text-muted-foreground px-4 py-2.5">N°</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Date</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-2.5">Montant</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Banque</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Réf. facture</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {reglements.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">{r.code || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(r.payment_date)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatAmount(r.amount)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.bank || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs">{(r.factures as any)?.code || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        )}

        {activeTab === "visites" && (
          <div className={`${isMobile ? "space-y-2" : "rounded-xl border bg-card overflow-hidden"}`}>
            {!isMobile && (
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Visites techniques</h3>
                <CreateVisiteDialog preselectedClientId={id} preselectedCompanyId={client.company_id} />
              </div>
            )}
            {isMobile && (
              <div className="flex justify-end">
                <CreateVisiteDialog preselectedClientId={id} preselectedCompanyId={client.company_id} trigger={
                  <Button size="sm" className="text-xs"><ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Nouvelle visite</Button>
                } />
              </div>
            )}
            {visites.length === 0 ? (
              <p className={`text-center text-muted-foreground text-sm ${isMobile ? "py-8" : "px-4 py-12"}`}>Aucune visite</p>
            ) : (
              <div className={isMobile ? "space-y-2" : "divide-y"}>
                {visites.map((v) => (
                  <div key={v.id} className={`flex items-center gap-3 transition-colors cursor-pointer ${
                    isMobile ? "rounded-xl border bg-card p-3" : "px-4 py-3.5 hover:bg-muted/30"
                  }`} onClick={() => navigate(`/visites/${v.id}`, { state: { fromClient: true } })}>
                    <div className={`rounded-lg bg-muted flex items-center justify-center shrink-0 ${isMobile ? "h-8 w-8" : "h-10 w-10"}`}>
                      <ClipboardCheck className={isMobile ? "h-4 w-4 text-muted-foreground" : "h-5 w-5 text-muted-foreground"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm break-words">{v.title}</p>
                      <p className="text-[11px] text-muted-foreground break-words">
                        {formatDate(v.scheduled_date || v.completed_date)} · {(v.resources as any)?.name || "—"}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${
                      v.status === "realisee" ? "bg-success/10 text-success" : v.status === "annulee" ? "bg-destructive/10 text-destructive" : "bg-info/10 text-info"
                    }`}>{visiteLabels[v.status] || v.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
        </div>

        {/* Right column: Communication panel (desktop only) */}
        {!isMobile && (
          <div className="w-[420px] shrink-0 sticky top-4">
            <ClientCommunicationPanel
              clientId={id!}
              clientName={client?.name || ""}
              clientEmail={client?.email}
              clientPhone={client?.phone}
              clientMobile={client?.mobile}
              companyId={client.company_id}
              dossiers={dossiers.map((d) => ({ id: d.id, title: d.title, code: d.code }))}
            />
          </div>
        )}
      </div>

      {/* Edit/Delete Dialogs */}
      <EditClientDialog client={client} open={editClientOpen} onOpenChange={setEditClientOpen} />
      <DeleteConfirmDialog open={deleteClientOpen} onOpenChange={setDeleteClientOpen} onConfirm={() => deleteClientMutation.mutate()} title="Supprimer ce client ?" description="Cette action est irréversible." isPending={deleteClientMutation.isPending} />
      {editingDossier && <EditDossierDialog dossier={editingDossier} open={!!editingDossier} onOpenChange={(v) => !v && setEditingDossier(null)} />}
      <DeleteConfirmDialog open={!!deletingDossier} onOpenChange={(v) => !v && setDeletingDossier(null)} onConfirm={() => deletingDossier && deleteDossierMutation.mutate(deletingDossier.id)} title="Supprimer ce dossier ?" description={`Le dossier "${deletingDossier?.title}" sera définitivement supprimé.`} isPending={deleteDossierMutation.isPending} />
      {editingDevis && <EditDevisDialog devis={editingDevis} open={!!editingDevis} onOpenChange={(v) => !v && setEditingDevis(null)} />}
      <DeleteConfirmDialog open={!!deletingDevis} onOpenChange={(v) => !v && setDeletingDevis(null)} onConfirm={() => deletingDevis && deleteDevisMutation.mutate(deletingDevis.id)} title="Supprimer ce devis ?" description={`Le devis "${deletingDevis?.objet}" sera définitivement supprimé.`} isPending={deleteDevisMutation.isPending} />
    </div>
  );
};

export default ClientDetail;
