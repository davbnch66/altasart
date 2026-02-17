import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  ArrowLeft, FolderOpen, Pencil, FileText, DollarSign, Eye, User, Building2, ChevronRight, Cog, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { EditDossierDialog } from "@/components/forms/EditDossierDialog";
import { CreateDevisDialog } from "@/components/forms/CreateDevisDialog";
import { CreateVisiteDialog } from "@/components/forms/CreateVisiteDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { DossierOperationsTab } from "@/components/dossier/DossierOperationsTab";
import { DossierSituationTab } from "@/components/dossier/DossierSituationTab";

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
  const [editing, setEditing] = useState(false);
  const isMobile = useIsMobile();

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

  const { data: visites = [] } = useQuery({
    queryKey: ["dossier-visites", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("visites").select("id, title, status, scheduled_date, completed_date").eq("dossier_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
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

  return (
    <div className={`max-w-5xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dossiers")} className={isMobile ? "h-8 w-8" : ""}>
          <ArrowLeft className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className={`font-bold tracking-tight flex items-center gap-2 ${isMobile ? "text-base" : "text-2xl gap-3"}`}>
            {!isMobile && <FolderOpen className="h-6 w-6 text-muted-foreground" />}
            <span className="truncate">{dossier.code || "Dossier"}</span>
          </h1>
          <p className={`text-muted-foreground mt-0.5 truncate ${isMobile ? "text-xs" : ""}`}>{dossier.title}</p>
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
            {dossier.address && <div><p className="text-muted-foreground">Adresse</p><p className="font-medium truncate">{dossier.address}</p></div>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <Tabs defaultValue="devis">
          {isMobile ? (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-3 px-3 pb-1">
              {[
                { key: "devis", label: "Devis", count: devis.length },
                { key: "operations", label: "Opérations", count: null },
                { key: "factures", label: "Factures", count: factures.length },
                { key: "situation", label: "Situation", count: null },
                { key: "visites", label: "Visites", count: visites.length },
              ].map((tab) => (
                <TabsList key={tab.key} className="bg-transparent p-0">
                  <TabsTrigger value={tab.key} className="rounded-full px-3 py-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    {tab.label}{tab.count !== null ? ` (${tab.count})` : ""}
                  </TabsTrigger>
                </TabsList>
              ))}
            </div>
          ) : (
            <TabsList>
              <TabsTrigger value="devis" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Devis ({devis.length})</TabsTrigger>
              <TabsTrigger value="operations" className="gap-1.5"><Cog className="h-3.5 w-3.5" /> Opérations</TabsTrigger>
              <TabsTrigger value="factures" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Factures ({factures.length})</TabsTrigger>
              <TabsTrigger value="situation" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Situation</TabsTrigger>
              <TabsTrigger value="visites" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> Visites ({visites.length})</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="devis">
            <div className="space-y-3">
              <div className="flex justify-end">
                <CreateDevisDialog preselectedClientId={client?.id} preselectedCompanyId={dossier.company_id} preselectedDossierId={id} />
              </div>
              <div className="rounded-xl border bg-card divide-y">
              {devis.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">Aucun devis lié</div>
              ) : devis.map((d) => (
                <div key={d.id} className={`flex items-center gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${isMobile ? "px-3 py-2.5" : "px-5 py-3.5"}`} onClick={() => navigate(`/devis/${d.id}`)}>
                  <FileText className="h-4 w-4 text-info shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isMobile ? "text-xs" : "text-sm"}`}>{d.code} — {d.objet}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(d.created_at)}</p>
                  </div>
                  <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted font-medium shrink-0">{statusLabelsDevis[d.status] || d.status}</span>
                  {isMobile ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <span className="text-sm font-semibold shrink-0">{formatAmount(d.amount)}</span>}
                </div>
              ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="operations">
            <DossierOperationsTab dossierId={id!} companyId={dossier.company_id} />
          </TabsContent>

          <TabsContent value="factures">
            <div className="rounded-xl border bg-card divide-y">
              {factures.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">Aucune facture liée</div>
              ) : factures.map((f) => (
                <div key={f.id} className={`flex items-center gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${isMobile ? "px-3 py-2.5" : "px-5 py-3.5"}`} onClick={() => navigate(`/finance/${f.id}`)}>
                  <DollarSign className="h-4 w-4 text-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isMobile ? "text-xs" : "text-sm"}`}>{f.code || "Facture"}</p>
                    <p className="text-[11px] text-muted-foreground">Éch.: {formatDate(f.due_date)}</p>
                  </div>
                  <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted font-medium shrink-0">{statusLabelsFacture[f.status] || f.status}</span>
                  {isMobile ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <span className="text-sm font-semibold shrink-0">{formatAmount(f.amount)}</span>}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="situation">
            <DossierSituationTab dossierId={id!} dossierAmount={dossier.amount || 0} dossierCost={(dossier as any).cost || 0} />
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
                <div key={v.id} className={`flex items-center gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${isMobile ? "px-3 py-2.5" : "px-5 py-3.5"}`} onClick={() => navigate(`/visites/${v.id}`)}>
                  <Eye className="h-4 w-4 text-warning shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isMobile ? "text-xs" : "text-sm"}`}>{v.title}</p>
                    <p className="text-[11px] text-muted-foreground">{v.scheduled_date ? formatDate(v.scheduled_date) : "Non planifiée"}</p>
                  </div>
                  <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted font-medium shrink-0">{statusLabelsVisite[v.status] || v.status}</span>
                  {isMobile && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>
              ))}
              </div>
            </div>
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
    </div>
  );
};

export default DossierDetail;
