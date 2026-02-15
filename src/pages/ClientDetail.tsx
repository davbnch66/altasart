import { useState } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Mail, Phone, MapPin, Building2, User, FileText, Receipt, CreditCard,
  FolderOpen, ClipboardCheck, Plus, Download, Eye
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateDevisDialog } from "@/components/forms/CreateDevisDialog";
import { CreateDossierDialog } from "@/components/forms/CreateDossierDialog";

type TabKey = "infos" | "factures" | "devis" | "reglements" | "dossiers" | "visites";

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "infos", label: "Informations", icon: User },
  { key: "factures", label: "Factures", icon: Receipt },
  { key: "devis", label: "Devis", icon: FileText },
  { key: "reglements", label: "Règlements", icon: CreditCard },
  { key: "dossiers", label: "Dossiers", icon: FolderOpen },
  { key: "visites", label: "Visites", icon: ClipboardCheck },
];

const invoiceStatus: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoyee: "bg-info/10 text-info",
  payee: "bg-success/10 text-success",
  en_retard: "bg-destructive/10 text-destructive",
  annulee: "bg-muted text-muted-foreground",
};

const invoiceLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
  en_retard: "En retard",
  annulee: "Annulée",
};

const devisStatusStyles: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-info/10 text-info",
  accepte: "bg-success/10 text-success",
  refuse: "bg-destructive/10 text-destructive",
  expire: "bg-muted text-muted-foreground",
};

const devisLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
};

const dossierStageStyles: Record<string, string> = {
  prospect: "bg-muted text-muted-foreground",
  devis: "bg-info/10 text-info",
  accepte: "bg-success/10 text-success",
  planifie: "bg-primary/10 text-primary",
  en_cours: "bg-warning/10 text-warning",
  termine: "bg-success/10 text-success",
  facture: "bg-info/10 text-info",
  paye: "bg-success/10 text-success",
};

const dossierStageLabels: Record<string, string> = {
  prospect: "Prospect",
  devis: "Devis",
  accepte: "Accepté",
  planifie: "Planifié",
  en_cours: "En cours",
  termine: "Terminé",
  facture: "Facturé",
  paye: "Payé",
};

const visiteLabels: Record<string, string> = {
  planifiee: "Planifiée",
  realisee: "Réalisée",
  annulee: "Annulée",
};

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
  const [activeTab, setActiveTab] = useState<TabKey>("infos");

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
      const { data, error } = await supabase
        .from("dossiers")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: devis = [] } = useQuery({
    queryKey: ["client-devis", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devis")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: factures = [] } = useQuery({
    queryKey: ["client-factures", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factures")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
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
      const { data, error } = await supabase
        .from("reglements")
        .select("*, factures(code)")
        .in("facture_id", factureIds)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: factures.length > 0,
  });

  const { data: visites = [] } = useQuery({
    queryKey: ["client-visites", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visites")
        .select("*, resources:technician_id(name)")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  if (clientLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (!client) return <div className="p-8">Client introuvable</div>;

  const totalFacture = factures.reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalRegle = factures.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
  const solde = totalFacture - totalRegle;
  const soldeColor = solde > 0 ? "text-destructive" : "text-success";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <button onClick={() => navigate("/clients")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Retour aux clients
        </button>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {client.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
              <p className="text-muted-foreground text-sm">
                Code : {client.code || "—"} · {client.contact_name || "—"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors">
                <Mail className="h-4 w-4" /> Email
              </a>
            )}
            {(client.phone || client.mobile) && (
              <a href={`tel:${client.phone || client.mobile}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors">
                <Phone className="h-4 w-4" /> Appeler
              </a>
            )}
            <CreateDevisDialog preselectedClientId={id} preselectedCompanyId={client.company_id} />
          </div>
        </div>
      </motion.div>

      {/* Financial summary */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Facturé</p>
          <p className="text-xl font-bold text-foreground">{formatAmount(totalFacture)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Réglé</p>
          <p className="text-xl font-bold text-info">{formatAmount(totalRegle)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Solde</p>
          <p className={`text-xl font-bold ${soldeColor}`}>{formatAmount(solde)}</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeTab === "infos" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-sm">Informations client</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3"><Building2 className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="font-medium">{client.name}</p><p className="text-muted-foreground">Code : {client.code || "—"}</p></div></div>
                <div className="flex items-start gap-3"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p>{client.address || "—"}</p><p className="text-muted-foreground">{client.postal_code} {client.city}</p></div></div>
                <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span>{client.email || "—"}</span></div>
                <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span>{client.phone || "—"}</span></div>
                {client.mobile && <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span>{client.mobile} (mobile)</span></div>}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-sm">Informations de facturation</h3>
              <div className="space-y-3 text-sm">
                <div><p className="text-muted-foreground">Adresse de facturation</p><p className="font-medium">{client.billing_address || client.address || "—"}</p></div>
                <div><p className="text-muted-foreground">Mode de règlement</p><p className="font-medium">{client.payment_terms || "—"}</p></div>
                <div><p className="text-muted-foreground">Conseiller</p><p className="font-medium">{client.advisor || "—"}</p></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "factures" && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Factures du client</h3>
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
                    <tr key={f.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
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
        )}

        {activeTab === "devis" && (
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
                  <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Date</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Objet</th>
                  <th className="text-right font-medium text-muted-foreground px-4 py-2.5">Montant</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Statut</th>
                </tr></thead>
                <tbody className="divide-y">
                  {devis.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-mono text-xs">{d.code || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(d.created_at)}</td>
                      <td className="px-4 py-3 font-medium">{d.objet}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatAmount(d.amount)}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${devisStatusStyles[d.status] || ""}`}>{devisLabels[d.status] || d.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "reglements" && (
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
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
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
        )}

        {activeTab === "dossiers" && (
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
                </tr></thead>
                <tbody className="divide-y">
                  {dossiers.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-mono text-xs">{d.code || "—"}</td>
                      <td className="px-4 py-3 font-medium">{d.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(d.start_date || d.created_at)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatAmount(d.amount)}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${dossierStageStyles[d.stage] || ""}`}>{dossierStageLabels[d.stage] || d.stage}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "visites" && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Visites techniques</h3>
            </div>
            {visites.length === 0 ? (
              <p className="px-4 py-12 text-center text-muted-foreground">Aucune visite</p>
            ) : (
              <div className="divide-y">
                {visites.map((v) => (
                  <div key={v.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{v.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(v.scheduled_date || v.completed_date)} · {(v.resources as any)?.name || "—"} · {v.photos_count || 0} photos
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
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
  );
};

export default ClientDetail;
