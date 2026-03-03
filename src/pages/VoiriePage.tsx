import { useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, MapPin, Calendar, Clock, CheckCircle2, AlertCircle, Send, Eye, Filter, Map, Loader2 } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import React from "react";

const VoiriePlanEditor = lazy(() => import("@/components/voirie/VoiriePlanEditor").catch(() => ({
  default: () => <div className="flex items-center justify-center h-full text-muted-foreground"><p>Erreur de chargement de l'éditeur de plan</p></div>,
})));

class PlanEditorErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="flex items-center justify-center h-full text-destructive"><p>Erreur dans l'éditeur de plan. Rechargez la page.</p></div>;
    return this.props.children;
  }
}

const VOIRIE_STATUSES = [
  { key: "a_faire", label: "À faire", color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30", icon: AlertCircle },
  { key: "demandee", label: "Demandée", color: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: Send },
  { key: "en_attente", label: "En attente", color: "bg-orange-500/15 text-orange-600 border-orange-500/30", icon: Clock },
  { key: "obtenue", label: "Obtenue", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  { key: "refusee", label: "Refusée", color: "bg-red-500/15 text-red-600 border-red-500/30", icon: AlertCircle },
] as const;

const VOIRIE_TYPES = [
  { key: "arrete_stationnement", label: "Arrêté de stationnement" },
  { key: "plan_voirie", label: "Plan voirie (1/200ème)" },
  { key: "emprise", label: "Emprise voirie" },
  { key: "autorisation_grue", label: "Autorisation grue" },
  { key: "autre", label: "Autre" },
];

const statusMeta = (status: string) =>
  VOIRIE_STATUSES.find((s) => s.key === status) || VOIRIE_STATUSES[0];

const VoiriePage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { current, dbCompanies } = useCompany();
  const [filterStatus, setFilterStatus] = useState<string>("all_active");
  const [planEditorItem, setPlanEditorItem] = useState<any>(null);

  const companyIds = current === "global" ? dbCompanies.map((c) => c.id) : [current];

  // Fetch visites with needs_voirie = true
  const { data: visites = [], isLoading } = useQuery({
    queryKey: ["voirie-visites", companyIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visites")
        .select("id, code, address, voirie_address, voirie_status, voirie_type, voirie_notes, voirie_requested_at, voirie_obtained_at, needs_voirie, company_id, dossier_id, client_id, created_at, clients(name), companies(short_name), dossiers(title, code)" as any)
        .eq("needs_voirie", true)
        .in("company_id", companyIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: companyIds.length > 0,
  });

  // Also fetch dossiers with parking_request = true
  const { data: dossiersPR = [] } = useQuery({
    queryKey: ["voirie-dossiers-parking", companyIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossiers")
        .select("id, title, code, loading_address, loading_city, loading_parking_request, delivery_address, delivery_city, delivery_parking_request, company_id, client_id, created_at, clients(name), companies(short_name)")
        .in("company_id", companyIds)
        .or("loading_parking_request.eq.true,delivery_parking_request.eq.true")
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data || []) as any[];
    },
    enabled: companyIds.length > 0,
  });

  const updateVisiteVoirie = async (visiteId: string, field: string, value: any) => {
    const updateData: any = { [field]: value };
    if (field === "voirie_status" && value === "demandee" ) {
      updateData.voirie_requested_at = new Date().toISOString();
    }
    if (field === "voirie_status" && value === "obtenue") {
      updateData.voirie_obtained_at = new Date().toISOString();
    }
    const { error } = await supabase.from("visites").update(updateData).eq("id", visiteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Statut mis à jour");
    queryClient.invalidateQueries({ queryKey: ["voirie-visites"] });
  };

  // Combine visites + dossier parking requests into a unified list
  type VoirieItem = {
    id: string;
    source: "visite" | "dossier";
    label: string;
    address: string;
    client: string;
    company: string;
    companyId: string;
    status: string;
    type: string | null;
    notes: string | null;
    requestedAt: string | null;
    obtainedAt: string | null;
    createdAt: string;
    visiteId?: string;
    dossierId?: string;
    dossierTitle?: string;
  };

  const items: VoirieItem[] = [
    ...visites.map((v: any) => ({
      id: `v-${v.id}`,
      source: "visite" as const,
      label: v.code || `Visite ${v.id.slice(0, 8)}`,
      address: v.voirie_address || v.address || "—",
      client: v.clients?.name || "—",
      company: v.companies?.short_name || "",
      companyId: v.company_id,
      status: v.voirie_status || "a_faire",
      type: v.voirie_type,
      notes: v.voirie_notes,
      requestedAt: v.voirie_requested_at,
      obtainedAt: v.voirie_obtained_at,
      createdAt: v.created_at,
      visiteId: v.id,
      dossierId: v.dossier_id,
      dossierTitle: v.dossiers?.title || v.dossiers?.code,
    })),
    ...dossiersPR.map((d: any) => {
      const addresses: string[] = [];
      if (d.loading_parking_request && d.loading_address) addresses.push(`Charg: ${d.loading_address}${d.loading_city ? `, ${d.loading_city}` : ""}`);
      if (d.delivery_parking_request && d.delivery_address) addresses.push(`Livr: ${d.delivery_address}${d.delivery_city ? `, ${d.delivery_city}` : ""}`);
      return {
        id: `d-${d.id}`,
        source: "dossier" as const,
        label: d.code || d.title,
        address: addresses.join(" | ") || "—",
        client: d.clients?.name || "—",
        company: d.companies?.short_name || "",
        companyId: d.company_id,
        status: "a_faire",
        type: "arrete_stationnement",
        notes: null,
        requestedAt: null,
        obtainedAt: null,
        createdAt: d.created_at,
        dossierId: d.id,
        dossierTitle: d.title,
      };
    }),
  ];

  // Filter
  const filtered = items.filter((item) => {
    if (filterStatus === "all_active") return !["obtenue", "refusee"].includes(item.status);
    if (filterStatus === "all") return true;
    return item.status === filterStatus;
  });

  // Stats
  const stats = {
    total: items.length,
    aFaire: items.filter((i) => i.status === "a_faire").length,
    demandee: items.filter((i) => i.status === "demandee").length,
    enAttente: items.filter((i) => i.status === "en_attente").length,
    obtenue: items.filter((i) => i.status === "obtenue").length,
  };

  return (
    <div className={`max-w-5xl mx-auto ${isMobile ? "p-3 pb-20 space-y-3" : "p-6 lg:p-8 space-y-6"}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={`font-bold tracking-tight ${isMobile ? "text-lg" : "text-2xl"}`}>
          Démarches voirie
        </h1>
        {!isMobile && (
          <p className="text-muted-foreground mt-1">
            Suivi des demandes d'arrêtés, plans et autorisations voirie
          </p>
        )}
      </motion.div>

      {/* Stats */}
      <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-5"}`}>
        {[
          { label: "Total", value: stats.total, color: "bg-muted" },
          { label: "À faire", value: stats.aFaire, color: "bg-yellow-500/15" },
          { label: "Demandées", value: stats.demandee, color: "bg-blue-500/15" },
          { label: "En attente", value: stats.enAttente, color: "bg-orange-500/15" },
          { label: "Obtenues", value: stats.obtenue, color: "bg-emerald-500/15" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-3 ${s.color}`}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_active">En cours (actifs)</SelectItem>
            <SelectItem value="all">Tous</SelectItem>
            {VOIRIE_STATUSES.map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune demande de voirie trouvée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const meta = statusMeta(item.status);
            const StatusIcon = meta.icon;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border bg-card p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {item.source === "visite" ? "Visite" : "Dossier"}
                      </Badge>
                      <span className="text-sm font-semibold truncate">{item.label}</span>
                      {item.company && (
                        <Badge variant="secondary" className="text-[10px]">{item.company}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">{item.address}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Client : {item.client}</span>
                      {item.dossierTitle && <span>• Dossier : {item.dossierTitle}</span>}
                    </div>
                    {item.requestedAt && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Demandée le {format(new Date(item.requestedAt), "dd MMM yyyy", { locale: fr })}
                      </div>
                    )}
                    {item.obtainedAt && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Obtenue le {format(new Date(item.obtainedAt), "dd MMM yyyy", { locale: fr })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Status badge */}
                    <Badge className={`text-[10px] border ${meta.color} gap-1`}>
                      <StatusIcon className="h-3 w-3" />
                      {meta.label}
                    </Badge>

                    {/* Status changer for visites */}
                    {item.source === "visite" && (
                      <Select
                        value={item.status}
                        onValueChange={(v) => updateVisiteVoirie(item.visiteId!, "voirie_status", v)}
                      >
                        <SelectTrigger className="h-7 text-[10px] w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VOIRIE_STATUSES.map((s) => (
                            <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Type selector for visites */}
                    {item.source === "visite" && (
                      <Select
                        value={item.type || ""}
                        onValueChange={(v) => updateVisiteVoirie(item.visiteId!, "voirie_type", v)}
                      >
                        <SelectTrigger className="h-7 text-[10px] w-[130px]">
                          <SelectValue placeholder="Type…" />
                        </SelectTrigger>
                        <SelectContent>
                          {VOIRIE_TYPES.map((t) => (
                            <SelectItem key={t.key} value={t.key} className="text-xs">{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1 border-t">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setPlanEditorItem(item)}>
                    <Map className="h-3 w-3" /> Plan d'implantation
                  </Button>
                  {item.visiteId && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate(`/visites/${item.visiteId}`)}>
                      <Eye className="h-3 w-3" /> Voir la visite
                    </Button>
                  )}
                  {item.dossierId && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate(`/dossiers/${item.dossierId}`)}>
                      <Eye className="h-3 w-3" /> Voir le dossier
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      {/* Plan Editor Dialog */}
      <Dialog open={!!planEditorItem} onOpenChange={(v) => !v && setPlanEditorItem(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-sm:max-w-[100vw] max-sm:w-[100vw] max-sm:h-[100dvh] max-sm:rounded-none max-sm:border-0 gap-0 p-0 overflow-hidden [&>button:last-child]:hidden" onInteractOutside={(e) => e.preventDefault()}>
          <DialogTitle className="sr-only">Plan d'implantation</DialogTitle>
          <DialogDescription className="sr-only">
            Éditeur interactif du plan de voirie avec éléments de signalisation.
          </DialogDescription>
          {planEditorItem && (
            <PlanEditorErrorBoundary>
              <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                <VoiriePlanEditor
                  companyId={planEditorItem.companyId || (typeof current === "string" && current !== "global" ? current : dbCompanies[0]?.id)}
                  visiteId={planEditorItem.visiteId}
                  dossierId={planEditorItem.dossierId}
                  address={planEditorItem.address}
                  onSave={() => setPlanEditorItem(null)}
                  onClose={() => setPlanEditorItem(null)}
                />
              </Suspense>
            </PlanEditorErrorBoundary>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VoiriePage;
